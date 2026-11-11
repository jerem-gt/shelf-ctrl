import { isGameFormat } from '@shelfctrl/types';

import type { FetchFn } from '../../../sources/http.js';
import { findMatchingGame, type IgdbClient } from '../../../sources/igdb.js';
import { type CoverProvider, fetchImage } from './types.js';

/**
 * Jaquettes de jeux vidéo par titre (IGDB ne cherche pas par code-barres). On ne retient qu'un
 * jeu dont le titre correspond, et dont l'année concorde quand on la connaît.
 */
export function createIgdbCoverProvider(
  client: IgdbClient,
  fetchFn: FetchFn = fetch,
): CoverProvider {
  return {
    source: 'igdb',
    supports: (query) => isGameFormat(query.format),
    async find(query) {
      const games = (await client.searchGames(query.title, 10)).filter((game) => game.coverUrl);
      const match = findMatchingGame(games, query.title, query.year);
      return match?.coverUrl ? fetchImage(fetchFn, match.coverUrl) : null;
    },
  };
}
