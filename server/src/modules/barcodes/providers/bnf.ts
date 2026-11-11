import { searchBnf } from '../../../sources/bnf.js';
import type { FetchFn } from '../../../sources/http.js';
import { isbn13ToIsbn10 } from '../barcode.js';
import type { BarcodeProvider } from './types.js';

/**
 * BnF par ISBN : série et numéro de tome des BD francophones. Les anciennes notices n'ont que
 * l'ISBN-10 : on cherche les deux formes.
 */
export function createBnfProvider(fetchFn: FetchFn = fetch): BarcodeProvider {
  return {
    source: 'bnf',
    kinds: ['isbn'],
    async lookup(code) {
      const query = [code, isbn13ToIsbn10(code)]
        .filter((isbn) => isbn !== null)
        .map((isbn) => `bib.isbn adj "${isbn}"`)
        .join(' or ');
      const [record] = await searchBnf(query, 1, fetchFn);
      return record?.suggestion ?? null;
    },
  };
}
