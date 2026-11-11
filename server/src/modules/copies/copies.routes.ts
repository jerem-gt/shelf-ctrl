import type { ConsoleListResponse, CopyItem } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { NotFoundError } from '../../lib/errors.js';
import { parseIdParam } from '../../lib/routeHelpers.js';
import { currentUserId } from '../../middleware.js';
import { createCopySchema, listCopiesSchema, updateCopySchema } from './copies.schema.js';
import { createCopiesService, type RemovedFiles } from './copies.service.js';

/** Réactions de modules voisins (images) aux créations et suppressions d'exemplaires. */
export interface CopiesHooks {
  onCreated?: (userId: number, copy: CopyItem) => void;
  onRemoved?: (files: RemovedFiles) => Promise<void>;
}

export function createCopiesRouter(db: Database, hooks: CopiesHooks = {}) {
  const router = Router();
  const service = createCopiesService(db);

  router.get('/', (req, res) => {
    res.json(service.list(currentUserId(res), listCopiesSchema.parse(req.query)));
  });

  // Avant `/:id` : « consoles » n'est pas un identifiant.
  router.get('/consoles', (_req, res) => {
    const body: ConsoleListResponse = { consoles: service.consoles(currentUserId(res)) };
    res.json(body);
  });

  router.post('/', (req, res) => {
    const userId = currentUserId(res);
    const copy = service.create(userId, createCopySchema.parse(req.body));
    hooks.onCreated?.(userId, copy);
    res.status(201).json(copy);
  });

  router.get('/:id', (req, res) => {
    const copy = service.findById(currentUserId(res), parseIdParam(req));
    if (!copy) {
      throw new NotFoundError('copy.not_found');
    }
    res.json(copy);
  });

  router.patch('/:id', (req, res) => {
    const copy = service.update(
      currentUserId(res),
      parseIdParam(req),
      updateCopySchema.parse(req.body),
    );
    if (!copy) {
      throw new NotFoundError('copy.not_found');
    }
    res.json(copy);
  });

  router.delete('/:id', async (req, res) => {
    const files = service.remove(currentUserId(res), parseIdParam(req));
    if (!files) {
      throw new NotFoundError('copy.not_found');
    }
    await hooks.onRemoved?.(files);
    res.status(204).end();
  });

  return router;
}
