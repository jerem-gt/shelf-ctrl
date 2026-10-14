import { z } from 'zod';

import { type BarcodeProvider, type FetchFn, fetchJson } from './types.js';
import { cleanVideoTitle, detectVideoFormat } from './video.js';

const responseSchema = z.object({
  code: z.string(),
  items: z.array(z.object({ title: z.string().min(1) })).optional(),
});

/**
 * UPCitemdb (offre gratuite, sans clé) : limitée en débit et en couverture, d'où le repli
 * en saisie manuelle. Ne donne qu'un intitulé produit, dont on déduit titre et format.
 */
export function createUpcItemDbProvider(fetchFn: FetchFn = fetch): BarcodeProvider {
  return {
    source: 'upcitemdb',
    kinds: ['ean'],
    async lookup(code) {
      const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`;
      const parsed = responseSchema.safeParse(await fetchJson(fetchFn, url));
      if (!parsed.success) {
        throw new Error('Réponse inattendue');
      }
      if (parsed.data.code !== 'OK') {
        throw new Error(parsed.data.code);
      }
      const title = parsed.data.items?.[0]?.title;
      if (!title) {
        return null;
      }

      return {
        work: {
          title: cleanVideoTitle(title),
          series: null,
          volumeNumber: null,
          creators: null,
          year: null,
        },
        edition: {
          format: detectVideoFormat(title),
          publisher: null,
          releaseYear: null,
          language: null,
        },
      };
    },
  };
}
