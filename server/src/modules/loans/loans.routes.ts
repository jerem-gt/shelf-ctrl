import type { Database } from 'better-sqlite3';
import { type Response, Router } from 'express';

import { copyIdSchema } from '../copies/copies.schema.js';
import { lendSchema, returnSchema } from './loans.schema.js';
import { createLoansService, type LoanFailure, type LoanResult } from './loans.service.js';

const FAILURE_STATUS: Record<LoanFailure, number> = {
  not_found: 404,
  sold: 409,
  already_loaned: 409,
  already_returned: 409,
  invalid_date: 400,
};

/** Monté sur `/api` : les chemins mêlent `/copies/:id/loans`, `/loans` et `/borrowers`. */
export function createLoansRouter(db: Database) {
  const router = Router();
  const service = createLoansService(db);

  const respond = (res: Response, result: LoanResult, successStatus: number) => {
    if (result.ok) {
      res.status(successStatus).json(result.loan);
    } else {
      res.status(FAILURE_STATUS[result.reason]).json({ error: result.reason });
    }
  };

  router.get('/copies/:id/loans', (req, res) => {
    const loans = service.listForCopy(copyIdSchema.parse(req.params.id));
    if (loans) {
      res.json(loans);
    } else {
      res.status(404).json({ error: 'not_found' });
    }
  });

  router.post('/copies/:id/loans', (req, res) => {
    const input = lendSchema.parse(req.body);
    respond(res, service.lend(copyIdSchema.parse(req.params.id), input), 201);
  });

  router.get('/loans', (_req, res) => {
    res.json(service.listOpen());
  });

  router.post('/loans/:id/return', (req, res) => {
    const input = returnSchema.parse(req.body ?? {});
    respond(res, service.returnLoan(copyIdSchema.parse(req.params.id), input), 200);
  });

  router.get('/borrowers', (_req, res) => {
    res.json(service.listBorrowers());
  });

  return router;
}
