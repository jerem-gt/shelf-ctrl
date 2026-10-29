import type { UserItem } from '@shelfctrl/types';
import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { createRequireAdmin, currentUserId } from '../../middleware.js';
import type { SQLiteSessionStore } from '../../session-store.js';
import { BCRYPT_COST } from '../auth/auth.repo.js';
import type { AccountImages } from '../images/index.js';
import { createUsersRepo } from './users.repo.js';
import { createUserSchema, updateUserSchema, userIdSchema } from './users.schema.js';

type UserConflict = 'username_taken' | 'email_taken' | 'last_admin';

export interface UsersRouterDeps {
  sessionStore: SQLiteSessionStore;
  /** Efface les fichiers d'image d'un compte supprimé (absent : pas de stockage d'images). */
  removeAccountImages?: (files: AccountImages) => Promise<void>;
}

/** Monté sur `/api/users`, réservé aux admins : gestion des comptes. */
export function createUsersRouter(db: Database, deps: UsersRouterDeps): Router {
  const { sessionStore, removeAccountImages } = deps;
  const repo = createUsersRepo(db);
  const router = Router();

  router.use(createRequireAdmin(db));

  router.get('/', (_req, res) => {
    res.json({ items: repo.list() });
  });

  /** Nom ou e-mail déjà pris par un autre compte que `id` (null : création). */
  const identityConflict = (
    id: number | null,
    username: string | undefined,
    email: string | null | undefined,
  ): UserConflict | null => {
    const usernameOwner = username === undefined ? undefined : repo.getByUsername(username);
    if (usernameOwner && usernameOwner.id !== id) {
      return 'username_taken';
    }
    const emailOwner = email ? repo.getByEmail(email) : undefined;
    if (emailOwner && emailOwner.id !== id) {
      return 'email_taken';
    }
    return null;
  };

  /** Retirer le rôle admin (rétrogradation ou suppression) au dernier admin est refusé. */
  const removesLastAdmin = (id: number): boolean =>
    repo.getById(id)?.isAdmin === true && repo.countAdmins() <= 1;

  router.post('/', async (req, res) => {
    const { username, password, email = null, isAdmin = false } = createUserSchema.parse(req.body);
    const early = identityConflict(null, username, email);
    if (early !== null) {
      res.status(409).json({ error: early });
      return;
    }
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    // Revérifié après le hachage (asynchrone) : une requête concurrente a pu prendre le nom.
    const result = db.transaction((): { user: UserItem } | { conflict: UserConflict } => {
      const late = identityConflict(null, username, email);
      if (late !== null) {
        return { conflict: late };
      }
      return { user: repo.create(username, hash, email, isAdmin) };
    })();
    if ('conflict' in result) {
      res.status(409).json({ error: result.conflict });
      return;
    }
    res.status(201).json(result.user);
  });

  router.patch('/:id', async (req, res) => {
    const id = userIdSchema.parse(req.params.id);
    if (!repo.getById(id)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const { username, password, email, isAdmin } = updateUserSchema.parse(req.body);
    const conflictOf = (): UserConflict | null =>
      identityConflict(id, username, email) ??
      (isAdmin === false && removesLastAdmin(id) ? 'last_admin' : null);

    const early = conflictOf();
    if (early !== null) {
      res.status(409).json({ error: early });
      return;
    }
    const hash = password === undefined ? null : await bcrypt.hash(password, BCRYPT_COST);
    // Revérifié dans la transaction, après le hachage : deux admins qui se rétrogradent l'un
    // l'autre en même temps ne laissent pas l'application sans admin.
    const conflict = db.transaction((): UserConflict | null => {
      const late = conflictOf();
      if (late !== null) {
        return late;
      }
      if (username !== undefined) {
        repo.updateUsername(id, username);
      }
      if (email !== undefined) {
        repo.updateEmail(id, email);
      }
      if (isAdmin !== undefined) {
        repo.updateAdmin(id, isAdmin);
      }
      if (hash !== null) {
        repo.updatePassword(id, hash);
      }
      return null;
    })();
    if (conflict !== null) {
      res.status(409).json({ error: conflict });
      return;
    }
    // Mot de passe changé : son propre compte garde la session courante, un autre les perd toutes.
    if (hash !== null) {
      if (id === currentUserId(res)) {
        sessionStore.destroyOtherSessions(id, req.sessionID);
      } else {
        sessionStore.destroyAllSessions(id);
      }
    }
    res.json(repo.getById(id));
  });

  router.delete('/:id', async (req, res) => {
    const id = userIdSchema.parse(req.params.id);
    if (!repo.getById(id)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (id === currentUserId(res)) {
      res.status(409).json({ error: 'cannot_delete_self' });
      return;
    }
    const files = db.transaction(() => (removesLastAdmin(id) ? null : repo.remove(id)))();
    if (files === null) {
      res.status(409).json({ error: 'last_admin' });
      return;
    }
    sessionStore.destroyAllSessions(id);
    await removeAccountImages?.(files);
    res.status(204).end();
  });

  return router;
}
