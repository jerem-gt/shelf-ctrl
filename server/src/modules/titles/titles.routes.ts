import { MEDIA_KINDS, type TitleSearchResponse, type TitleSearchResult } from '@shelfctrl/types';
import { Router } from 'express';
import { z } from 'zod';

import type { TitleSearchProvider } from './providers/types.js';

const MAX_RESULTS = 20;

export const querySchema = z.object({
  q: z.string().trim().min(2).max(100),
  /** Type de média cherché ; sans type, toutes les sources sont interrogées. */
  kind: z.enum(MEDIA_KINDS).optional(),
});

/** Un résultat de chaque source à tour de rôle : aucune ne monopolise la liste tronquée. */
function interleave(lists: TitleSearchResult[][]): TitleSearchResult[] {
  const merged: TitleSearchResult[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index++) {
    for (const list of lists) {
      if (index < list.length) {
        merged.push(list[index]);
      }
    }
  }
  return merged;
}

/** Même édition : même code-barres. Sans code, même titre et même année (casse ignorée). */
function identityOf({ barcode, suggestion }: TitleSearchResult): string {
  if (barcode !== null) {
    return `code:${barcode}`;
  }
  const { title, year } = suggestion.work;
  return `titre:${title.trim().toLowerCase()}|${year ?? ''}`;
}

/** Garde la première occurrence de chaque édition. */
function dedupe(results: TitleSearchResult[]): TitleSearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const identity = identityOf(result);
    if (seen.has(identity)) {
      return false;
    }
    seen.add(identity);
    return true;
  });
}

/**
 * Monté sur `/api/titles` : `GET /search?q=&kind=` interroge en parallèle les sources du type
 * demandé (livres, films ou jeux vidéo), toutes sans type.
 * Une source en erreur est ignorée ; sans résultat, la liste est vide (pas de 404).
 */
export function createTitlesRouter(providers: readonly TitleSearchProvider[]) {
  const router = Router();

  router.get('/search', async (req, res) => {
    const { q, kind } = querySchema.parse(req.query);
    const selected = providers.filter((provider) => kind === undefined || provider.kind === kind);
    const settled = await Promise.allSettled(selected.map((provider) => provider.search(q)));

    const lists: TitleSearchResult[][] = [];
    settled.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') {
        lists.push(outcome.value);
      } else {
        const reason = outcome.reason instanceof Error ? outcome.reason.message : 'erreur inconnue';
        console.warn(`[titles] ${selected[index].source} : ${reason}`);
      }
    });

    const body: TitleSearchResponse = { results: dedupe(interleave(lists)).slice(0, MAX_RESULTS) };
    res.json(body);
  });

  return router;
}
