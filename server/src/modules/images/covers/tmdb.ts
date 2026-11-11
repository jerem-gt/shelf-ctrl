import { kindOfFormat } from '@shelfctrl/types';

import { isSameTitle, searchTmdb } from '../../barcodes/providers/tmdb.js';
import { type CoverProvider, type FetchFn, fetchImage } from './types.js';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

/**
 * Affiches de films et de séries par titre (TMDB ne cherche pas par code-barres). On ne retient
 * qu'une œuvre dont le titre correspond, et dont l'année concorde quand on la connaît.
 */
export function createTmdbCoverProvider(apiKey: string, fetchFn: FetchFn = fetch): CoverProvider {
  return {
    source: 'tmdb',
    supports: (query) => kindOfFormat(query.format) === 'movie',
    async find(query) {
      const entries = await searchTmdb(apiKey, query.title, fetchFn);
      const match = entries.find(
        (entry) =>
          entry.posterPath &&
          isSameTitle(query.title, entry.title) &&
          (query.year === null || entry.year === query.year),
      );
      return match?.posterPath ? fetchImage(fetchFn, `${POSTER_BASE}${match.posterPath}`) : null;
    },
  };
}
