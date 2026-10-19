import { z } from 'zod';

import { extractYear, type FetchFn, fetchJson } from '../../barcodes/providers/types.js';
import type { TitleSearchProvider } from './types.js';

const LIMIT = 8;

const responseSchema = z.object({
  results: z.array(z.object({ title: z.string().min(1), release_date: z.string().optional() })),
});

/**
 * TMDB (films, clé requise) : donne titre et année, ni code-barres ni support, que l'utilisateur
 * précise (DVD, Blu-ray…) dans le formulaire.
 */
export function createTmdbTitleSearch(
  apiKey: string,
  fetchFn: FetchFn = fetch,
): TitleSearchProvider {
  return {
    source: 'tmdb',
    async search(query) {
      const params = new URLSearchParams({ api_key: apiKey, language: 'fr-FR', query });
      const parsed = responseSchema.safeParse(
        await fetchJson(fetchFn, `https://api.themoviedb.org/3/search/movie?${params}`),
      );
      if (!parsed.success) {
        throw new Error('Réponse inattendue');
      }

      return parsed.data.results.slice(0, LIMIT).map((movie) => ({
        barcode: null,
        source: 'tmdb' as const,
        suggestion: {
          work: {
            title: movie.title,
            series: null,
            volumeNumber: null,
            creators: null,
            year: extractYear(movie.release_date),
          },
          edition: { format: null, publisher: null, releaseYear: null, language: null },
        },
      }));
    },
  };
}
