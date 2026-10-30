import type { SQLiteSessionStore } from '@jerem-gt/ctrl-shared/server/session-store';
import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { createRequireAdmin, currentUserId } from '../../middleware.js';
import { BCRYPT_COST } from '../auth/auth.repo.js';
import type { AccountImages } from '../images/index.js';
import { createUsersRepo } from './users.repo.js';
import { createUserSchema, updateUserSchema, userIdSchema } from './users.schema.js';

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

  /** Lève 409 si le nom ou l'e-mail est déjà pris par un autre compte que `id` (null : création). */
  const assertIdentityFree = (
    id: number | null,
    username: string | undefined,
    email: string | null | undefined,
  ): void => {
    const usernameOwner = username === undefined ? undefined : repo.getByUsername(username);
    if (usernameOwner && usernameOwner.id !== id) {
      throw new ConflictError('user.username_taken');
    }
    const emailOwner = email ? repo.getByEmail(email) : undefined;
    if (emailOwner && emailOwner.id !== id) {
      throw new ConflictError('user.email_taken');
    }
  };

  /** Retirer le rôle admin (rétrogradation ou suppression) au dernier admin est refusé. */
  const assertNotLastAdmin = (id: number): void => {
    if (repo.getById(id)?.isAdmin === true && repo.countAdmins() <= 1) {
      throw new ConflictError('user.last_admin');
    }
  };

  const assertExists = (id: number): void => {
    if (!repo.getById(id)) {
      throw new NotFoundError('user.not_found');
    }
  };

  router.post('/', async (req, res) => {
    const { username, password, email = null, isAdmin = false } = createUserSchema.parse(req.body);
    assertIdentityFree(null, username, email);
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    // Revérifié après le hachage (asynchrone) : une requête concurrente a pu prendre le nom.
    const user = db.transaction(() => {
      assertIdentityFree(null, username, email);
      return repo.create(username, hash, email, isAdmin);
    })();
    res.status(201).json(user);
  });

  router.patch('/:id', async (req, res) => {
    const id = userIdSchema.parse(req.params.id);
    assertExists(id);
    const { username, password, email, isAdmin } = updateUserSchema.parse(req.body);
    const assertAllowed = () => {
      assertIdentityFree(id, username, email);
      if (isAdmin === false) {
        assertNotLastAdmin(id);
      }
    };

    assertAllowed();
    const hash = password === undefined ? null : await bcrypt.hash(password, BCRYPT_COST);
    // Revérifié dans la transaction, après le hachage : deux admins qui se rétrogradent l'un
    // l'autre en même temps ne laissent pas l'application sans admin.
    db.transaction(() => {
      assertAllowed();
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
    })();
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
    assertExists(id);
    if (id === currentUserId(res)) {
      throw new ConflictError('user.cannot_delete_self');
    }
    const files = db.transaction(() => {
      assertNotLastAdmin(id);
      return repo.remove(id);
    })();
    sessionStore.destroyAllSessions(id);
    await removeAccountImages?.(files);
    res.status(204).end();
  });

  return router;
}
