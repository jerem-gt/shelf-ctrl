import type { BarcodeSuggestion } from '@shelfctrl/types';
import { z } from 'zod';

import { extractYear, type FetchFn, fetchJson } from './types.js';

const responseSchema = z.object({
  results: z.array(z.object({ title: z.string(), release_date: z.string().optional() })),
});

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Évite de remplacer le titre par celui d'un film sans rapport avec le produit trouvé. */
export function isSameTitle(a: string, b: string): boolean {
  const foldedA = fold(a);
  const foldedB = fold(b);
  if (foldedA.length < 3 || foldedB.length < 3) {
    return foldedA === foldedB;
  }
  return foldedA === foldedB || foldedB.includes(foldedA) || foldedA.includes(foldedB);
}

/**
 * TMDB ne sait pas chercher par code-barres : il sert à fiabiliser le titre (et l'année)
 * d'une fiche trouvée par une autre source. En cas d'échec, la fiche reste inchangée.
 */
export function createTmdbEnricher(apiKey: string, fetchFn: FetchFn = fetch) {
  return async (suggestion: BarcodeSuggestion): Promise<BarcodeSuggestion> => {
    try {
      const query = encodeURIComponent(suggestion.work.title);
      const url = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}&language=fr-FR&query=${query}`;
      const parsed = responseSchema.safeParse(await fetchJson(fetchFn, url));
      const match = parsed.success ? parsed.data.results[0] : undefined;
      if (!match || !isSameTitle(suggestion.work.title, match.title)) {
        return suggestion;
      }
      return {
        ...suggestion,
        work: {
          ...suggestion.work,
          title: match.title,
          year: extractYear(match.release_date) ?? suggestion.work.year,
        },
      };
    } catch {
      return suggestion;
    }
  };
}
