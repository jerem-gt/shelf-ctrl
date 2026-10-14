import { z } from 'zod';

import {
  type BarcodeProvider,
  extractVolume,
  extractYear,
  type FetchFn,
  fetchJson,
} from './types.js';

const responseSchema = z.object({
  items: z
    .array(
      z.object({
        volumeInfo: z.object({
          title: z.string().min(1),
          authors: z.array(z.string()).optional(),
          publisher: z.string().optional(),
          publishedDate: z.string().optional(),
          language: z.string().optional(),
        }),
      }),
    )
    .optional(),
});

/** Google Books : une clé API est obligatoire (le quota anonyme est nul). */
export function createGoogleBooksProvider(
  apiKey: string,
  fetchFn: FetchFn = fetch,
): BarcodeProvider {
  return {
    source: 'googlebooks',
    kinds: ['isbn'],
    async lookup(code) {
      const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${code}&maxResults=1&key=${encodeURIComponent(apiKey)}`;
      const parsed = responseSchema.safeParse(await fetchJson(fetchFn, url));
      const info = parsed.success ? parsed.data.items?.[0]?.volumeInfo : undefined;
      if (!info) {
        return null;
      }

      return {
        work: {
          title: info.title,
          series: null,
          volumeNumber: extractVolume(info.title),
          creators: info.authors?.join(', ') || null,
          year: null,
        },
        edition: {
          format: 'book',
          publisher: info.publisher ?? null,
          releaseYear: extractYear(info.publishedDate),
          language: info.language ?? null,
        },
      };
    },
  };
}
