import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { createDb, initDatabase } from './db/init.js';

function setup() {
  const db = createDb(':memory:');
  initDatabase(db);
  return { db, app: createApp(db) };
}

type TestDb = ReturnType<typeof setup>['db'];

function insertCopy(db: TestDb): number {
  const work = db.prepare("INSERT INTO works (title) VALUES ('Tintin')").run();
  const edition = db
    .prepare("INSERT INTO editions (work_id, format) VALUES (?, 'book')")
    .run(work.lastInsertRowid);
  const copy = db
    .prepare('INSERT INTO copies (edition_id) VALUES (?)')
    .run(edition.lastInsertRowid);
  return Number(copy.lastInsertRowid);
}

function statusOf(db: TestDb, copyId: number): string {
  const row = db.prepare('SELECT status FROM copy_status WHERE copy_id = ?').get(copyId) as {
    status: string;
  };
  return row.status;
}

describe('GET /api/health', () => {
  it('renvoie ok quand la base répond', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('renvoie 503 quand le check supplémentaire échoue', async () => {
    const { db } = setup();
    const app = createApp(db, { healthExtraCheck: () => 'frontend' });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
  });
});

describe('copy_status', () => {
  it('dérive le statut des prêts puis des ventes', () => {
    const { db } = setup();
    const copyId = insertCopy(db);
    expect(statusOf(db, copyId)).toBe('owned');

    const borrower = db.prepare("INSERT INTO borrowers (name) VALUES ('Alice')").run();
    const loan = db
      .prepare('INSERT INTO loans (copy_id, borrower_id) VALUES (?, ?)')
      .run(copyId, borrower.lastInsertRowid);
    expect(statusOf(db, copyId)).toBe('loaned');

    db.prepare("UPDATE loans SET returned_at = date('now') WHERE id = ?").run(loan.lastInsertRowid);
    expect(statusOf(db, copyId)).toBe('owned');

    db.prepare("INSERT INTO sales (copy_id, listed_at) VALUES (?, date('now'))").run(copyId);
    expect(statusOf(db, copyId)).toBe('listed');

    db.prepare("UPDATE sales SET sold_at = date('now') WHERE copy_id = ?").run(copyId);
    expect(statusOf(db, copyId)).toBe('sold');
  });

  it('interdit deux prêts en cours sur le même exemplaire', () => {
    const { db } = setup();
    const copyId = insertCopy(db);
    const borrower = db.prepare("INSERT INTO borrowers (name) VALUES ('Alice')").run();
    const insertLoan = db.prepare('INSERT INTO loans (copy_id, borrower_id) VALUES (?, ?)');
    insertLoan.run(copyId, borrower.lastInsertRowid);
    expect(() => insertLoan.run(copyId, borrower.lastInsertRowid)).toThrow();
  });
});
