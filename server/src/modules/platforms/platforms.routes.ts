import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { currentUserId } from '../../middleware.js';
import { copyIdSchema } from '../copies/copies.schema.js';
import {
  createPlatformSchema,
  setDefaultSchema,
  updatePlatformSchema,
} from './platforms.schema.js';
import { createPlatformsService } from './platforms.service.js';

/** Monté sur `/api/platforms` : les plateformes de vente du compte et celle par défaut. */
export function createPlatformsRouter(db: Database) {
  const router = Router();
  const service = createPlatformsService(db);

  router.get('/', (_req, res) => {
    res.json({ items: service.list(currentUserId(res)) });
  });

  router.post('/', (req, res) => {
    res.status(201).json(service.create(currentUserId(res), createPlatformSchema.parse(req.body)));
  });

  // Avant `/:id` : « default » ne doit pas être lu comme un identifiant.
  router.put('/default', (req, res) => {
    service.setDefault(currentUserId(res), setDefaultSchema.parse(req.body).id);
    res.status(204).end();
  });

  router.patch('/:id', (req, res) => {
    res.json(
      service.update(
        currentUserId(res),
        copyIdSchema.parse(req.params.id),
        updatePlatformSchema.parse(req.body),
      ),
    );
  });

  router.delete('/:id', (req, res) => {
    service.remove(currentUserId(res), copyIdSchema.parse(req.params.id));
    res.status(204).end();
  });

  return router;
}
