import { type IgdbClient, onlyConsole } from '../../barcodes/providers/igdb.js';
import type { TitleSearchProvider } from './types.js';

const LIMIT = 8;

/**
 * IGDB (jeux vidéo, identifiants Twitch requis) : titre, année, studio, éditeur et série, sans
 * code-barres. Toutes ses consoles sont listées (`consoles`), mais la console n'est préremplie
 * que pour un jeu sorti sur une seule ; sinon l'utilisateur la choisit dans le formulaire.
 */
export function createIgdbTitleSearch(client: IgdbClient): TitleSearchProvider {
  return {
    source: 'igdb',
    kind: 'game',
    async search(query) {
      const games = await client.searchGames(query, LIMIT);
      return games.map((game) => ({
        barcode: null,
        source: 'igdb' as const,
        suggestion: {
          work: {
            title: game.title,
            series: game.series,
            volumeNumber: null,
            creators: game.developers,
            year: game.year,
          },
          edition: {
            format: 'game' as const,
            publisher: game.publisher,
            releaseYear: game.year,
            language: null,
            console: onlyConsole(game),
          },
        },
        consoles: game.consoles,
      }));
    },
  };
}
