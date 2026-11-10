import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { parseIdParam } from '../../lib/routeHelpers.js';
import { currentUserId } from '../../middleware.js';
import { lendSchema, returnSchema } from './loans.schema.js';
import { createLoansService } from './loans.service.js';

/** Monté sur `/api` : les chemins mêlent `/copies/:id/loans`, `/loans` et `/borrowers`. */
export function createLoansRouter(db: Database) {
  const router = Router();
  const service = createLoansService(db);

  router.get('/copies/:id/loans', (req, res) => {
    res.json(service.listForCopy(currentUserId(res), parseIdParam(req)));
  });

  router.post('/copies/:id/loans', (req, res) => {
    const input = lendSchema.parse(req.body);
    res.status(201).json(service.lend(currentUserId(res), parseIdParam(req), input));
  });

  router.get('/loans', (_req, res) => {
    res.json(service.listOpen(currentUserId(res)));
  });

  router.post('/loans/:id/return', (req, res) => {
    const input = returnSchema.parse(req.body ?? {});
    res.json(service.returnLoan(currentUserId(res), parseIdParam(req), input));
  });

  router.get('/borrowers', (_req, res) => {
    res.json(service.listBorrowers(currentUserId(res)));
  });

  return router;
}
