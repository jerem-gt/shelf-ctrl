import { type IgdbClient, onlyConsole } from '../../../sources/igdb.js';
import { titleResult } from './result.js';
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
      return games.map((game) =>
        titleResult({
          source: 'igdb',
          work: {
            title: game.title,
            series: game.series,
            creators: game.developers,
            year: game.year,
          },
          edition: {
            format: 'game',
            publisher: game.publisher,
            releaseYear: game.year,
            console: onlyConsole(game),
          },
          consoles: game.consoles,
        }),
      );
    },
  };
}
