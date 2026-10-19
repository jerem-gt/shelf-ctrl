import { describe, expect, it } from 'vitest';

import { createDb, initDatabase } from './init.js';
import { runMigrations } from './migrations.js';
import { initSchema } from './schema.js';

const tables = (db: ReturnType<typeof createDb>) =>
  (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
  ).map((row) => row.name);
const version = (db: ReturnType<typeof createDb>) => db.pragma('user_version', { simple: true });

describe('runMigrations', () => {
  it('crée la table des plateformes et note la version sur une base neuve', () => {
    const db = createDb(':memory:');

    initDatabase(db);

    expect(tables(db)).toContain('platforms');
    expect(version(db)).toBe(1);
  });

  it('fait évoluer une base existante sans toucher à ses données', () => {
    const db = createDb(':memory:');
    initSchema(db);
    db.prepare("INSERT INTO works (title) VALUES ('Tintin au Tibet')").run();
    expect(version(db)).toBe(0);
    expect(tables(db)).not.toContain('platforms');

    initDatabase(db);

    expect(version(db)).toBe(1);
    expect(db.prepare('SELECT title FROM works').all()).toEqual([{ title: 'Tintin au Tibet' }]);
  });

  it('ne rejoue pas une migration déjà passée', () => {
    const db = createDb(':memory:');
    initDatabase(db);
    db.prepare("INSERT INTO platforms (name) VALUES ('Vinted')").run();

    runMigrations(db);
    initDatabase(db);

    expect(version(db)).toBe(1);
    expect(db.prepare('SELECT name FROM platforms').all()).toEqual([{ name: 'Vinted' }]);
  });

  it('refuse deux plateformes par défaut, et deux noms identiques à la casse près', () => {
    const db = createDb(':memory:');
    initDatabase(db);
    db.prepare("INSERT INTO platforms (name, is_default) VALUES ('Vinted', 1)").run();

    expect(() =>
      db.prepare("INSERT INTO platforms (name, is_default) VALUES ('eBay', 1)").run(),
    ).toThrow();
    expect(() => db.prepare("INSERT INTO platforms (name) VALUES ('vinted')").run()).toThrow();
  });
});
