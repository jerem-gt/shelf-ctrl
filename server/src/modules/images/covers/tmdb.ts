import { z } from 'zod';

import { isSameTitle } from '../../barcodes/providers/tmdb.js';
import { fetchJson } from '../../barcodes/providers/types.js';
import { type CoverProvider, type FetchFn, fetchImage } from './types.js';

const responseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      release_date: z.string().optional(),
      poster_path: z.string().nullish(),
    }),
  ),
});

const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

/**
 * Affiches de films par titre (TMDB ne cherche pas par code-barres). On ne retient qu'un film
 * dont le titre correspond, et dont l'année concorde quand on la connaît.
 */
export function createTmdbCoverProvider(apiKey: string, fetchFn: FetchFn = fetch): CoverProvider {
  return {
    source: 'tmdb',
    supports: (query) => query.format !== 'book',
    async find(query) {
      const params = new URLSearchParams({
        api_key: apiKey,
        language: 'fr-FR',
        query: query.title,
      });
      const parsed = responseSchema.safeParse(
        await fetchJson(fetchFn, `https://api.themoviedb.org/3/search/movie?${params}`),
      );
      if (!parsed.success) {
        throw new Error('Réponse inattendue');
      }
      const match = parsed.data.results.find(
        (movie) =>
          movie.poster_path &&
          isSameTitle(query.title, movie.title) &&
          (query.year === null || movie.release_date?.startsWith(String(query.year))),
      );
      return match?.poster_path ? fetchImage(fetchFn, `${POSTER_BASE}${match.poster_path}`) : null;
    },
  };
}
