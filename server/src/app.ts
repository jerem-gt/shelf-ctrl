import { type AuthLogger, createAuthModule } from '@jerem-gt/ctrl-shared/server/auth';
import { createErrorHandler } from '@jerem-gt/ctrl-shared/server/errorHandler';
import type { Mailer } from '@jerem-gt/ctrl-shared/server/mailer';
import { SQLiteSessionStore } from '@jerem-gt/ctrl-shared/server/session-store';
import type { SetupToken } from '@jerem-gt/ctrl-shared/server/setup';
import type { HealthResponse } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';
import compression from 'compression';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';

import { errorRegistry } from './lib/errorCodes.js';
import { HttpError } from './lib/errors.js';
import { actAs } from './middleware.js';
import { SESSION_COOKIE, shelfAuthOptions } from './modules/accounts/accounts.js';
import { parseBarcode } from './modules/barcodes/barcode.js';
import { createBarcodesRouter } from './modules/barcodes/barcodes.routes.js';
import { createBarcodesService } from './modules/barcodes/barcodes.service.js';
import { createDefaultProviders } from './modules/barcodes/providers/index.js';
import type { BarcodeProvider } from './modules/barcodes/providers/types.js';
import { createCopiesRouter } from './modules/copies/copies.routes.js';
import { createImages, type ImagesOptions } from './modules/images/index.js';
import { createImportRouter } from './modules/import/import.routes.js';
import { createLoansRouter } from './modules/loans/loans.routes.js';
import { createPlatformsRouter } from './modules/platforms/platforms.routes.js';
import { createSalesRouter } from './modules/sales/sales.routes.js';
import { createDefaultTitleSearchProviders } from './modules/titles/providers/index.js';
import type { TitleSearchProvider } from './modules/titles/providers/types.js';
import { createTitlesRouter } from './modules/titles/titles.routes.js';
import { createDocsRouter } from './openapi/router.js';

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
  /**
   * Authentification par session. Sans elle l'API est ouverte et agit pour le compte `actAsUserId`
   * (tests) : `index.ts` la fournit toujours, et refuse de démarrer en production sans secret.
   */
  auth?: AuthOptions;
  /** Sans `auth` : compte pour lequel agissent les requêtes (1 par défaut). */
  actAsUserId?: number;
}

export interface AuthOptions {
  sessionSecret: string;
  secureCookies: boolean;
  /** URL publique de l'application, sans slash final, pour les liens des e-mails. */
  appUrl?: string;
  /** Envoi des e-mails (par défaut : SMTP lu dans l'environnement). */
  mailer?: Mailer;
  /** Jeton de création du premier compte (par défaut : un nouveau, inconnu des logs). */
  setupToken?: SetupToken;
  log?: AuthLogger;
}

const IS_TEST = process.env.NODE_ENV === 'test';

/**
 * Gestionnaire d'erreur global de ctrl-shared (HttpError, Zod, lecteurs de corps, 500) : les 4xx
 * en avertissement (muets en test), les 500 avec leur pile.
 */
const errorHandler = createErrorHandler({
  HttpError,
  registry: errorRegistry,
  log: {
    warn: (msg) => {
      if (!IS_TEST) console.warn(msg);
    },
    error: (msg) => console.error(msg),
  },
});

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

  // Documentation de l'API (Swagger UI et spec), publique comme dans cash-ctrl : aucune donnée.
  app.use('/api/docs', createDocsRouter());

  const images = options.images ? createImages(db, options.images) : null;

  if (options.auth) {
    const sessionStore = new SQLiteSessionStore(db);
    app.use(
      session({
        // Nom propre à l'appli : cookies et noms d'hôte sont partagés avec cash-ctrl sur le NAS.
        name: SESSION_COOKIE,
        store: sessionStore,
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
    const { secureCookies, mailer, setupToken, appUrl, log } = options.auth;
    const auth = createAuthModule(
      db,
      sessionStore,
      shelfAuthOptions(db, {
        secureCookies,
        mailer,
        setupToken,
        appUrl,
        log,
        removeAccountImages: images?.removeAccountImages,
      }),
    );
    app.use('/api/auth', auth.authRouter);
    // /api/health, /api/docs et /api/auth/* sont déclarés avant : tout le reste de l'API exige une session.
    app.use('/api', auth.requireAuth);
    app.use(['/covers', '/photos'], auth.requireAuth);
    app.use('/api/users', auth.usersRouter);
  } else {
    app.use(['/api', '/covers', '/photos'], actAs(options.actAsUserId ?? 1));
  }

  if (images) {
    app.use('/covers', images.covers);
    app.use('/photos', images.photos);
  }

  const barcodeProviders = options.barcodeProviders ?? createDefaultProviders();
  app.use('/api/barcodes', createBarcodesRouter(db, barcodeProviders));
  app.use(
    '/api/titles',
    createTitlesRouter(options.titleSearchProviders ?? createDefaultTitleSearchProviders()),
  );
  app.use('/api/copies', createCopiesRouter(db, images?.copiesHooks));
  if (images) {
    app.use('/api', images.router);
  }
  const barcodes = createBarcodesService(db, barcodeProviders);
  app.use(
    '/api/import',
    createImportRouter(db, {
      resolve: (userId, code) => {
        const parsed = parseBarcode(code);
        return parsed ? barcodes.resolve(userId, parsed) : Promise.resolve(null);
      },
      fetchCover: images?.fetchCover,
    }),
  );
  app.use('/api', createLoansRouter(db));
  app.use('/api', createSalesRouter(db));
  app.use('/api/platforms', createPlatformsRouter(db));

  app.use(errorHandler);

  return app;
}
