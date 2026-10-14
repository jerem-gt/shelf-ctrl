import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';

export interface User {
  id: number;
  username: string;
  password_hash: string;
}

export const BCRYPT_COST = 12;

export function createAuthRepo(db: Database) {
  return {
    getByUsername: (username: string): User | undefined =>
      db
        .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
        .get(username) as User | undefined,
    getById: (id: number): User | undefined =>
      db.prepare('SELECT id, username, password_hash FROM users WHERE id = ?').get(id) as
        User | undefined,
  };
}

export type SyncResult = 'created' | 'updated' | 'unchanged';

/**
 * Aligne l'unique compte sur ADMIN_USER / ADMIN_PASSWORD : l'environnement fait foi, donc changer
 * le mot de passe dans le compose et redémarrer suffit. Aucune interface ne modifie le compte.
 */
export function syncAdminUser(
  db: Database,
  username: string,
  password: string,
  cost = BCRYPT_COST,
): SyncResult {
  const existing = db
    .prepare('SELECT id, username, password_hash FROM users ORDER BY id LIMIT 1')
    .get() as User | undefined;

  if (!existing) {
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
      username,
      bcrypt.hashSync(password, cost),
    );
    return 'created';
  }

  const samePassword = bcrypt.compareSync(password, existing.password_hash);
  if (existing.username === username && samePassword) {
    return 'unchanged';
  }
  db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(
    username,
    samePassword ? existing.password_hash : bcrypt.hashSync(password, cost),
    existing.id,
  );
  // Identifiants changés : les sessions ouvertes avec les anciens ne doivent plus valoir.
  db.prepare('DELETE FROM sessions').run();
  return 'updated';
}
