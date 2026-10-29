import type { Database } from 'better-sqlite3';
import { type Response, Router } from 'express';

import { currentUserId } from '../../middleware.js';
import { copyIdSchema } from '../copies/copies.schema.js';
import { listSchema, sellSchema, updateSaleSchema } from './sales.schema.js';
import { createSalesService, type SaleFailure, type SaleResult } from './sales.service.js';

const FAILURE_STATUS: Record<SaleFailure, number> = {
  not_found: 404,
  already_listed: 409,
  already_sold: 409,
  loaned: 409,
  invalid_date: 400,
};

/** Monté sur `/api` : `/copies/:id/sale` (annonce ou vente d'un exemplaire) et `/sales` (liste). */
export function createSalesRouter(db: Database) {
  const router = Router();
  const service = createSalesService(db);

  const respond = (res: Response, result: SaleResult, successStatus: number) => {
    if (result.ok) {
      res.status(successStatus).json(result.sale);
    } else {
      res.status(FAILURE_STATUS[result.reason]).json({ error: result.reason });
    }
  };

  router.get('/copies/:id/sale', (req, res) => {
    const sale = service.findForCopy(currentUserId(res), copyIdSchema.parse(req.params.id));
    if (sale === undefined) {
      res.status(404).json({ error: 'not_found' });
    } else {
      res.json(sale);
    }
  });

  router.post('/copies/:id/sale', (req, res) => {
    const input = listSchema.parse(req.body ?? {});
    respond(
      res,
      service.listForSale(currentUserId(res), copyIdSchema.parse(req.params.id), input),
      201,
    );
  });

  router.patch('/copies/:id/sale', (req, res) => {
    const input = updateSaleSchema.parse(req.body);
    respond(res, service.update(currentUserId(res), copyIdSchema.parse(req.params.id), input), 200);
  });

  router.post('/copies/:id/sale/sold', (req, res) => {
    const input = sellSchema.parse(req.body ?? {});
    respond(res, service.sell(currentUserId(res), copyIdSchema.parse(req.params.id), input), 200);
  });

  router.delete('/copies/:id/sale', (req, res) => {
    if (service.remove(currentUserId(res), copyIdSchema.parse(req.params.id))) {
      res.status(204).end();
    } else {
      res.status(404).json({ error: 'not_found' });
    }
  });

  router.get('/sales', (_req, res) => {
    res.json(service.listAll(currentUserId(res)));
  });

  return router;
}
