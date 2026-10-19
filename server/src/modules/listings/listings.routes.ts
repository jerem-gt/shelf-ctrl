import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { copyIdSchema } from '../copies/copies.schema.js';
import { createCopiesService } from '../copies/copies.service.js';
import { createListingsService, ListingGenerationError } from './listings.service.js';
import type { LlmProvider } from './llm/types.js';

const bodySchema = z.object({ platform: z.string().trim().min(1).max(100).nullish() });

/** Monté sur `/api` : `POST /copies/:id/listing-draft` génère un brouillon (rien n'est enregistré). */
export function createListingsRouter(db: Database, llm: LlmProvider | null) {
  const router = Router();
  const copies = createCopiesService(db);
  const service = llm ? createListingsService(llm) : null;

  router.post('/copies/:id/listing-draft', async (req, res) => {
    const copyId = copyIdSchema.parse(req.params.id);
    const { platform } = bodySchema.parse(req.body ?? {});

    if (!service) {
      res.status(503).json({ error: 'llm_not_configured' });
      return;
    }
    const copy = copies.findById(copyId);
    if (!copy) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    try {
      res.json(await service.generate(copy, platform ?? undefined));
    } catch (error) {
      if (!(error instanceof ListingGenerationError)) {
        throw error;
      }
      console.error(`[listings] ${error.message}`);
      res.status(502).json({ error: 'llm_failed' });
    }
  });

  return router;
}
