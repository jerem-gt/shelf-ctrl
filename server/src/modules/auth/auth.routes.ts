import { createMailer, type Mailer } from '@jerem-gt/ctrl-shared/server/mailer';
import { FailureRateLimiter } from '@jerem-gt/ctrl-shared/server/rateLimit';
import type { SQLiteSessionStore } from '@jerem-gt/ctrl-shared/server/session-store';
import { SetupToken } from '@jerem-gt/ctrl-shared/server/setup';
import type { SessionResponse, SetupStatusResponse } from '@shelfctrl/types';
import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { type NextFunction, type Request, type Response, Router } from 'express';

import { ConflictError, HttpError } from '../../lib/errors.js';
import { currentUserId, requireAuth } from '../../middleware.js';
import { createUsersRepo } from '../users/users.repo.js';
import { BCRYPT_COST, createAuthRepo } from './auth.repo.js';
import { changePasswordSchema, loginSchema, profileSchema, setupSchema } from './auth.schema.js';
import type { AuthLogger, User } from './auth.types.js';
import { createMailRouter } from './mail.routes.js';
import { createPasswordRouter } from './password.routes.js';

export const SESSION_COOKIE = 'shelfctrl.sid';

// Hash factice, du même coût que les vrais, comparé quand l'identifiant est inconnu : égalise le
// temps de réponse pour ne pas révéler si le compte existe. Calculé à la première utilisation.
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('shelfctrl-unknown-user', BCRYPT_COST));

export function sessionResponse(user: User): SessionResponse {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.is_admin === 1,
  };
}

/** Régénère la session (anti-fixation) puis y pose l'utilisateur authentifié. */
function startSession(req: Request, res: Response, next: NextFunction, user: User): void {
  req.session.regenerate((regenerateError) => {
    if (regenerateError) {
      next(regenerateError);
      return;
    }
    req.session.userId = user.id;
    req.session.save((saveError) => {
      if (saveError) {
        next(saveError);
        return;
      }
      res.json(sessionResponse(user));
    });
  });
}

export interface AuthRouterOptions {
  mailer?: Mailer;
  setupToken?: SetupToken;
  /** URL publique de l'application (sans slash final), pour les liens des e-mails. */
  appUrl?: string;
  log?: AuthLogger;
  limiter?: FailureRateLimiter;
}

export function createAuthRouter(
  db: Database,
  sessionStore: SQLiteSessionStore,
  options: AuthRouterOptions = {},
): Router {
  const repo = createAuthRepo(db);
  const usersRepo = createUsersRepo(db);
  const router = Router();
  const limiter = options.limiter ?? new FailureRateLimiter(db);
  const mailer = options.mailer ?? createMailer();
  const setupToken = options.setupToken ?? new SetupToken();
  const log = options.log ?? console;

  /** Vérifie le mot de passe actuel, échecs limités ; lève 429/401 sinon. */
  async function checkCurrentPassword(user: User, candidate: string): Promise<void> {
    const key = `password:${user.id}`;
    if (!limiter.isAllowed(key)) {
      throw new HttpError(429, 'auth.too_many_attempts');
    }
    if (!(await bcrypt.compare(candidate, user.password_hash))) {
      limiter.recordFailure(key);
      throw new HttpError(401, 'auth.current_password_incorrect');
    }
    limiter.reset(key);
  }

  /** Le compte de la session ; supprimé entre-temps : 401. */
  function sessionUser(res: Response): User {
    const user = repo.getById(currentUserId(res));
    if (!user) {
      throw new HttpError(401, 'common.unauthorized');
    }
    return user;
  }

  router.get('/setup', (_req, res) => {
    const body: SetupStatusResponse = { required: repo.countUsers() === 0 };
    res.json(body);
  });

  router.post('/setup', async (req, res, next) => {
    if (repo.countUsers() > 0) {
      throw new ConflictError('auth.setup_done');
    }
    const key = `setup:${req.ip ?? 'unknown'}`;
    if (!limiter.isAllowed(key)) {
      throw new HttpError(429, 'auth.too_many_attempts');
    }
    const data = setupSchema.parse(req.body);
    if (!setupToken.verify(data.token)) {
      limiter.recordFailure(key);
      throw new HttpError(403, 'auth.setup_token_invalid');
    }

    const hash = await bcrypt.hash(data.password, BCRYPT_COST);
    // Revérifié dans la transaction : deux requêtes simultanées ne créent qu'un compte.
    const userId = db.transaction((): number | null =>
      repo.countUsers() > 0 ? null : repo.createAdmin(data.username, hash),
    )();
    if (userId === null) {
      throw new ConflictError('auth.setup_done');
    }
    setupToken.consume();
    limiter.reset(key);
    log.info(`[auth] premier compte créé : « ${data.username} » (admin)`);
    startSession(req, res, next, repo.getById(userId) as User);
  });

  router.post('/login', async (req, res, next) => {
    const key = req.ip ?? 'unknown';
    if (!limiter.isAllowed(key)) {
      throw new HttpError(429, 'auth.too_many_attempts');
    }
    const { username, password } = loginSchema.parse(req.body);
    const user = repo.getByUsername(username);
    const passwordOk = await bcrypt.compare(password, user?.password_hash ?? getDummyHash());
    if (!user || !passwordOk) {
      limiter.recordFailure(key);
      log.warn(`[auth] échec de connexion depuis ${key}`);
      throw new HttpError(401, 'auth.invalid_credentials');
    }
    limiter.reset(key);
    startSession(req, res, next, user);
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie(SESSION_COOKIE);
      res.status(204).end();
    });
  });

  router.get('/me', (req, res) => {
    const user = req.session?.userId ? repo.getById(req.session.userId) : undefined;
    if (!user) {
      throw new HttpError(401, 'common.unauthorized');
    }
    res.json(sessionResponse(user));
  });

  /** Nom d'utilisateur et e-mail : le mot de passe actuel est requis. */
  router.patch('/profile', requireAuth, async (req, res) => {
    const data = profileSchema.parse(req.body);
    const user = sessionUser(res);
    const userId = user.id;
    await checkCurrentPassword(user, data.currentPassword);

    const { username, email } = data;
    const usernameOwner = username === undefined ? undefined : usersRepo.getByUsername(username);
    if (usernameOwner && usernameOwner.id !== userId) {
      throw new ConflictError('user.username_taken');
    }
    const emailOwner = email ? usersRepo.getByEmail(email) : undefined;
    if (emailOwner && emailOwner.id !== userId) {
      throw new ConflictError('user.email_taken');
    }
    db.transaction(() => {
      if (username !== undefined) {
        usersRepo.updateUsername(userId, username);
      }
      if (email !== undefined) {
        usersRepo.updateEmail(userId, email);
      }
    })();
    res.json(sessionResponse(repo.getById(userId) as User));
  });

  /** Ferme les autres sessions du compte, garde la session courante. */
  router.post('/change-password', requireAuth, async (req, res) => {
    const data = changePasswordSchema.parse(req.body);
    const user = sessionUser(res);
    await checkCurrentPassword(user, data.current);
    repo.updatePassword(user.id, await bcrypt.hash(data.next, BCRYPT_COST));
    sessionStore.destroyOtherSessions(user.id, req.sessionID);
    res.status(204).end();
  });

  router.use(createPasswordRouter({ db, repo, sessionStore, mailer, appUrl: options.appUrl, log }));
  router.use(createMailRouter({ db, repo, mailer, log }));

  return router;
}
