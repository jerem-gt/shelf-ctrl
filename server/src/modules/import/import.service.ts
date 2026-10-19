import crypto from 'node:crypto';

import type {
  BarcodeLookupResponse,
  ImportField,
  ImportJob,
  ImportPreview,
  ImportRowFailure,
  ImportRowPreview,
} from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';

import { createCopySchema } from '../copies/copies.schema.js';
import { createCopiesService } from '../copies/copies.service.js';
import { decodeCsv, parseCsv, toCsvCell } from './csv.js';
import { MAX_ROWS, needsCompletion, type ParsedRow, parseTable, type RowDraft } from './rows.js';

export class EmptyFileError extends Error {}
export class TooManyRowsError extends Error {}
export class ImportRunningError extends Error {}

export interface ImportDeps {
  /** Fiche d'un code-barres (collection puis sources en ligne) ; `null` si inconnu. */
  resolve: (barcode: string) => Promise<BarcodeLookupResponse | null>;
  /** Cherche la pochette d'une édition ; `true` si elle a été trouvée. Absent : pas de pochettes. */
  fetchCover?: (editionId: number) => Promise<boolean>;
}

/** On ne garde que les derniers imports : un seul utilisateur, un suivi à court terme. */
const KEPT_JOBS = 5;
/** Marque d'ordre des octets UTF-8 : sans elle, Excel lit le fichier en Windows-1252. */
const BOM = String.fromCodePoint(0xfeff);

const TEMPLATE_HEADER = [
  'Titre',
  'Série',
  'Tome',
  'Auteurs',
  'Format',
  'Code-barres',
  'Éditeur',
  'Année',
  'Langue',
  'État',
  'Note',
  'Emplacement',
];
const TEMPLATE_ROWS = [
  [
    'Tintin au Tibet',
    'Tintin',
    '20',
    'Hergé',
    'Livre',
    '9782203001190',
    'Casterman',
    '1960',
    'fr',
    'Très bon état',
    '',
    'Salon',
  ],
  [
    'Alien',
    '',
    '',
    'Ridley Scott',
    'Blu-ray',
    '',
    '',
    '1979',
    'fr',
    'Bon état',
    'Boîtier fissuré',
    'Chambre',
  ],
  ['', '', '', '', '', '9782070612758', '', '', '', '', '', ''],
];

/** Fichier modèle : séparateur `;` et BOM UTF-8, pour qu'Excel (français) l'ouvre correctement. */
export function buildTemplate(): string {
  const lines = [TEMPLATE_HEADER, ...TEMPLATE_ROWS].map((row) =>
    row.map((value) => toCsvCell(value)).join(';'),
  );
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

function parseBuffer(buffer: Buffer) {
  const table = parseCsv(decodeCsv(buffer));
  if (table.length === 0) {
    throw new EmptyFileError('Fichier vide');
  }
  if (table.length - 1 > MAX_ROWS) {
    throw new TooManyRowsError(`Plus de ${MAX_ROWS} lignes`);
  }
  return parseTable(table);
}

/** Les valeurs du fichier priment ; la fiche trouvée ne comble que les champs vides. */
function fillFromSuggestion(draft: RowDraft, found: BarcodeLookupResponse): RowDraft {
  const { work, edition } = found.suggestion;
  return {
    ...draft,
    title: draft.title ?? work.title,
    series: draft.series ?? work.series,
    volumeNumber: draft.volumeNumber ?? work.volumeNumber,
    creators: draft.creators ?? work.creators,
    workYear: draft.workYear ?? work.year,
    format: draft.format ?? edition.format,
    publisher: draft.publisher ?? edition.publisher,
    releaseYear: draft.releaseYear ?? edition.releaseYear,
    language: draft.language ?? edition.language,
  };
}

function toCreateInput(draft: RowDraft) {
  return {
    work: {
      title: draft.title,
      series: draft.series,
      volumeNumber: draft.volumeNumber,
      creators: draft.creators,
      year: draft.workYear,
    },
    edition: {
      format: draft.format,
      barcode: draft.barcode,
      publisher: draft.publisher,
      releaseYear: draft.releaseYear,
      language: draft.language,
    },
    condition: draft.condition ?? undefined,
    conditionNote: draft.conditionNote,
    location: draft.location,
  };
}

const FIELD_BY_PATH: Record<string, ImportField> = {
  title: 'title',
  series: 'series',
  volumeNumber: 'volume',
  creators: 'creators',
  format: 'format',
  barcode: 'barcode',
  publisher: 'publisher',
  releaseYear: 'year',
  language: 'language',
  condition: 'condition',
  conditionNote: 'note',
  location: 'location',
};

export function createImportService(db: Database, deps: ImportDeps) {
  const copies = createCopiesService(db);
  const jobs = new Map<string, ImportJob>();
  let runningId: string | null = null;

  const barcodeKnown = db.prepare('SELECT 1 FROM editions WHERE barcode = ?');
  const workKnown = db.prepare(
    `SELECT 1 FROM editions e JOIN works w ON w.id = e.work_id
     WHERE lower(w.title) = ? AND lower(w.series) IS ? AND w.volume_number IS ? AND e.format = ?`,
  );

  /** Clé d'identité d'une édition : le code-barres, à défaut titre, série, tome et support. */
  const identityOf = (draft: RowDraft): string | null => {
    if (draft.barcode !== null) {
      return `code:${draft.barcode}`;
    }
    if (draft.title === null || draft.format === null) {
      return null;
    }
    const series = draft.series?.toLowerCase() ?? '';
    return `titre:${draft.title.toLowerCase()}|${series}|${draft.volumeNumber ?? ''}|${draft.format}`;
  };

  const existsInCollection = (draft: RowDraft): boolean => {
    if (draft.barcode !== null) {
      return barcodeKnown.get(draft.barcode) !== undefined;
    }
    if (draft.title === null || draft.format === null) {
      return false;
    }
    const series = draft.series?.toLowerCase() ?? null;
    return (
      workKnown.get(draft.title.toLowerCase(), series, draft.volumeNumber, draft.format) !==
      undefined
    );
  };

  const toFailure = (row: ParsedRow): ImportRowFailure => ({
    line: row.line,
    title: row.draft.title,
    issues: row.issues,
  });

  const processRow = async (row: ParsedRow, job: ImportJob): Promise<void> => {
    let draft = row.draft;
    let completedOnline = false;
    if (needsCompletion(draft) && draft.barcode !== null) {
      const found = await deps.resolve(draft.barcode).catch(() => null);
      if (found) {
        draft = fillFromSuggestion(draft, found);
        completedOnline = true;
      }
    }

    const fail = (issue: ImportRowFailure['issues'][number]) =>
      job.failures.push({ line: row.line, title: draft.title, issues: [issue] });
    if (draft.title === null) {
      fail({ code: 'not_found_online', field: 'title' });
      return;
    }
    if (draft.format === null) {
      fail({ code: 'missing_format', field: 'format' });
      return;
    }
    const input = createCopySchema.safeParse(toCreateInput(draft));
    if (!input.success) {
      const key = String(input.error.issues[0]?.path.at(-1) ?? '');
      fail({ code: 'invalid', field: FIELD_BY_PATH[key] ?? null });
      return;
    }

    let copy;
    try {
      copy = copies.create(input.data);
    } catch (error) {
      console.warn('[import] ligne', row.line, error instanceof Error ? error.message : error);
      fail({ code: 'invalid', field: null });
      return;
    }
    job.created += 1;
    if (completedOnline) {
      job.completed += 1;
    }
    if (copy.edition.coverPath === null && deps.fetchCover) {
      const found = await deps.fetchCover(copy.edition.id).catch(() => false);
      if (found) {
        job.coversFound += 1;
      }
    }
  };

  const run = async (rows: ParsedRow[], job: ImportJob): Promise<void> => {
    try {
      for (const row of rows) {
        await processRow(row, job);
        job.processed += 1;
      }
      job.status = 'done';
    } catch (error) {
      console.error('[import]', error);
      job.status = 'failed';
    } finally {
      runningId = null;
    }
  };

  return {
    /** Lit et contrôle le fichier sans rien écrire ni interroger en ligne. */
    preview(buffer: Buffer): ImportPreview {
      const { rows, ignoredColumns } = parseBuffer(buffer);
      const seen = new Set<string>();
      const previews = rows.map((row): ImportRowPreview => {
        const identity = identityOf(row.draft);
        const duplicate =
          identity !== null && (seen.has(identity) || existsInCollection(row.draft));
        if (identity !== null) {
          seen.add(identity);
        }
        return {
          line: row.line,
          title: row.draft.title,
          barcode: row.draft.barcode,
          issues: row.issues,
          duplicate: duplicate && row.issues.length === 0,
          willComplete: row.issues.length === 0 && needsCompletion(row.draft),
        };
      });
      const valid = previews.filter((row) => row.issues.length === 0);
      return {
        total: previews.length,
        valid: valid.length,
        invalid: previews.length - valid.length,
        duplicates: valid.filter((row) => row.duplicate).length,
        toComplete: valid.filter((row) => row.willComplete).length,
        ignoredColumns,
        rows: previews,
      };
    },

    /** Lance l'import en tâche de fond ; un seul à la fois. Renvoie son état initial. */
    start(buffer: Buffer): ImportJob {
      if (runningId !== null) {
        throw new ImportRunningError('Un import est déjà en cours');
      }
      const { rows } = parseBuffer(buffer);
      const job: ImportJob = {
        id: crypto.randomUUID(),
        status: 'running',
        total: rows.length,
        processed: 0,
        created: 0,
        completed: 0,
        coversFound: 0,
        failures: rows.filter((row) => row.issues.length > 0).map(toFailure),
      };
      job.processed = job.failures.length;
      jobs.set(job.id, job);
      for (const oldest of [...jobs.keys()].slice(0, Math.max(0, jobs.size - KEPT_JOBS))) {
        jobs.delete(oldest);
      }

      runningId = job.id;
      void run(
        rows.filter((row) => row.issues.length === 0),
        job,
      );
      return structuredClone(job);
    },

    get(id: string): ImportJob | undefined {
      const job = jobs.get(id);
      return job ? structuredClone(job) : undefined;
    },
  };
}

export type ImportService = ReturnType<typeof createImportService>;
