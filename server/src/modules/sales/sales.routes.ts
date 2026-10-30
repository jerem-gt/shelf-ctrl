import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { currentUserId } from '../../middleware.js';
import { copyIdSchema } from '../copies/copies.schema.js';
import { listSchema, sellSchema, updateSaleSchema } from './sales.schema.js';
import { createSalesService } from './sales.service.js';

/** Monté sur `/api` : `/copies/:id/sale` (annonce ou vente d'un exemplaire) et `/sales` (liste). */
export function createSalesRouter(db: Database) {
  const router = Router();
  const service = createSalesService(db);

  router.get('/copies/:id/sale', (req, res) => {
    res.json(service.findForCopy(currentUserId(res), copyIdSchema.parse(req.params.id)));
  });

  router.post('/copies/:id/sale', (req, res) => {
    const input = listSchema.parse(req.body ?? {});
    res
      .status(201)
      .json(service.listForSale(currentUserId(res), copyIdSchema.parse(req.params.id), input));
  });

  router.patch('/copies/:id/sale', (req, res) => {
    const input = updateSaleSchema.parse(req.body);
    res.json(service.update(currentUserId(res), copyIdSchema.parse(req.params.id), input));
  });

  router.post('/copies/:id/sale/sold', (req, res) => {
    const input = sellSchema.parse(req.body ?? {});
    res.json(service.sell(currentUserId(res), copyIdSchema.parse(req.params.id), input));
  });

  router.delete('/copies/:id/sale', (req, res) => {
    service.remove(currentUserId(res), copyIdSchema.parse(req.params.id));
    res.status(204).end();
  });

  router.get('/sales', (_req, res) => {
    res.json(service.listAll(currentUserId(res)));
  });

  return router;
}
