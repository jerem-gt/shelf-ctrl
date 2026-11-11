import { MEDIA_KINDS } from '@shelfctrl/types';
import { Router } from 'express';
import { z } from 'zod';

import type { TitleSearchProvider } from './providers/types.js';
import { createTitlesService } from './titles.service.js';

export const querySchema = z.object({
  q: z.string().trim().min(2).max(100),
  /** Type de média cherché ; sans type, toutes les sources sont interrogées. */
  kind: z.enum(MEDIA_KINDS).optional(),
});

/** Monté sur `/api/titles` : `GET /search?q=&kind=` (voir `createTitlesService`). */
export function createTitlesRouter(providers: readonly TitleSearchProvider[]) {
  const router = Router();
  const service = createTitlesService(providers);

  router.get('/search', async (req, res) => {
    const { q, kind } = querySchema.parse(req.query);
    res.json(await service.search(q, kind));
  });

  return router;
}
