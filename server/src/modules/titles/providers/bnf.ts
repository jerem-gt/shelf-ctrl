import { searchBnf } from '../../../sources/bnf.js';
import type { FetchFn } from '../../../sources/http.js';
import { parseBarcode } from '../../barcodes/barcode.js';
import { titleResult } from './result.js';
import type { TitleSearchProvider } from './types.js';

const MAX_RECORDS = 10;

/** Les guillemets délimitent la requête CQL : on les retire plutôt que de les échapper. */
function toCqlTerms(query: string): string {
  return query.replaceAll(/["\\]/g, ' ').trim();
}

/** Recherche par titre dans le catalogue de la BnF, limitée aux textes imprimés (livres, BD). */
export function createBnfTitleSearch(fetchFn: FetchFn = fetch): TitleSearchProvider {
  return {
    source: 'bnf',
    kind: 'book',
    async search(query) {
      const terms = toCqlTerms(query);
      if (terms === '') {
        return [];
      }
      const records = await searchBnf(
        `bib.title all "${terms}" and bib.doctype any "a"`,
        MAX_RECORDS,
        fetchFn,
      );
      return records.map(({ suggestion, isbn }) => {
        const barcode = isbn ? parseBarcode(isbn) : null;
        return titleResult({ source: 'bnf', barcode: barcode?.code ?? null, ...suggestion });
      });
    },
  };
}
