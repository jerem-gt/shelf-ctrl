import bcrypt from 'bcrypt';
import { describe, expect, it } from 'vitest';

import { createDb, initDatabase } from '../../db/init.js';
import { createAuthRepo, syncAdminUser } from './auth.repo.js';

const COST = 4;

function setup() {
  const db = createDb(':memory:');
  initDatabase(db);
  return db;
}

const addSession = (db: ReturnType<typeof setup>) =>
  db
    .prepare("INSERT INTO sessions (sid, data, expires_at) VALUES ('s1', '{}', 9999999999999)")
    .run();

const sessionCount = (db: ReturnType<typeof setup>) =>
  (db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n;

describe('syncAdminUser', () => {
  it('crée le compte avec un mot de passe haché', () => {
    const db = setup();

    expect(syncAdminUser(db, 'admin', 'secret-password', COST)).toBe('created');

    const user = createAuthRepo(db).getByUsername('admin');
    expect(user?.password_hash).not.toBe('secret-password');
    expect(bcrypt.compareSync('secret-password', user?.password_hash ?? '')).toBe(true);
  });

  it('ne touche à rien quand l’environnement n’a pas changé', () => {
    const db = setup();
    syncAdminUser(db, 'admin', 'secret-password', COST);
    addSession(db);
    const before = createAuthRepo(db).getByUsername('admin');

    expect(syncAdminUser(db, 'admin', 'secret-password', COST)).toBe('unchanged');

    expect(createAuthRepo(db).getByUsername('admin')).toEqual(before);
    expect(sessionCount(db)).toBe(1);
  });

  it('met à jour le mot de passe et supprime les sessions ouvertes', () => {
    const db = setup();
    syncAdminUser(db, 'admin', 'secret-password', COST);
    addSession(db);

    expect(syncAdminUser(db, 'admin', 'new-password-1', COST)).toBe('updated');

    const user = createAuthRepo(db).getByUsername('admin');
    expect(bcrypt.compareSync('new-password-1', user?.password_hash ?? '')).toBe(true);
    expect(bcrypt.compareSync('secret-password', user?.password_hash ?? '')).toBe(false);
    expect(sessionCount(db)).toBe(0);
  });

  it('renomme le compte en gardant le mot de passe, sans créer un second compte', () => {
    const db = setup();
    syncAdminUser(db, 'admin', 'secret-password', COST);
    addSession(db);
    const before = createAuthRepo(db).getByUsername('admin');

    expect(syncAdminUser(db, 'jerem', 'secret-password', COST)).toBe('updated');

    expect(createAuthRepo(db).getByUsername('admin')).toBeUndefined();
    const renamed = createAuthRepo(db).getByUsername('jerem');
    expect(renamed).toMatchObject({ id: before?.id, password_hash: before?.password_hash });
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 1 });
    expect(sessionCount(db)).toBe(0);
  });
});

describe('createAuthRepo', () => {
  it('retrouve un utilisateur par identifiant ou par id, undefined sinon', () => {
    const db = setup();
    syncAdminUser(db, 'admin', 'secret-password', COST);
    const repo = createAuthRepo(db);
    const user = repo.getByUsername('admin');

    expect(user?.username).toBe('admin');
    expect(repo.getById(user?.id ?? 0)?.username).toBe('admin');
    expect(repo.getByUsername('ADMIN')).toBeUndefined();
    expect(repo.getById(99)).toBeUndefined();
  });
});
