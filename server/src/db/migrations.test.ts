import { describe, expect, it } from 'vitest';

import { createDb, initDatabase } from './init.js';
import { runMigrations } from './migrations.js';
import { initSchema } from './schema.js';

type Db = ReturnType<typeof createDb>;

const tables = (db: Db) =>
  (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
  ).map((row) => row.name);
const version = (db: Db) => db.pragma('user_version', { simple: true });
const addUser = (db: Db, username: string) =>
  Number(
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?, 'hash')").run(username)
      .lastInsertRowid,
  );

/** Base au schéma d'avant les comptes (version 1), remplie comme en production. */
function legacyDb() {
  const db = createDb(':memory:');
  initSchema(db);
  // Migration 1, telle que livrée.
  db.exec(`
    CREATE TABLE platforms
    (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        publish_url TEXT,
        is_default  INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1))
    );
    CREATE UNIQUE INDEX idx_platforms_default ON platforms (is_default) WHERE is_default = 1;
  `);
  db.pragma('user_version = 1');
  const adminId = addUser(db, 'admin');
  db.exec(`
    INSERT INTO works (id, title, series, volume_number) VALUES (1, 'Tintin au Tibet', 'Tintin', 20);
    INSERT INTO editions (id, work_id, format, barcode, cover_path) VALUES (1, 1, 'book', '9782203001190', '1-0123456789.webp');
    INSERT INTO copies (id, edition_id, condition, photo_path) VALUES (1, 1, 'good', '1-abcdefabcd.webp');
    INSERT INTO copies (id, edition_id, condition) VALUES (2, 1, 'poor');
    INSERT INTO borrowers (id, name) VALUES (1, 'Paul');
    INSERT INTO loans (copy_id, borrower_id, loaned_at) VALUES (1, 1, '2026-01-01');
    INSERT INTO sales (copy_id, platform, listed_at) VALUES (2, 'Vinted', '2026-02-01');
    INSERT INTO platforms (name, is_default) VALUES ('Vinted', 1);
  `);
  return { db, adminId };
}

describe('runMigrations', () => {
  it('crée le schéma complet et note la version sur une base neuve', () => {
    const db = createDb(':memory:');

    initDatabase(db);

    expect(tables(db)).toEqual(expect.arrayContaining(['platforms', 'password_reset_tokens']));
    expect(version(db)).toBe(2);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('fait évoluer une base de version 0 sans toucher à ses données', () => {
    const db = createDb(':memory:');
    initSchema(db);
    addUser(db, 'admin');
    db.prepare("INSERT INTO works (title) VALUES ('Tintin au Tibet')").run();
    expect(version(db)).toBe(0);
    expect(tables(db)).not.toContain('platforms');

    initDatabase(db);

    expect(version(db)).toBe(2);
    expect(db.prepare('SELECT title FROM works').all()).toEqual([{ title: 'Tintin au Tibet' }]);
  });

  it('rattache toutes les données existantes au compte existant, devenu admin', () => {
    const { db, adminId } = legacyDb();

    runMigrations(db);

    expect(version(db)).toBe(2);
    for (const table of [
      'works',
      'editions',
      'copies',
      'borrowers',
      'loans',
      'sales',
      'platforms',
    ]) {
      expect(db.prepare(`SELECT DISTINCT user_id FROM ${table}`).all()).toEqual([
        { user_id: adminId },
      ]);
    }
    expect(db.prepare('SELECT is_admin, email FROM users').get()).toEqual({
      is_admin: 1,
      email: null,
    });
  });

  it('garde chaque ligne, identifiants et statuts compris (aucune cascade)', () => {
    const { db } = legacyDb();

    runMigrations(db);

    expect(db.prepare('SELECT id, photo_path FROM copies ORDER BY id').all()).toEqual([
      { id: 1, photo_path: '1-abcdefabcd.webp' },
      { id: 2, photo_path: null },
    ]);
    expect(db.prepare('SELECT cover_path FROM editions').get()).toEqual({
      cover_path: '1-0123456789.webp',
    });
    expect(db.prepare('SELECT copy_id, status FROM copy_status ORDER BY copy_id').all()).toEqual([
      { copy_id: 1, status: 'loaned' },
      { copy_id: 2, status: 'listed' },
    ]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('remet les cascades en place : supprimer le compte supprime ses données', () => {
    const { db, adminId } = legacyDb();
    runMigrations(db);

    db.prepare('DELETE FROM users WHERE id = ?').run(adminId);

    for (const table of [
      'works',
      'editions',
      'copies',
      'borrowers',
      'loans',
      'sales',
      'platforms',
    ]) {
      expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()).toEqual({ n: 0 });
    }
  });

  it.each([
    ['une œuvre', "INSERT INTO works (title) VALUES ('Orpheline')"],
    ['une plateforme seule', "INSERT INTO platforms (name) VALUES ('Vinted')"],
  ])('refuse de migrer des données sans compte : %s', (_label, insert) => {
    const { db } = legacyDb();
    db.exec('DELETE FROM sales; DELETE FROM loans; DELETE FROM borrowers; DELETE FROM copies;');
    db.exec('DELETE FROM editions; DELETE FROM works; DELETE FROM platforms; DELETE FROM users;');
    db.prepare(insert).run();

    expect(() => runMigrations(db)).toThrow(/aucun compte/);
    expect(version(db)).toBe(1);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('ne rejoue pas une migration déjà passée', () => {
    const db = createDb(':memory:');
    initDatabase(db);
    const userId = addUser(db, 'admin');
    db.prepare("INSERT INTO platforms (user_id, name) VALUES (?, 'Vinted')").run(userId);

    runMigrations(db);
    initDatabase(db);

    expect(version(db)).toBe(2);
    expect(db.prepare('SELECT name FROM platforms').all()).toEqual([{ name: 'Vinted' }]);
  });

  it('rend les unicités propres à chaque compte', () => {
    const db = createDb(':memory:');
    initDatabase(db);
    const a = addUser(db, 'a');
    const b = addUser(db, 'b');
    const platform = db.prepare(
      'INSERT INTO platforms (user_id, name, is_default) VALUES (?, ?, ?)',
    );
    const borrower = db.prepare('INSERT INTO borrowers (user_id, name) VALUES (?, ?)');
    const work = db.prepare("INSERT INTO works (user_id, title) VALUES (?, 'T')");
    const edition = db.prepare(
      "INSERT INTO editions (user_id, work_id, format, barcode) VALUES (?, ?, 'book', '9782203001190')",
    );

    platform.run(a, 'Vinted', 1);
    platform.run(b, 'Vinted', 1);
    borrower.run(a, 'Paul');
    borrower.run(b, 'Paul');
    edition.run(a, work.run(a).lastInsertRowid);
    edition.run(b, work.run(b).lastInsertRowid);

    expect(() => platform.run(a, 'eBay', 1)).toThrow();
    expect(() => platform.run(a, 'vinted', 0)).toThrow();
    expect(() => borrower.run(a, 'Paul')).toThrow();
    expect(() => edition.run(a, work.run(a).lastInsertRowid)).toThrow();
  });

  it('refuse deux e-mails identiques', () => {
    const db = createDb(':memory:');
    initDatabase(db);
    const set = db.prepare('UPDATE users SET email = ? WHERE id = ?');
    set.run('a@example.com', addUser(db, 'a'));

    expect(() => set.run('a@example.com', addUser(db, 'b'))).toThrow();
  });
});
