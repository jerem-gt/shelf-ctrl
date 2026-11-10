import type { BarcodeSuggestion } from '@shelfctrl/types';
import { z } from 'zod';

import { detectConsole } from '../../../lib/consoles.js';
import { cleanGameTitle } from './game.js';
import { type BarcodeProvider, type FetchFn, fetchJson } from './types.js';
import { cleanVideoTitle, detectVideoFormat } from './video.js';

const responseSchema = z.object({
  code: z.string(),
  items: z
    .array(
      z.object({
        title: z.string().min(1),
        brand: z.string().optional(),
        category: z.string().optional(),
      }),
    )
    .optional(),
});

type Item = NonNullable<z.infer<typeof responseSchema>['items']>[number];

/**
 * Un jeu vidéo : ni DVD ni Blu-ray dans l'intitulé, et rangé parmi les jeux vidéo ou portant le
 * nom d'une console. La marque est alors l'éditeur du jeu (Nintendo, Ubisoft…).
 */
function toGameSuggestion(item: Item): BarcodeSuggestion | null {
  const gameConsole = detectConsole(item.title);
  if (gameConsole === null && !/video\s*games?/i.test(item.category ?? '')) {
    return null;
  }
  return {
    work: {
      title: cleanGameTitle(item.title),
      series: null,
      volumeNumber: null,
      creators: null,
      year: null,
    },
    edition: {
      format: 'game',
      publisher: item.brand?.trim() || null,
      releaseYear: null,
      language: null,
      console: gameConsole,
    },
  };
}

/**
 * UPCitemdb (offre gratuite, sans clé) : limitée en débit et en couverture, d'où le repli
 * en saisie manuelle. Ne donne qu'un intitulé produit (avec marque et catégorie), dont on déduit
 * titre et format : film (DVD, Blu-ray, 4K) ou jeu vidéo et sa console.
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
      const item = parsed.data.items?.[0];
      if (!item) {
        return null;
      }
      const { title } = item;
      const format = detectVideoFormat(title);
      const game = format === null ? toGameSuggestion(item) : null;
      if (game) {
        return game;
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
          format,
          publisher: null,
          releaseYear: null,
          language: null,
          console: null,
        },
      };
    },
  };
}
