import { randomBytes } from 'node:crypto';

import { sha256Hex } from '@jerem-gt/ctrl-shared/server/crypto';
import type { Mailer } from '@jerem-gt/ctrl-shared/server/mailer';
import { FailureRateLimiter } from '@jerem-gt/ctrl-shared/server/rateLimit';
import type { SQLiteSessionStore } from '@jerem-gt/ctrl-shared/server/session-store';
import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { BadRequestError, HttpError } from '../../lib/errors.js';
import { MAIL_TEXTS } from '../../lib/mailTexts.js';
import { type AuthRepo, BCRYPT_COST } from './auth.repo.js';
import { emailSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema.js';
import type { AuthLogger, User } from './auth.types.js';

export interface PasswordRouterDeps {
  db: Database;
  repo: AuthRepo;
  sessionStore: SQLiteSessionStore;
  mailer: Mailer;
  /** URL publique de l'application, sans slash final (jamais déduite de l'en-tête Host). */
  appUrl: string | undefined;
  log: AuthLogger;
}

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const FORGOT_MAX_REQUESTS = 5;

/** Mot de passe oublié : lien à usage unique par e-mail (ou dans les logs, sans SMTP). */
export function createPasswordRouter(deps: PasswordRouterDeps): Router {
  const { db, repo, sessionStore, mailer, appUrl, log } = deps;
  const router = Router();
  const forgotLimiter = new FailureRateLimiter(db, FORGOT_MAX_REQUESTS);
  const resetLimiter = new FailureRateLimiter(db);

  function validResetToken(tokenHash: string) {
    const row = repo.getResetToken(tokenHash);
    return row && row.expires_at > Date.now() ? row : undefined;
  }

  function issueResetLink(user: User): void {
    const now = Date.now();
    repo.purgeExpiredResetTokens(now);
    repo.deleteResetTokensForUser(user.id);
    const token = randomBytes(32).toString('base64url');
    repo.insertResetToken(sha256Hex(token), user.id, now + RESET_TOKEN_TTL_MS);

    const path = `/reset-password?token=${token}`;
    const fallbackMessage = `[auth] réinitialisation du mot de passe de « ${user.username} » : ouvrir ${appUrl ?? ''}${path}`;
    if (mailer.isConfigured() && user.email && appUrl) {
      mailer
        .send({
          to: user.email,
          subject: MAIL_TEXTS.subject,
          text: MAIL_TEXTS.reset(`${appUrl}${path}`, RESET_TOKEN_TTL_MS / 60_000),
        })
        .catch((err: unknown) => {
          log.error(`[auth] envoi de l'e-mail de réinitialisation échoué : ${String(err)}`);
          log.warn(fallbackMessage);
        });
      return;
    }
    log.warn(fallbackMessage);
  }

  /** Réponse identique que le compte existe ou non : ne révèle ni les noms ni les e-mails. */
  router.post('/password/forgot', (req, res) => {
    const key = `forgot:${req.ip ?? 'unknown'}`;
    if (!forgotLimiter.isAllowed(key)) {
      throw new HttpError(429, 'auth.too_many_attempts');
    }
    // Chaque requête compte, qu'elle aboutisse ou non.
    forgotLimiter.recordFailure(key);

    const { identifier } = forgotPasswordSchema.parse(req.body);
    const email = emailSchema.safeParse(identifier);
    const user =
      repo.getByUsername(identifier) ?? (email.success ? repo.getByEmail(email.data) : undefined);
    if (user) {
      try {
        issueResetLink(user);
      } catch (err) {
        log.error(`[auth] création du lien de réinitialisation échouée : ${String(err)}`);
      }
    }
    res.status(204).end();
  });

  router.post('/password/reset', async (req, res) => {
    const key = `reset:${req.ip ?? 'unknown'}`;
    if (!resetLimiter.isAllowed(key)) {
      throw new HttpError(429, 'auth.too_many_attempts');
    }
    const data = resetPasswordSchema.parse(req.body);

    const tokenHash = sha256Hex(data.token);
    if (!validResetToken(tokenHash)) {
      resetLimiter.recordFailure(key);
      throw new BadRequestError('auth.reset_token_invalid');
    }

    // Haché après la vérification du jeton : un faux jeton ne coûte pas un bcrypt au serveur.
    const hash = await bcrypt.hash(data.password, BCRYPT_COST);
    // Revérifié dans la transaction : un jeton consommé pendant le hachage ne sert pas deux fois.
    const userId = db.transaction((): number | null => {
      const row = validResetToken(tokenHash);
      if (!row) {
        return null;
      }
      repo.updatePassword(row.user_id, hash);
      repo.deleteResetTokensForUser(row.user_id);
      return row.user_id;
    })();
    if (userId === null) {
      throw new BadRequestError('auth.reset_token_invalid');
    }
    sessionStore.destroyAllSessions(userId);
    resetLimiter.reset(key);
    res.status(204).end();
  });

  return router;
}
