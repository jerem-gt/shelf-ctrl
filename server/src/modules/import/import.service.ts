import crypto from 'node:crypto';

import {
  type BarcodeLookupResponse,
  consoleOf,
  type ImportField,
  type ImportJob,
  type ImportPreview,
  type ImportRowFailure,
  type ImportRowPreview,
  type ShelfLang,
} from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';

import { barcodeIdentity, titleIdentity } from '../../lib/editionIdentity.js';
import { BadRequestError, ConflictError } from '../../lib/errors.js';
import { createCopySchema } from '../copies/copies.schema.js';
import { createCopiesService } from '../copies/copies.service.js';
import { decodeCsv, parseCsv } from './csv.js';
import { MAX_ROWS, needsCompletion, type ParsedRow, parseTable, type RowDraft } from './rows.js';

export interface ImportDeps {
  /** Fiche d'un code-barres (collection du compte puis sources en ligne) ; `null` si inconnu. */
  resolve: (userId: number, barcode: string) => Promise<BarcodeLookupResponse | null>;
  /** Cherche la pochette d'une édition ; `true` si elle a été trouvée. Absent : pas de pochettes. */
  fetchCover?: (userId: number, editionId: number) => Promise<boolean>;
}

/** On ne garde que les derniers imports de chaque compte : un suivi à court terme. */
const KEPT_JOBS = 5;
/** Marque d'ordre des octets UTF-8 : sans elle, Excel lit le fichier en Windows-1252. */
const BOM = String.fromCodePoint(0xfeff);

/**
 * Modèle par langue, une ligne par chaîne : en-têtes et valeurs reconnus par l'aperçu
 * (cf. `columns.ts`). Les exemples ne contiennent ni `;` ni guillemets : rien à échapper.
 */
const TEMPLATES: Record<ShelfLang, { fileName: string; lines: readonly string[] }> = {
  fr: {
    fileName: 'shelfctrl-modele.csv',
    lines: [
      'Titre;Série;Tome;Auteurs;Format;Console;Code-barres;Éditeur;Année;Langue;État;Note;Emplacement',
      'Tintin au Tibet;Tintin;20;Hergé;Livre;;9782203001190;Casterman;1960;fr;Très bon état;;Salon',
      'Alien;;;Ridley Scott;Blu-ray;;;;1979;fr;Bon état;Boîtier fissuré;Chambre',
      'Super Mario Odyssey;Super Mario;;Nintendo EPD;Jeu vidéo;Nintendo Switch;;Nintendo;2017;fr;Très bon état;Sans notice;Salon',
      ';;;;;;9782070612758;;;;;;',
    ],
  },
  en: {
    fileName: 'shelfctrl-template.csv',
    lines: [
      'Title;Series;Volume;Authors;Format;Console;Barcode;Publisher;Year;Language;Condition;Note;Location',
      'Tintin in Tibet;Tintin;20;Hergé;Book;;;Egmont;1962;en;Very good;;Living room',
      'Alien;;;Ridley Scott;Blu-ray;;;;1979;en;Good;Cracked case;Bedroom',
      'Super Mario Odyssey;Super Mario;;Nintendo EPD;Video game;Nintendo Switch;;Nintendo;2017;en;Very good;No manual;Living room',
      ';;;;;;9780156012195;;;;;;',
    ],
  },
};

/** Nom du fichier modèle téléchargé, dans la langue demandée. */
export const templateFileName = (lang: ShelfLang): string => TEMPLATES[lang].fileName;

/** Fichier modèle : séparateur `;` et BOM UTF-8, pour qu'Excel (français) l'ouvre correctement. */
export function buildTemplate(lang: ShelfLang = 'fr'): string {
  const { lines } = TEMPLATES[lang];
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

function parseBuffer(buffer: Buffer) {
  const table = parseCsv(decodeCsv(buffer));
  if (table.length === 0) {
    throw new BadRequestError('import.empty_file');
  }
  if (table.length - 1 > MAX_ROWS) {
    throw new BadRequestError('import.too_many_rows', { max: MAX_ROWS });
  }
  return parseTable(table);
}

/** Comble les champs vides (`null`) de `own` avec ceux de `found` ; les autres sont gardés. */
function fillMissing<T extends object>(own: T, found: Partial<T>): T {
  const filled = { ...own };
  for (const key of Object.keys(found) as (keyof T)[]) {
    const value = found[key];
    if (filled[key] === null && value !== undefined) {
      filled[key] = value;
    }
  }
  return filled;
}

/** Les valeurs du fichier priment ; la fiche trouvée ne comble que les champs vides. */
function fillFromSuggestion(draft: RowDraft, found: BarcodeLookupResponse): RowDraft {
  const { work, edition } = found.suggestion;
  return {
    ...draft,
    work: fillMissing(draft.work, work),
    edition: fillMissing(draft.edition, edition),
  };
}

function toCreateInput({ work, edition, condition, conditionNote, location }: RowDraft) {
  return { work, edition, condition: condition ?? undefined, conditionNote, location };
}

const FIELD_BY_PATH: Record<string, ImportField> = {
  title: 'title',
  series: 'series',
  volumeNumber: 'volume',
  creators: 'creators',
  format: 'format',
  console: 'console',
  barcode: 'barcode',
  publisher: 'publisher',
  releaseYear: 'year',
  language: 'language',
  condition: 'condition',
  conditionNote: 'note',
  location: 'location',
};

interface EditionTitle {
  title: string;
  series: string | null;
  volume: number | null;
  format: string;
  console: string | null;
}

/**
 * Identité d'une édition sans code-barres : titre, série, tome, support et console. Calculée en
 * JavaScript des deux côtés (fichier et collection), cf. `titleIdentity`.
 */
function editionTitleIdentity({
  title,
  series,
  volume,
  format,
  console: gameConsole,
}: EditionTitle) {
  return titleIdentity([title, series, volume, format, gameConsole]);
}

/** Résultat de `work`, ou `fallback` s'il échoue : une source en panne ne doit rien interrompre. */
async function safely<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

export function createImportService(db: Database, deps: ImportDeps) {
  const copies = createCopiesService(db);
  const jobs = new Map<string, { userId: number; job: ImportJob }>();
  /** Comptes dont un import est en cours : un seul à la fois par compte. */
  const running = new Set<number>();

  const barcodeKnown = db.prepare('SELECT 1 FROM editions WHERE user_id = ? AND barcode = ?');
  const editionTitles = db.prepare(
    `SELECT w.title, w.series, w.volume_number AS volume, e.format, e.console
     FROM editions e JOIN works w ON w.id = e.work_id
     WHERE e.user_id = ?`,
  );

  /** Clés « titre » des éditions de la collection du compte, lues une fois par aperçu. */
  const loadKnownTitles = (userId: number): Set<string> =>
    new Set((editionTitles.all(userId) as EditionTitle[]).map(editionTitleIdentity));

  /**
   * Identité de l'édition d'une ligne : le code-barres, à défaut titre, série, tome et support ;
   * `null` quand la ligne ne permet pas de la dire (titre ou support manquant).
   */
  const draftIdentity = ({ work, edition }: RowDraft): string | null => {
    if (edition.barcode !== null) {
      return barcodeIdentity(edition.barcode);
    }
    if (work.title === null || edition.format === null) {
      return null;
    }
    return editionTitleIdentity({
      title: work.title,
      series: work.series,
      volume: work.volumeNumber,
      format: edition.format,
      console: consoleOf(edition.format, edition.console),
    });
  };

  const existsInCollection = (
    userId: number,
    draft: RowDraft,
    knownTitles: ReadonlySet<string>,
  ): boolean => {
    const identity = draftIdentity(draft);
    if (identity === null) {
      return false;
    }
    const { barcode } = draft.edition;
    return barcode === null
      ? knownTitles.has(identity)
      : barcodeKnown.get(userId, barcode) !== undefined;
  };

  const toFailure = (row: ParsedRow): ImportRowFailure => ({
    line: row.line,
    title: row.draft.work.title,
    issues: row.issues,
  });

  const processRow = async (userId: number, row: ParsedRow, job: ImportJob): Promise<void> => {
    let draft = row.draft;
    let completedOnline = false;
    const code = draft.edition.barcode;
    if (needsCompletion(draft) && code !== null) {
      const found = await safely(() => deps.resolve(userId, code), null);
      if (found) {
        draft = fillFromSuggestion(draft, found);
        completedOnline = true;
      }
    }

    const fail = (issue: ImportRowFailure['issues'][number]) =>
      job.failures.push({ line: row.line, title: draft.work.title, issues: [issue] });
    if (draft.work.title === null) {
      fail({ code: 'not_found_online', field: 'title' });
      return;
    }
    if (draft.edition.format === null) {
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
      copy = copies.create(userId, input.data);
    } catch (error) {
      console.warn('[import] ligne', row.line, error instanceof Error ? error.message : error);
      fail({ code: 'invalid', field: null });
      return;
    }
    job.created += 1;
    if (completedOnline) {
      job.completed += 1;
    }
    const { fetchCover } = deps;
    if (copy.edition.coverPath === null && fetchCover) {
      const found = await safely(() => fetchCover(userId, copy.edition.id), false);
      if (found) {
        job.coversFound += 1;
      }
    }
  };

  const run = async (userId: number, rows: ParsedRow[], job: ImportJob): Promise<void> => {
    try {
      // Séquentiel (reduce chaîné) : sources en ligne limitées en débit, doublons du fichier
      // rattachés aux éditions créées par les lignes précédentes, progression dans l'ordre.
      await rows.reduce(async (previous, row) => {
        await previous;
        try {
          await processRow(userId, row, job);
        } catch (error) {
          // Une ligne inattendue est rapportée, sans arrêter les mille suivantes.
          console.error('[import] ligne', row.line, error);
          job.failures.push({
            line: row.line,
            title: row.draft.work.title,
            issues: [{ code: 'invalid', field: null }],
          });
        }
        job.processed += 1;
      }, Promise.resolve());
      job.status = 'done';
    } catch (error) {
      console.error('[import]', error);
      job.status = 'failed';
    } finally {
      running.delete(userId);
    }
  };

  return {
    /** Lit et contrôle le fichier sans rien écrire ni interroger en ligne. */
    preview(userId: number, buffer: Buffer): ImportPreview {
      const { rows, ignoredColumns } = parseBuffer(buffer);
      const knownTitles = loadKnownTitles(userId);
      const seen = new Set<string>();
      const previews = rows.map((row): ImportRowPreview => {
        const identity = draftIdentity(row.draft);
        const duplicate =
          identity !== null &&
          (seen.has(identity) || existsInCollection(userId, row.draft, knownTitles));
        if (identity !== null) {
          seen.add(identity);
        }
        return {
          line: row.line,
          title: row.draft.work.title,
          barcode: row.draft.edition.barcode,
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

    /** Lance l'import en tâche de fond ; un seul à la fois par compte. Renvoie son état initial. */
    start(userId: number, buffer: Buffer): ImportJob {
      if (running.has(userId)) {
        throw new ConflictError('import.running');
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
      jobs.set(job.id, { userId, job });
      const own = [...jobs].filter(([, entry]) => entry.userId === userId).map(([id]) => id);
      for (const oldest of own.slice(0, Math.max(0, own.length - KEPT_JOBS))) {
        jobs.delete(oldest);
      }

      running.add(userId);
      void run(
        userId,
        rows.filter((row) => row.issues.length === 0),
        job,
      );
      return structuredClone(job);
    },

    /** Un import d'un autre compte est introuvable. */
    get(userId: number, id: string): ImportJob | undefined {
      const entry = jobs.get(id);
      return entry?.userId === userId ? structuredClone(entry.job) : undefined;
    },
  };
}

export type ImportService = ReturnType<typeof createImportService>;
