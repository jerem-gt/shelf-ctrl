import type { FetchFn } from '../../../sources/http.js';
import { searchTmdb } from '../../../sources/tmdb.js';
import { titleResult } from './result.js';
import type { TitleSearchProvider } from './types.js';

const LIMIT = 8;

/**
 * TMDB (films et séries, animes compris ; clé requise) : donne titre et année, ni code-barres
 * ni support, que l'utilisateur précise (DVD, Blu-ray…) dans le formulaire.
 */
export function createTmdbTitleSearch(
  apiKey: string,
  fetchFn: FetchFn = fetch,
): TitleSearchProvider {
  return {
    source: 'tmdb',
    kind: 'movie',
    async search(query) {
      const entries = await searchTmdb(apiKey, query, fetchFn);
      return entries
        .slice(0, LIMIT)
        .map((entry) =>
          titleResult({ source: 'tmdb', work: { title: entry.title, year: entry.year } }),
        );
    },
  };
}
