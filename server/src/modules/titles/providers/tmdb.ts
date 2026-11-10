import { searchTmdb } from '../../barcodes/providers/tmdb.js';
import type { FetchFn } from '../../barcodes/providers/types.js';
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
      return entries.slice(0, LIMIT).map((entry) => ({
        barcode: null,
        source: 'tmdb' as const,
        suggestion: {
          work: {
            title: entry.title,
            series: null,
            volumeNumber: null,
            creators: null,
            year: entry.year,
          },
          edition: {
            format: null,
            publisher: null,
            releaseYear: null,
            language: null,
            console: null,
          },
        },
      }));
    },
  };
}
