import { type CoverProvider, type FetchFn, fetchImage } from './types.js';

const ISBN_PREFIX = /^97[89]/;

/** Open Library : pochettes de livres par ISBN, gratuit et sans clé. */
export function createOpenLibraryCoverProvider(fetchFn: FetchFn = fetch): CoverProvider {
  return {
    source: 'openlibrary',
    supports: (query) =>
      query.format === 'book' && query.barcode !== null && ISBN_PREFIX.test(query.barcode),
    // `default=false` : 404 plutôt qu'une image vide quand la pochette est inconnue.
    find: (query) =>
      fetchImage(
        fetchFn,
        `https://covers.openlibrary.org/b/isbn/${query.barcode}-L.jpg?default=false`,
      ),
  };
}
