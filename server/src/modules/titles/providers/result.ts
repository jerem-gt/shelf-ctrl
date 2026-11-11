import type { BarcodeSuggestion, TitleSearchResult } from '@shelfctrl/types';

type Work = BarcodeSuggestion['work'];
type Edition = BarcodeSuggestion['edition'];

interface TitleResultInput {
  source: TitleSearchResult['source'];
  barcode?: string | null;
  work: Pick<Work, 'title'> & Partial<Work>;
  edition?: Partial<Edition>;
  consoles?: string[];
}

/** Champs `undefined` retirés : étalés tels quels, ils écraseraient la valeur par défaut. */
function definedFields<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Partial<T>;
}

/**
 * Résultat d'une recherche par titre : ce que la source ne donne pas (absent ou `undefined`)
 * vaut `null` (code-barres, champs de l'œuvre et de l'édition) ou `[]` (consoles).
 */
export function titleResult({
  source,
  barcode,
  work,
  edition = {},
  consoles,
}: TitleResultInput): TitleSearchResult {
  return {
    barcode: barcode ?? null,
    source,
    suggestion: {
      work: {
        series: null,
        volumeNumber: null,
        creators: null,
        year: null,
        ...definedFields(work),
        title: work.title,
      },
      edition: {
        format: null,
        publisher: null,
        releaseYear: null,
        language: null,
        console: null,
        ...definedFields(edition),
      },
    },
    consoles: consoles ?? [],
  };
}
