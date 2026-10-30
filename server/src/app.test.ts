import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import { createTestDbWithUser } from './tests/testDb.js';

function setup() {
  const { db } = createTestDbWithUser();
  return { db, app: createApp(db) };
}

type TestDb = ReturnType<typeof setup>['db'];

function insertCopy(db: TestDb): number {
  const work = db.prepare("INSERT INTO works (user_id, title) VALUES (1, 'Tintin')").run();
  const edition = db
    .prepare("INSERT INTO editions (user_id, work_id, format) VALUES (1, ?, 'book')")
    .run(work.lastInsertRowid);
  const copy = db
    .prepare('INSERT INTO copies (user_id, edition_id) VALUES (1, ?)')
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

describe("gestionnaire d'erreur", () => {
  it('répond 400 common.invalid_request à un JSON illisible', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/api/copies')
      .set('Content-Type', 'application/json')
      .send('{"work":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('common.invalid_request');
  });

  it('répond 413 common.payload_too_large à un corps JSON trop gros', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/api/copies')
      .send({ note: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
    expect(res.body.error).toEqual({
      code: 'common.payload_too_large',
      message: 'Requête trop volumineuse',
    });
  });

  it('détaille une erreur de validation par champ', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/copies').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation.invalid');
    expect(res.body.error.fields).toContainEqual(
      expect.objectContaining({ path: 'work', code: 'validation.required' }),
    );
  });

  it('répond 500 common.internal à une erreur inattendue, sans la détailler', async () => {
    const { db, app } = setup();
    db.exec('DROP VIEW copy_status');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(app).get('/api/copies');
    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({
      code: 'common.internal',
      message: 'Erreur interne du serveur.',
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('copy_status', () => {
  it('dérive le statut des prêts puis des ventes', () => {
    const { db } = setup();
    const copyId = insertCopy(db);
    expect(statusOf(db, copyId)).toBe('owned');

    const borrower = db.prepare("INSERT INTO borrowers (user_id, name) VALUES (1, 'Alice')").run();
    const loan = db
      .prepare('INSERT INTO loans (user_id, copy_id, borrower_id) VALUES (1, ?, ?)')
      .run(copyId, borrower.lastInsertRowid);
    expect(statusOf(db, copyId)).toBe('loaned');

    db.prepare("UPDATE loans SET returned_at = date('now') WHERE id = ?").run(loan.lastInsertRowid);
    expect(statusOf(db, copyId)).toBe('owned');

    db.prepare("INSERT INTO sales (user_id, copy_id, listed_at) VALUES (1, ?, date('now'))").run(
      copyId,
    );
    expect(statusOf(db, copyId)).toBe('listed');

    db.prepare("UPDATE sales SET sold_at = date('now') WHERE copy_id = ?").run(copyId);
    expect(statusOf(db, copyId)).toBe('sold');
  });

  it('interdit deux prêts en cours sur le même exemplaire', () => {
    const { db } = setup();
    const copyId = insertCopy(db);
    const borrower = db.prepare("INSERT INTO borrowers (user_id, name) VALUES (1, 'Alice')").run();
    const insertLoan = db.prepare(
      'INSERT INTO loans (user_id, copy_id, borrower_id) VALUES (1, ?, ?)',
    );
    insertLoan.run(copyId, borrower.lastInsertRowid);
    expect(() => insertLoan.run(copyId, borrower.lastInsertRowid)).toThrow();
  });
});
