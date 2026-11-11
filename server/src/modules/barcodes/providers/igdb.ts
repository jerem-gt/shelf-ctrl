import type { BarcodeSuggestion } from '@shelfctrl/types';

import { findMatchingGame, type IgdbClient, onlyConsole } from '../../../sources/igdb.js';

/**
 * IGDB ne cherche pas par code-barres : il complète une fiche de jeu trouvée par une autre source
 * (titre officiel, année, studio, éditeur, série). Les valeurs déjà connues sont gardées, sauf le
 * titre ; en cas d'échec, la fiche reste inchangée.
 */
export function createIgdbEnricher(client: IgdbClient) {
  return async (suggestion: BarcodeSuggestion): Promise<BarcodeSuggestion> => {
    try {
      const game = findMatchingGame(
        await client.searchGames(suggestion.work.title, 5),
        suggestion.work.title,
      );
      if (!game) {
        return suggestion;
      }
      const { work, edition } = suggestion;
      return {
        work: {
          ...work,
          title: game.title,
          series: work.series ?? game.series,
          creators: work.creators ?? game.developers,
          year: work.year ?? game.year,
        },
        edition: {
          ...edition,
          publisher: edition.publisher ?? game.publisher,
          console: edition.console ?? onlyConsole(game),
        },
      };
    } catch {
      return suggestion;
    }
  };
}
