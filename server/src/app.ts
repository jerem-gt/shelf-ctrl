import type { HealthResponse } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';

export interface AppOptions {
  /** Check de santé supplémentaire : renvoie une raison d'échec, ou null si OK. */
  healthExtraCheck?: () => string | null;
}

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

  return app;
}
