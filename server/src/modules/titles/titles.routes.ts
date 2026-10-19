import type { TitleSearchResponse, TitleSearchResult } from '@shelfctrl/types';
import { Router } from 'express';
import { z } from 'zod';

import type { TitleSearchProvider } from './providers/types.js';

const MAX_RESULTS = 20;

const querySchema = z.object({ q: z.string().trim().min(2).max(100) });

/** Garde la première occurrence de chaque code-barres ; les résultats sans code sont conservés. */
function dedupe(results: TitleSearchResult[]): TitleSearchResult[] {
  const seen = new Set<string>();
  return results.filter(({ barcode }) => {
    if (barcode === null) {
      return true;
    }
    if (seen.has(barcode)) {
      return false;
    }
    seen.add(barcode);
    return true;
  });
}

/**
 * Monté sur `/api/titles` : `GET /search?q=` interroge toutes les sources en parallèle.
 * Une source en erreur est ignorée ; sans résultat, la liste est vide (pas de 404).
 */
export function createTitlesRouter(providers: readonly TitleSearchProvider[]) {
  const router = Router();

  router.get('/search', async (req, res) => {
    const { q } = querySchema.parse(req.query);
    const settled = await Promise.allSettled(providers.map((provider) => provider.search(q)));

    const results: TitleSearchResult[] = [];
    settled.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') {
        results.push(...outcome.value);
      } else {
        const reason = outcome.reason instanceof Error ? outcome.reason.message : 'erreur inconnue';
        console.warn(`[titles] ${providers[index].source} : ${reason}`);
      }
    });

    const body: TitleSearchResponse = { results: dedupe(results).slice(0, MAX_RESULTS) };
    res.json(body);
  });

  return router;
}
