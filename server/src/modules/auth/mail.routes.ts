import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import type { Mailer } from '../../lib/mailer.js';
import { MAIL_TEXTS } from '../../lib/mailTexts.js';
import { createRequireAdmin, currentUserId, requireAuth } from '../../middleware.js';
import type { AuthRepo } from './auth.repo.js';
import type { AuthLogger } from './auth.types.js';

export interface MailRouterDeps {
  db: Database;
  repo: AuthRepo;
  mailer: Mailer;
  log: AuthLogger;
}

/** E-mail de test envoyé à l'admin connecté : vérifie la configuration SMTP. */
export function createMailRouter(deps: MailRouterDeps): Router {
  const { db, repo, mailer, log } = deps;
  const router = Router();

  router.post('/test-email', requireAuth, createRequireAdmin(db), async (_req, res) => {
    const user = repo.getById(currentUserId(res));
    if (!user?.email) {
      res.status(400).json({ error: 'email_missing' });
      return;
    }
    if (!mailer.isConfigured()) {
      res.status(503).json({ error: 'smtp_not_configured' });
      return;
    }
    try {
      await mailer.send({ to: user.email, subject: MAIL_TEXTS.testSubject, text: MAIL_TEXTS.test });
    } catch (err) {
      log.error(`[auth] envoi de l'e-mail de test échoué : ${String(err)}`);
      res.status(502).json({ error: 'email_send_failed' });
      return;
    }
    res.status(204).end();
  });

  return router;
}
