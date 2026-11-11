import type { BarcodeSuggestion } from '@shelfctrl/types';

import type { FetchFn } from '../../../sources/http.js';
import { isSameTitle } from '../../../sources/text.js';
import { searchTmdb } from '../../../sources/tmdb.js';

/**
 * TMDB ne sait pas chercher par code-barres : il sert à fiabiliser le titre (et l'année) d'un
 * film ou d'une série trouvé par une autre source. En cas d'échec, la fiche reste inchangée.
 */
export function createTmdbEnricher(apiKey: string, fetchFn: FetchFn = fetch) {
  return async (suggestion: BarcodeSuggestion): Promise<BarcodeSuggestion> => {
    try {
      const [match] = await searchTmdb(apiKey, suggestion.work.title, fetchFn);
      if (!match || !isSameTitle(suggestion.work.title, match.title)) {
        return suggestion;
      }
      return {
        ...suggestion,
        work: {
          ...suggestion.work,
          title: match.title,
          year: match.year ?? suggestion.work.year,
        },
      };
    } catch {
      return suggestion;
    }
  };
}
