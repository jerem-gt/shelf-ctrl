import { z } from 'zod';

import { type FetchFn, fetchJson } from './http.js';
import { extractYear } from './text.js';

/** Un film ou une série : TMDB nomme `title`/`release_date` l'un, `name`/`first_air_date` l'autre. */
const multiSchema = z.object({
  results: z.array(
    z.object({
      media_type: z.string().optional(),
      title: z.string().optional(),
      name: z.string().optional(),
      release_date: z.string().optional(),
      first_air_date: z.string().optional(),
      poster_path: z.string().nullish(),
    }),
  ),
});

/** Film ou série (animes compris) trouvé sur TMDB. */
export interface TmdbEntry {
  title: string;
  year: number | null;
  posterPath: string | null;
}

/**
 * Recherche TMDB parmi les films et les séries (`/search/multi`, personnes écartées), en
 * français. Une erreur (réseau, clé, quota) ou une réponse inattendue est levée.
 */
export async function searchTmdb(
  apiKey: string,
  query: string,
  fetchFn: FetchFn = fetch,
): Promise<TmdbEntry[]> {
  const params = new URLSearchParams({ api_key: apiKey, language: 'fr-FR', query });
  const parsed = multiSchema.safeParse(
    await fetchJson(fetchFn, `https://api.themoviedb.org/3/search/multi?${params}`),
  );
  if (!parsed.success) {
    throw new Error('Réponse inattendue');
  }
  return parsed.data.results.flatMap((entry) => {
    const title = entry.title ?? entry.name;
    if (entry.media_type === 'person' || !title) {
      return [];
    }
    return [
      {
        title,
        year: extractYear(entry.release_date ?? entry.first_air_date),
        posterPath: entry.poster_path ?? null,
      },
    ];
  });
}
