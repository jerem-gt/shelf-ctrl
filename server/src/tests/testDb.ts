import bcrypt from 'bcrypt';

import { createDb, initDatabase } from '../db/init.js';

/** Coût bcrypt minimal : les tests n'ont pas besoin de la lenteur de la production. */
export const TEST_BCRYPT_COST = 4;

/** Base en mémoire, schéma et migrations appliqués, sans aucun compte. */
export function createTestDb() {
  const db = createDb(':memory:');
  initDatabase(db);
  return db;
}

export type TestDb = ReturnType<typeof createTestDb>;

interface TestUserOptions {
  password?: string;
  email?: string | null;
  isAdmin?: boolean;
}

/** Crée un compte et renvoie son id ; mot de passe « password » par défaut. */
export function addTestUser(db: TestDb, username: string, options: TestUserOptions = {}): number {
  const { password = 'password', email = null, isAdmin = false } = options;
  return Number(
    db
      .prepare('INSERT INTO users (username, password_hash, email, is_admin) VALUES (?, ?, ?, ?)')
      .run(username, bcrypt.hashSync(password, TEST_BCRYPT_COST), email, isAdmin ? 1 : 0)
      .lastInsertRowid,
  );
}

/**
 * Base avec un compte admin (id 1) : celui pour lequel agit une application créée sans
 * authentification (`createApp(db)`), comme dans la plupart des tests de modules.
 */
export function createTestDbWithUser() {
  const db = createTestDb();
  const userId = addTestUser(db, 'admin', { isAdmin: true });
  return { db, userId };
}
