import { z } from 'zod';

import {
  type BarcodeProvider,
  extractVolume,
  extractYear,
  type FetchFn,
  fetchJson,
} from './types.js';

const SERIES_PREFIX = 'series:';

const responseSchema = z.record(
  z.string(),
  z.object({
    title: z.string().min(1),
    authors: z.array(z.object({ name: z.string() })).optional(),
    publishers: z.array(z.object({ name: z.string() })).optional(),
    publish_date: z.string().optional(),
    subjects: z.array(z.object({ name: z.string() })).optional(),
  }),
);

/** Open Library : gratuit et sans clé, couverture inégale pour les BD francophones. */
export function createOpenLibraryProvider(fetchFn: FetchFn = fetch): BarcodeProvider {
  return {
    source: 'openlibrary',
    kinds: ['isbn'],
    async lookup(code) {
      const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${code}&format=json&jscmd=data`;
      const parsed = responseSchema.safeParse(await fetchJson(fetchFn, url));
      const entry = parsed.success ? Object.values(parsed.data)[0] : undefined;
      if (!entry) {
        return null;
      }

      const series = entry.subjects
        ?.find((subject) => subject.name.toLowerCase().startsWith(SERIES_PREFIX))
        ?.name.slice(SERIES_PREFIX.length)
        .trim();
      const creators = entry.authors?.map((author) => author.name).join(', ');

      return {
        work: {
          title: entry.title,
          series: series || null,
          volumeNumber: extractVolume(entry.title),
          creators: creators || null,
          year: null,
        },
        edition: {
          format: 'book',
          publisher: entry.publishers?.[0]?.name ?? null,
          releaseYear: extractYear(entry.publish_date),
          language: null,
        },
      };
    },
  };
}
