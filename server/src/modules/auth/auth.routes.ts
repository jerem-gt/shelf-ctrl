import type { SessionResponse } from '@shelfctrl/types';
import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';
import { z } from 'zod';

import { FailureRateLimiter } from '../../lib/rateLimit.js';
import { BCRYPT_COST, createAuthRepo } from './auth.repo.js';

export const SESSION_COOKIE = 'shelfctrl.sid';

export const loginSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

// Hash factice, du même coût que les vrais, comparé quand l'identifiant est inconnu : égalise le
// temps de réponse pour ne pas révéler si le compte existe. Calculé à la première utilisation.
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('shelfctrl-unknown-user', BCRYPT_COST));

export function createAuthRouter(db: Database, limiter = new FailureRateLimiter(db)): Router {
  const repo = createAuthRepo(db);
  const router = Router();

  router.post('/login', async (req, res, next) => {
    const key = req.ip ?? 'unknown';
    if (!limiter.isAllowed(key)) {
      res.status(429).json({ error: 'too_many_attempts' });
      return;
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'validation' });
      return;
    }

    const { username, password } = parsed.data;
    const user = repo.getByUsername(username);
    const passwordOk = await bcrypt.compare(password, user?.password_hash ?? getDummyHash());
    if (!user || !passwordOk) {
      limiter.recordFailure(key);
      console.warn(`[auth] échec de connexion depuis ${key}`);
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    limiter.reset(key);
    // Nouvelle session à chaque connexion : empêche la fixation de session.
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
        const body: SessionResponse = { username: user.username };
        res.json(body);
      });
    });
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
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const body: SessionResponse = { username: user.username };
    res.json(body);
  });

  return router;
}
