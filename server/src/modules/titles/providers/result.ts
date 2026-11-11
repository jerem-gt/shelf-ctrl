import type { BarcodeSuggestion, TitleSearchResult } from '@shelfctrl/types';

type Work = BarcodeSuggestion['work'];
type Edition = BarcodeSuggestion['edition'];

export interface TitleResultInput {
  source: TitleSearchResult['source'];
  barcode?: string | null;
  work: Pick<Work, 'title'> & Partial<Work>;
  edition?: Partial<Edition>;
  consoles?: string[];
}

/**
 * Résultat d'une recherche par titre : ce que la source ne donne pas vaut `null` (code-barres,
 * champs de l'œuvre et de l'édition) ou `[]` (consoles).
 */
export function titleResult({
  source,
  barcode = null,
  work,
  edition = {},
  consoles = [],
}: TitleResultInput): TitleSearchResult {
  return {
    barcode,
    source,
    suggestion: {
      work: { series: null, volumeNumber: null, creators: null, year: null, ...work },
      edition: {
        format: null,
        publisher: null,
        releaseYear: null,
        language: null,
        console: null,
        ...edition,
      },
    },
    consoles,
  };
}
