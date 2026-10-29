import type { CopyItem } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { currentUserId } from '../../middleware.js';
import {
  copyIdSchema,
  createCopySchema,
  listCopiesSchema,
  updateCopySchema,
} from './copies.schema.js';
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

  router.post('/', (req, res) => {
    const userId = currentUserId(res);
    const copy = service.create(userId, createCopySchema.parse(req.body));
    hooks.onCreated?.(userId, copy);
    res.status(201).json(copy);
  });

  router.get('/:id', (req, res) => {
    const copy = service.findById(currentUserId(res), copyIdSchema.parse(req.params.id));
    if (copy) {
      res.json(copy);
    } else {
      res.status(404).json({ error: 'not_found' });
    }
  });

  router.patch('/:id', (req, res) => {
    const copy = service.update(
      currentUserId(res),
      copyIdSchema.parse(req.params.id),
      updateCopySchema.parse(req.body),
    );
    if (copy) {
      res.json(copy);
    } else {
      res.status(404).json({ error: 'not_found' });
    }
  });

  router.delete('/:id', async (req, res) => {
    const files = service.remove(currentUserId(res), copyIdSchema.parse(req.params.id));
    if (files) {
      await hooks.onRemoved?.(files);
      res.status(204).end();
    } else {
      res.status(404).json({ error: 'not_found' });
    }
  });

  return router;
}
