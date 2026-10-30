import type { UserItem } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';

import type { AccountImages } from '../images/index.js';

interface UserRow {
  id: number;
  username: string;
  email: string | null;
  is_admin: number;
  totp_enabled: number;
  created_at: string;
  copy_count: number;
  last_copy_at: string | null;
}

function toUserItem(row: UserRow): UserItem {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    isAdmin: row.is_admin === 1,
    totpEnabled: row.totp_enabled === 1,
    createdAt: row.created_at,
    copyCount: row.copy_count,
    lastCopyAt: row.last_copy_at,
  };
}

const SELECT_USERS = `
  SELECT u.id, u.username, u.email, u.is_admin, u.totp_enabled, u.created_at,
         COUNT(c.id) AS copy_count, MAX(c.created_at) AS last_copy_at
  FROM users u
  LEFT JOIN copies c ON c.user_id = u.id`;

export function createUsersRepo(db: Database) {
  const listStmt = db.prepare<[], UserRow>(`${SELECT_USERS} GROUP BY u.id ORDER BY u.id`);
  const getByIdStmt = db.prepare<[number], UserRow>(`${SELECT_USERS} WHERE u.id = ? GROUP BY u.id`);
  const getByUsernameStmt = db.prepare<[string], { id: number }>(
    'SELECT id FROM users WHERE username = ?',
  );
  const getByEmailStmt = db.prepare<[string], { id: number }>(
    'SELECT id FROM users WHERE email = ?',
  );
  const insertStmt = db.prepare<[string, string, string | null, number]>(
    'INSERT INTO users (username, password_hash, email, is_admin) VALUES (?, ?, ?, ?)',
  );
  const updateUsernameStmt = db.prepare<[string, number]>(
    'UPDATE users SET username = ? WHERE id = ?',
  );
  const updateEmailStmt = db.prepare<[string | null, number]>(
    'UPDATE users SET email = ? WHERE id = ?',
  );
  const updateAdminStmt = db.prepare<[number, number]>(
    'UPDATE users SET is_admin = ? WHERE id = ?',
  );
  const updatePasswordStmt = db.prepare<[string, number]>(
    'UPDATE users SET password_hash = ? WHERE id = ?',
  );
  const disableTotpStmt = db.prepare<[number]>(
    'UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_last_step = NULL WHERE id = ?',
  );
  const countAdminsStmt = db.prepare<[], { n: number }>(
    'SELECT COUNT(*) AS n FROM users WHERE is_admin = 1',
  );
  const coversStmt = db.prepare<[number], { name: string }>(
    'SELECT cover_path AS name FROM editions WHERE user_id = ? AND cover_path IS NOT NULL',
  );
  const photosStmt = db.prepare<[number], { name: string }>(
    'SELECT photo_path AS name FROM copies WHERE user_id = ? AND photo_path IS NOT NULL',
  );
  const deleteStmt = db.prepare<[number]>('DELETE FROM users WHERE id = ?');

  const getById = (id: number): UserItem | undefined => {
    const row = getByIdStmt.get(id);
    return row ? toUserItem(row) : undefined;
  };

  return {
    list: (): UserItem[] => listStmt.all().map(toUserItem),
    getById,
    getByUsername: (username: string): { id: number } | undefined =>
      getByUsernameStmt.get(username),
    /** `email` doit être normalisé (emailSchema : trim + minuscules). */
    getByEmail: (email: string): { id: number } | undefined => getByEmailStmt.get(email),
    countAdmins: (): number => countAdminsStmt.get()?.n ?? 0,
    create: (username: string, hash: string, email: string | null, isAdmin: boolean): UserItem =>
      getById(
        Number(insertStmt.run(username, hash, email, isAdmin ? 1 : 0).lastInsertRowid),
      ) as UserItem,
    updateUsername: (id: number, username: string) => updateUsernameStmt.run(username, id),
    updateEmail: (id: number, email: string | null) => updateEmailStmt.run(email, id),
    updateAdmin: (id: number, isAdmin: boolean) => updateAdminStmt.run(isAdmin ? 1 : 0, id),
    updatePassword: (id: number, hash: string) => updatePasswordStmt.run(hash, id),
    disableTotp: (id: number) => disableTotpStmt.run(id),
    /**
     * Supprime le compte et ses données (cascade) ; renvoie ses fichiers d'image, à effacer
     * ensuite du disque.
     */
    remove: db.transaction((id: number): AccountImages => {
      const files = {
        covers: coversStmt.all(id).map((row) => row.name),
        photos: photosStmt.all(id).map((row) => row.name),
      };
      deleteStmt.run(id);
      return files;
    }),
  };
}

export type UsersRepo = ReturnType<typeof createUsersRepo>;
