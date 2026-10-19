import type { HealthResponse } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';
import compression from 'compression';
import express, { type ErrorRequestHandler } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { ZodError } from 'zod';

import { requireAuth } from './middleware.js';
import { createAuthRouter, SESSION_COOKIE } from './modules/auth/auth.routes.js';
import { createBarcodesRouter } from './modules/barcodes/barcodes.routes.js';
import { createDefaultProviders } from './modules/barcodes/providers/index.js';
import type { BarcodeProvider } from './modules/barcodes/providers/types.js';
import { createCopiesRouter } from './modules/copies/copies.routes.js';
import { createImages, type ImagesOptions } from './modules/images/index.js';
import { createListingsRouter } from './modules/listings/listings.routes.js';
import { createLlmProvider } from './modules/listings/llm/index.js';
import type { LlmProvider } from './modules/listings/llm/types.js';
import { createLoansRouter } from './modules/loans/loans.routes.js';
import { createSalesRouter } from './modules/sales/sales.routes.js';
import { createDefaultTitleSearchProviders } from './modules/titles/providers/index.js';
import type { TitleSearchProvider } from './modules/titles/providers/types.js';
import { createTitlesRouter } from './modules/titles/titles.routes.js';
import { SQLiteSessionStore } from './session-store.js';

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface AppOptions {
  /** Check de santé supplémentaire : renvoie une raison d'échec, ou null si OK. */
  healthExtraCheck?: () => string | null;
  /** Sources de résolution des codes-barres (par défaut : chaîne configurée par l'environnement). */
  barcodeProviders?: readonly BarcodeProvider[];
  /**
   * Stockage des images (pochettes, photos). Absent, les routes d'images ne sont pas montées :
   * `index.ts` le fournit toujours.
   */
  images?: ImagesOptions;
  /** Sources de recherche par titre (par défaut : chaîne configurée par l'environnement). */
  titleSearchProviders?: readonly TitleSearchProvider[];
  /** Fournisseur LLM des annonces (`null` : désactivé ; par défaut, celui configuré par l'environnement). */
  llmProvider?: LlmProvider | null;
  /**
   * Authentification par session. Sans elle l'API est ouverte (tests) : `index.ts` la fournit
   * toujours, et refuse de démarrer en production si la configuration est incomplète.
   */
  auth?: { sessionSecret: string; secureCookies: boolean };
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

  if (options.auth) {
    app.use(
      session({
        // Nom propre à l'appli : cookies et noms d'hôte sont partagés avec cash-ctrl sur le NAS.
        name: SESSION_COOKIE,
        store: new SQLiteSessionStore(db),
        secret: options.auth.sessionSecret,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
          httpOnly: true,
          secure: options.auth.secureCookies ? 'auto' : false,
          sameSite: 'lax',
          maxAge: SESSION_MAX_AGE_MS,
        },
      }),
    );
    app.use('/api/auth', createAuthRouter(db));
    // /api/health et /api/auth/* sont déclarés avant : tout le reste de l'API exige une session.
    app.use('/api', requireAuth);
    app.use(['/covers', '/photos'], requireAuth);
  }

  const images = options.images ? createImages(db, options.images) : null;
  if (images) {
    app.use('/covers', images.covers);
    app.use('/photos', images.photos);
  }

  app.use(
    '/api/barcodes',
    createBarcodesRouter(db, options.barcodeProviders ?? createDefaultProviders()),
  );
  app.use(
    '/api/titles',
    createTitlesRouter(options.titleSearchProviders ?? createDefaultTitleSearchProviders()),
  );
  app.use('/api/copies', createCopiesRouter(db, images?.copiesHooks));
  if (images) {
    app.use('/api', images.router);
  }
  app.use('/api', createLoansRouter(db));
  app.use('/api', createSalesRouter(db));
  app.use(
    '/api',
    createListingsRouter(
      db,
      options.llmProvider === undefined ? createLlmProvider() : options.llmProvider,
    ),
  );

  app.use(errorHandler);

  return app;
}
