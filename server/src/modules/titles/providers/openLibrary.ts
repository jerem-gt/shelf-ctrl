import { z } from 'zod';

import { parseBarcode } from '../../barcodes/barcode.js';
import { extractVolume, type FetchFn, fetchJson } from '../../barcodes/providers/types.js';
import type { TitleSearchProvider } from './types.js';

const LIMIT = 8;
const FIELDS = 'title,author_name,first_publish_year,publisher,isbn';

const responseSchema = z.object({
  docs: z.array(
    z.object({
      title: z.string().min(1),
      author_name: z.array(z.string()).optional(),
      first_publish_year: z.number().optional(),
      publisher: z.array(z.string()).optional(),
      isbn: z.array(z.string()).optional(),
    }),
  ),
});

/** Premier ISBN valide d'une œuvre : Open Library en liste des dizaines, toutes éditions confondues. */
function firstIsbn(isbns: readonly string[] | undefined): string | null {
  for (const isbn of isbns ?? []) {
    const parsed = parseBarcode(isbn);
    if (parsed?.kind === 'isbn') {
      return parsed.code;
    }
  }
  return null;
}

/** Open Library : recherche par titre, complément anglophone de la BnF. */
export function createOpenLibraryTitleSearch(fetchFn: FetchFn = fetch): TitleSearchProvider {
  return {
    source: 'openlibrary',
    async search(query) {
      const params = new URLSearchParams({ q: query, limit: String(LIMIT), fields: FIELDS });
      const parsed = responseSchema.safeParse(
        await fetchJson(fetchFn, `https://openlibrary.org/search.json?${params}`),
      );
      if (!parsed.success) {
        throw new Error('Réponse inattendue');
      }

      return parsed.data.docs.map((doc) => ({
        barcode: firstIsbn(doc.isbn),
        source: 'openlibrary' as const,
        suggestion: {
          work: {
            title: doc.title,
            series: null,
            volumeNumber: extractVolume(doc.title),
            creators: doc.author_name?.join(', ') || null,
            year: doc.first_publish_year ?? null,
          },
          edition: {
            format: 'book' as const,
            publisher: doc.publisher?.[0] ?? null,
            releaseYear: null,
            language: null,
          },
        },
      }));
    },
  };
}
