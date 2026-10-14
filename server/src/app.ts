import type { HealthResponse } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';
import compression from 'compression';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';

import { createBarcodesRouter } from './modules/barcodes/barcodes.routes.js';
import { createDefaultProviders } from './modules/barcodes/providers/index.js';
import type { BarcodeProvider } from './modules/barcodes/providers/types.js';
import { createCopiesRouter } from './modules/copies/copies.routes.js';
import { createLoansRouter } from './modules/loans/loans.routes.js';
import { createSalesRouter } from './modules/sales/sales.routes.js';

export interface AppOptions {
  /** Check de santé supplémentaire : renvoie une raison d'échec, ou null si OK. */
  healthExtraCheck?: () => string | null;
  /** Sources de résolution des codes-barres (par défaut : chaîne configurée par l'environnement). */
  barcodeProviders?: readonly BarcodeProvider[];
}

function isClientError(err: unknown): err is { status: number } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  );
}

// 4 params requis pour qu'Express reconnaisse le gestionnaire d'erreur (fn.length === 4)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'validation',
      issues: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
    return;
  }
  if (isClientError(err)) {
    res.status(err.status).json({ error: 'bad_request' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal' });
};

export function createApp(db: Database, options: AppOptions = {}) {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
    } catch {
      res.status(503).json({ status: 'error', reason: 'database' });
      return;
    }
    const reason = options.healthExtraCheck?.() ?? null;
    if (reason) {
      res.status(503).json({ status: 'error', reason });
      return;
    }
    const body: HealthResponse = { status: 'ok' };
    res.json(body);
  });

  app.use(
    '/api/barcodes',
    createBarcodesRouter(db, options.barcodeProviders ?? createDefaultProviders()),
  );
  app.use('/api/copies', createCopiesRouter(db));
  app.use('/api', createLoansRouter(db));
  app.use('/api', createSalesRouter(db));

  app.use(errorHandler);

  return app;
}
