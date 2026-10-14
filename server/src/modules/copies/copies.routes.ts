import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import {
  copyIdSchema,
  createCopySchema,
  listCopiesSchema,
  updateCopySchema,
} from './copies.schema.js';
import { createCopiesService } from './copies.service.js';

export function createCopiesRouter(db: Database) {
  const router = Router();
  const service = createCopiesService(db);

  router.get('/', (req, res) => {
    res.json(service.list(listCopiesSchema.parse(req.query)));
  });

  router.post('/', (req, res) => {
    res.status(201).json(service.create(createCopySchema.parse(req.body)));
  });

  router.get('/:id', (req, res) => {
    const copy = service.findById(copyIdSchema.parse(req.params.id));
    if (copy) {
      res.json(copy);
    } else {
      res.status(404).json({ error: 'not_found' });
    }
  });

  router.patch('/:id', (req, res) => {
    const copy = service.update(
      copyIdSchema.parse(req.params.id),
      updateCopySchema.parse(req.body),
    );
    if (copy) {
      res.json(copy);
    } else {
      res.status(404).json({ error: 'not_found' });
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
