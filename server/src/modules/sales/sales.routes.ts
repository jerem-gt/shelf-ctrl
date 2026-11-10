import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { parseIdParam } from '../../lib/routeHelpers.js';
import { currentUserId } from '../../middleware.js';
import { listSchema, sellSchema, updateSaleSchema } from './sales.schema.js';
import { createSalesService } from './sales.service.js';

/** Monté sur `/api` : `/copies/:id/sale` (annonce ou vente d'un exemplaire) et `/sales` (liste). */
export function createSalesRouter(db: Database) {
  const router = Router();
  const service = createSalesService(db);

  router.get('/copies/:id/sale', (req, res) => {
    res.json(service.findForCopy(currentUserId(res), parseIdParam(req)));
  });

  router.post('/copies/:id/sale', (req, res) => {
    const input = listSchema.parse(req.body ?? {});
    res.status(201).json(service.listForSale(currentUserId(res), parseIdParam(req), input));
  });

  router.patch('/copies/:id/sale', (req, res) => {
    const input = updateSaleSchema.parse(req.body);
    res.json(service.update(currentUserId(res), parseIdParam(req), input));
  });

  router.post('/copies/:id/sale/sold', (req, res) => {
    const input = sellSchema.parse(req.body ?? {});
    res.json(service.sell(currentUserId(res), parseIdParam(req), input));
  });

  router.delete('/copies/:id/sale', (req, res) => {
    service.remove(currentUserId(res), parseIdParam(req));
    res.status(204).end();
  });

  router.get('/sales', (_req, res) => {
    res.json(service.listAll(currentUserId(res)));
  });

  return router;
}
