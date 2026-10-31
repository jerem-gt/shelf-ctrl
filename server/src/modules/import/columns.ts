import {
  type CopyCondition,
  IMPORT_FIELDS,
  type ImportField,
  type MediaFormat,
} from '@shelfctrl/types';

/** Minuscules, sans accents, tout ce qui n'est pas alphanumérique réduit à une espace. */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** En-têtes reconnus (repliés) par colonne : français et anglais, dans n'importe quel ordre. */
const HEADER_ALIASES: Record<ImportField, readonly string[]> = {
  title: ['titre', 'title', 'nom'],
  series: ['serie', 'series', 'saga'],
  volume: ['tome', 'volume', 'vol', 'numero', 'no', 'n'],
  creators: [
    'auteurs',
    'auteur',
    'realisateur',
    'realisateurs',
    'createurs',
    'creators',
    'author',
    'authors',
    'director',
  ],
  format: ['format', 'support', 'type'],
  barcode: [
    'code barres',
    'code barre',
    'codebarres',
    'codebarre',
    'isbn',
    'ean',
    'barcode',
    'upc',
  ],
  publisher: ['editeur', 'publisher'],
  year: ['annee', 'year', 'annee edition', 'annee de parution', 'parution'],
  language: ['langue', 'language', 'lang'],
  condition: ['etat', 'condition'],
  note: ['note', 'notes', 'remarque', 'remarques', 'commentaire', 'precisions', 'note etat'],
  location: ['emplacement', 'location', 'rangement', 'lieu'],
};

const FIELD_BY_HEADER = new Map<string, ImportField>(
  IMPORT_FIELDS.flatMap((field) =>
    HEADER_ALIASES[field].map((alias): [string, ImportField] => [alias, field]),
  ),
);

export interface HeaderMapping {
  /** Index de colonne → champ reconnu (la première colonne d'un champ l'emporte). */
  columns: Map<number, ImportField>;
  ignored: string[];
}

export function mapHeaders(headers: readonly string[]): HeaderMapping {
  const columns = new Map<number, ImportField>();
  const taken = new Set<ImportField>();
  const ignored: string[] = [];
  headers.forEach((header, index) => {
    const field = FIELD_BY_HEADER.get(fold(header));
    if (field && !taken.has(field)) {
      columns.set(index, field);
      taken.add(field);
    } else if (header.trim() !== '') {
      ignored.push(header.trim());
    }
  });
  return { columns, ignored };
}

const FORMAT_VALUES: Record<MediaFormat, readonly string[]> = {
  book: [
    'book',
    'livre',
    'bd',
    'bande dessinee',
    'album',
    'manga',
    'roman',
    'comic',
    // Libellés de l'interface (« Livre / BD », « Book / Comic »).
    'livre bd',
    'book comic',
  ],
  dvd: ['dvd'],
  bluray: ['bluray', 'blu ray', 'bluray disc'],
  uhd4k: ['uhd4k', 'uhd', '4k', '4k uhd', 'uhd 4k', 'ultra hd'],
};

const CONDITION_VALUES: Record<CopyCondition, readonly string[]> = {
  new: ['neuf', 'new'],
  very_good: ['tres bon etat', 'tres bon', 'tb', 'tbe', 'very good'],
  good: ['bon etat', 'bon', 'b', 'good'],
  acceptable: ['etat correct', 'correct', 'acceptable', 'moyen', 'passable'],
  poor: ['mauvais etat', 'mauvais', 'poor', 'abime', 'use'],
};

function lookup<T extends string>(table: Record<T, readonly string[]>, value: string): T | null {
  const folded = fold(value);
  const keys = Object.keys(table) as T[];
  return keys.find((key) => table[key].includes(folded)) ?? null;
}

export const parseFormat = (value: string): MediaFormat | null => lookup(FORMAT_VALUES, value);
export const parseCondition = (value: string): CopyCondition | null =>
  lookup(CONDITION_VALUES, value);
