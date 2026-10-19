import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { copyIdSchema } from '../copies/copies.schema.js';
import {
  createPlatformSchema,
  setDefaultSchema,
  updatePlatformSchema,
} from './platforms.schema.js';
import { createPlatformsService, type PlatformFailure } from './platforms.service.js';

const FAILURE_STATUS: Record<PlatformFailure, number> = { not_found: 404, duplicate: 409 };

/** Monté sur `/api/platforms` : les plateformes de vente du compte et celle par défaut. */
export function createPlatformsRouter(db: Database) {
  const router = Router();
  const service = createPlatformsService(db);

  router.get('/', (_req, res) => {
    res.json({ items: service.list() });
  });

  router.post('/', (req, res) => {
    const result = service.create(createPlatformSchema.parse(req.body));
    if (result.ok) {
      res.status(201).json(result.platform);
    } else {
      res.status(FAILURE_STATUS[result.reason]).json({ error: result.reason });
    }
  });

  // Avant `/:id` : « default » ne doit pas être lu comme un identifiant.
  router.put('/default', (req, res) => {
    if (service.setDefault(setDefaultSchema.parse(req.body).id)) {
      res.status(204).end();
    } else {
      res.status(404).json({ error: 'not_found' });
    }
  });

  router.patch('/:id', (req, res) => {
    const result = service.update(
      copyIdSchema.parse(req.params.id),
      updatePlatformSchema.parse(req.body),
    );
    if (result.ok) {
      res.json(result.platform);
    } else {
      res.status(FAILURE_STATUS[result.reason]).json({ error: result.reason });
    }
  });

  router.delete('/:id', (req, res) => {
    if (service.remove(copyIdSchema.parse(req.params.id))) {
      res.status(204).end();
    } else {
      res.status(404).json({ error: 'not_found' });
    }
  });

  return router;
}
