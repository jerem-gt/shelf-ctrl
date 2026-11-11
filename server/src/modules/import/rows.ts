import {
  type BarcodeSuggestion,
  CONSOLE_MAX_LENGTH,
  type CopyCondition,
  type ImportField,
  type ImportIssue,
  type ImportIssueCode,
  type MediaFormat,
} from '@shelfctrl/types';

import { normalizeConsole } from '../../lib/consoles.js';
import { BadRequestError } from '../../lib/errors.js';
import { parseBarcode } from '../barcodes/barcode.js';
import { mapHeaders, parseCondition, parseFormat } from './columns.js';

/** Au-delà, le fichier est refusé : l'import tourne ligne à ligne, avec des recherches en ligne. */
export const MAX_ROWS = 1000;

const MAX_LENGTH: Partial<Record<ImportField, number>> = {
  title: 200,
  series: 200,
  creators: 300,
  publisher: 200,
  note: 500,
  location: 100,
  language: 20,
  console: CONSOLE_MAX_LENGTH,
};

const VOLUME = /^(?:t|tome|vol\.?|volume)?\s*(\d{1,4})$/i;
const YEAR = /^\d{4}$/;
const MIN_YEAR = 1000;
const MAX_YEAR = 2100;

type SuggestedWork = BarcodeSuggestion['work'];
type SuggestedEdition = BarcodeSuggestion['edition'];

/**
 * Œuvre d'une ligne : celle d'une fiche trouvée en ligne, mais le titre peut manquer (il est alors
 * cherché par le code-barres). `year` n'est jamais dans le fichier, seulement reprise de la fiche.
 */
export interface ImportWork extends Omit<SuggestedWork, 'title'> {
  title: string | null;
}

/**
 * Édition d'une ligne : celle d'une fiche trouvée en ligne, plus le code-barres lu dans le
 * fichier. `console` : celle d'un jeu vidéo, sous son nom connu quand on la reconnaît.
 */
export interface ImportEdition extends SuggestedEdition {
  barcode: string | null;
}

/**
 * Contenu d'une ligne, normalisé ; `null` quand la cellule est vide ou invalide. Œuvre et
 * édition ont la forme d'une fiche trouvée en ligne, qui peut les compléter champ à champ.
 */
export interface RowDraft {
  work: ImportWork;
  edition: ImportEdition;
  condition: CopyCondition | null;
  conditionNote: string | null;
  location: string | null;
}

export interface ParsedRow {
  /** Numéro de ligne dans le tableur (l'en-tête est la ligne 1). */
  line: number;
  draft: RowDraft;
  issues: ImportIssue[];
}

export interface ParsedTable {
  rows: ParsedRow[];
  ignoredColumns: string[];
}

type Cells = Partial<Record<ImportField, string>>;

/** Valeur lue dans une cellule, ou le problème à signaler (`null` : cellule vide). */
type Parsed<T> = { value: T } | { issue: ImportIssueCode };

function parseVolume(cell: string): Parsed<number> {
  const match = VOLUME.exec(cell);
  const volume = match ? Number(match[1]) : 0;
  return volume >= 1 ? { value: volume } : { issue: 'invalid_volume' };
}

function parseYear(cell: string): Parsed<number> {
  const year = YEAR.test(cell) ? Number(cell) : 0;
  return year >= MIN_YEAR && year <= MAX_YEAR ? { value: year } : { issue: 'invalid_year' };
}

function parseWith<T>(
  cell: string,
  parse: (value: string) => T | null,
  issue: ImportIssueCode,
): Parsed<T> {
  const value = parse(cell);
  return value === null ? { issue } : { value };
}

function parseRow(line: number, cells: Cells): ParsedRow {
  const issues: ImportIssue[] = [];
  const cell = (field: ImportField): string | null => cells[field]?.trim() || null;

  /** Valeur de la colonne, ou `null` (cellule vide ou invalide, avec le problème noté). */
  const read = <T>(field: ImportField, parse: (value: string) => Parsed<T>): T | null => {
    const raw = cell(field);
    if (raw === null) {
      return null;
    }
    const result = parse(raw);
    if ('issue' in result) {
      issues.push({ code: result.issue, field });
      return null;
    }
    return result.value;
  };

  const text = (field: ImportField): string | null =>
    read(field, (value): Parsed<string> => {
      const max = MAX_LENGTH[field];
      return max !== undefined && value.length > max ? { issue: 'too_long' } : { value };
    });

  const format = read('format', (value) => parseWith(value, parseFormat, 'invalid_format'));
  const barcode = read('barcode', (value) => parseWith(value, parseBarcode, 'invalid_barcode'));
  const title = text('title');
  if (title === null && barcode === null && cell('title') === null) {
    issues.push({ code: 'missing_title', field: 'title' });
  }

  const gameConsole = text('console');
  // Une console désigne un jeu vidéo ; sinon un livre sans précision reste un livre, et un code
  // EAN ne dit pas s'il s'agit d'un DVD, d'un Blu-ray, d'un 4K ou d'un jeu.
  let impliedFormat: MediaFormat | null = null;
  if (gameConsole !== null) {
    impliedFormat = 'game';
  } else if (barcode === null || barcode.kind === 'isbn') {
    impliedFormat = 'book';
  }

  return {
    line,
    issues,
    draft: {
      work: {
        title,
        series: text('series'),
        volumeNumber: read('volume', parseVolume),
        creators: text('creators'),
        year: null,
      },
      edition: {
        format: format ?? (cell('format') === null ? impliedFormat : null),
        console: gameConsole === null ? null : normalizeConsole(gameConsole),
        barcode: barcode?.code ?? null,
        publisher: text('publisher'),
        releaseYear: read('year', parseYear),
        language: text('language'),
      },
      condition: read('condition', (value) =>
        parseWith(value, parseCondition, 'invalid_condition'),
      ),
      conditionNote: text('note'),
      location: text('location'),
    },
  };
}

/**
 * Des champs seront cherchés en ligne quand la ligne a un code-barres mais qu'il manque le
 * titre, les auteurs, l'éditeur, ou le support d'un code vidéo. Les valeurs du fichier priment.
 */
export function needsCompletion({ work, edition }: RowDraft): boolean {
  return (
    edition.barcode !== null &&
    (work.title === null ||
      work.creators === null ||
      edition.publisher === null ||
      edition.format === null)
  );
}

/** Interprète un tableau CSV (en-tête puis lignes) ; lève `import.no_columns` sans colonne utile. */
export function parseTable(table: readonly string[][]): ParsedTable {
  const [headers = [], ...body] = table;
  const { columns, ignored } = mapHeaders(headers);
  const fields = new Set(columns.values());
  if (!fields.has('title') && !fields.has('barcode')) {
    // Aucune colonne `titre` ni `code-barres` : le fichier n'est pas un import utilisable.
    throw new BadRequestError('import.no_columns');
  }

  const rows = body.map((values, index) => {
    const cells: Cells = {};
    columns.forEach((field, column) => {
      cells[field] = values[column];
    });
    return parseRow(index + 2, cells);
  });
  return { rows, ignoredColumns: ignored };
}
