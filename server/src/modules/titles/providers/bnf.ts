import { parseBarcode } from '../../barcodes/barcode.js';
import { toSuggestion } from '../../barcodes/providers/bnf.js';
import { type FetchFn, fetchText } from '../../barcodes/providers/types.js';
import { parseUnimarcRecords, subfield } from '../../barcodes/providers/unimarc.js';
import type { TitleSearchProvider } from './types.js';

const SRU_URL = 'https://catalogue.bnf.fr/api/SRU';
const MAX_RECORDS = 10;

/** Les guillemets délimitent la requête CQL : on les retire plutôt que de les échapper. */
function toCqlTerms(query: string): string {
  return query.replaceAll(/["\\]/g, ' ').trim();
}

/** Recherche par titre dans le catalogue de la BnF, limitée aux textes imprimés (livres, BD). */
export function createBnfTitleSearch(fetchFn: FetchFn = fetch): TitleSearchProvider {
  return {
    source: 'bnf',
    async search(query) {
      const params = new URLSearchParams({
        version: '1.2',
        operation: 'searchRetrieve',
        maximumRecords: String(MAX_RECORDS),
        recordSchema: 'unimarcxchange',
        query: `bib.title all "${toCqlTerms(query)}" and bib.doctype any "a"`,
      });
      const records = parseUnimarcRecords(await fetchText(fetchFn, `${SRU_URL}?${params}`));

      return records.flatMap((fields) => {
        const suggestion = toSuggestion(fields);
        if (!suggestion) {
          return [];
        }
        const isbn = subfield(fields.get('010')?.[0], 'a');
        const barcode = isbn ? parseBarcode(isbn) : null;
        return [{ barcode: barcode?.code ?? null, source: 'bnf' as const, suggestion }];
      });
    },
  };
}
