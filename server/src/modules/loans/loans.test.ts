import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createDb, initDatabase } from '../../db/init.js';

function setup() {
  const db = createDb(':memory:');
  initDatabase(db);
  return { db, app: createApp(db, { barcodeProviders: [] }) };
}

type TestApp = ReturnType<typeof setup>['app'];

async function createCopy(app: TestApp, title = 'Tintin au Tibet', barcode?: string) {
  const res = await request(app)
    .post('/api/copies')
    .send({ work: { title }, edition: { format: 'book', barcode } });
  return res.body.id as number;
}

const lend = (app: TestApp, copyId: number, body: object = { borrowerName: 'Alice' }) =>
  request(app).post(`/api/copies/${copyId}/loans`).send(body);

const statusOf = async (app: TestApp, copyId: number) =>
  (await request(app).get(`/api/copies/${copyId}`)).body.status as string;

describe('POST /api/copies/:id/loans', () => {
  it('prête l’exemplaire et crée l’emprunteur', async () => {
    const { app } = setup();
    const copyId = await createCopy(app);

    const res = await lend(app, copyId, { borrowerName: ' Alice ', loanedAt: '2026-10-01' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      copyId,
      borrowerName: 'Alice',
      loanedAt: '2026-10-01',
      returnedAt: null,
    });
    expect(await statusOf(app, copyId)).toBe('loaned');
  });

  it('prête à la date du jour par défaut', async () => {
    const { app } = setup();
    const res = await lend(app, await createCopy(app));

    expect(res.body.loanedAt).toBe(new Date().toISOString().slice(0, 10));
  });

  it('retrouve l’emprunteur sans tenir compte de la casse', async () => {
    const { app, db } = setup();
    const first = await createCopy(app, 'A', '9782203001190');
    const second = await createCopy(app, 'B', '9782203001191');

    const one = await lend(app, first, { borrowerName: 'Alice' });
    const two = await lend(app, second, { borrowerName: 'ALICE' });

    expect(two.body.borrowerId).toBe(one.body.borrowerId);
    expect(db.prepare('SELECT COUNT(*) AS n FROM borrowers').get()).toEqual({ n: 1 });
  });

  it('refuse un exemplaire déjà prêté', async () => {
    const { app } = setup();
    const copyId = await createCopy(app);
    await lend(app, copyId);

    const res = await lend(app, copyId, { borrowerName: 'Bob' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'already_loaned' });
  });

  it('refuse un exemplaire vendu', async () => {
    const { app, db } = setup();
    const copyId = await createCopy(app);
    db.prepare("INSERT INTO sales (copy_id, sold_at) VALUES (?, date('now'))").run(copyId);

    const res = await lend(app, copyId);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'sold' });
  });

  it('accepte un exemplaire en vente (non vendu)', async () => {
    const { app, db } = setup();
    const copyId = await createCopy(app);
    db.prepare("INSERT INTO sales (copy_id, listed_at) VALUES (?, date('now'))").run(copyId);

    expect((await lend(app, copyId)).status).toBe(201);
  });

  it('répond 404 pour un exemplaire inconnu', async () => {
    const { app } = setup();
    const res = await lend(app, 99);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });

  it.each([
    ['nom manquant', {}],
    ['nom vide', { borrowerName: '   ' }],
    ['date mal formée', { borrowerName: 'Alice', loanedAt: '01/10/2026' }],
    ['date inexistante', { borrowerName: 'Alice', loanedAt: '2026-02-30' }],
  ])('rejette %s', async (_label, body) => {
    const { app } = setup();
    const res = await lend(app, await createCopy(app), body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation');
  });

  it('rejette un identifiant d’exemplaire invalide', async () => {
    const { app } = setup();
    expect((await lend(app, Number.NaN)).status).toBe(400);
  });
});

describe('POST /api/loans/:id/return', () => {
  async function openLoan(app: TestApp, loanedAt = '2026-10-01') {
    const copyId = await createCopy(app);
    const loan = await lend(app, copyId, { borrowerName: 'Alice', loanedAt });
    return { copyId, loanId: loan.body.id as number };
  }

  it('enregistre le retour et rend l’exemplaire disponible', async () => {
    const { app } = setup();
    const { copyId, loanId } = await openLoan(app);

    const res = await request(app)
      .post(`/api/loans/${loanId}/return`)
      .send({ returnedAt: '2026-10-10' });

    expect(res.status).toBe(200);
    expect(res.body.returnedAt).toBe('2026-10-10');
    expect(await statusOf(app, copyId)).toBe('owned');
  });

  it('rend à la date du jour par défaut, sans corps', async () => {
    const { app } = setup();
    const { loanId } = await openLoan(app);

    const res = await request(app).post(`/api/loans/${loanId}/return`);

    expect(res.status).toBe(200);
    expect(res.body.returnedAt).toBe(new Date().toISOString().slice(0, 10));
  });

  it('permet de prêter de nouveau après le retour', async () => {
    const { app } = setup();
    const { copyId, loanId } = await openLoan(app);
    await request(app).post(`/api/loans/${loanId}/return`).send({});

    expect((await lend(app, copyId, { borrowerName: 'Bob' })).status).toBe(201);
  });

  it('refuse un second retour', async () => {
    const { app } = setup();
    const { loanId } = await openLoan(app);
    await request(app).post(`/api/loans/${loanId}/return`).send({});

    const res = await request(app).post(`/api/loans/${loanId}/return`).send({});

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'already_returned' });
  });

  it('refuse un retour antérieur au prêt', async () => {
    const { app } = setup();
    const { loanId } = await openLoan(app, '2026-10-10');

    const res = await request(app)
      .post(`/api/loans/${loanId}/return`)
      .send({ returnedAt: '2026-10-09' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_date' });
  });

  it('accepte un retour le jour même du prêt', async () => {
    const { app } = setup();
    const { loanId } = await openLoan(app, '2026-10-10');

    const res = await request(app)
      .post(`/api/loans/${loanId}/return`)
      .send({ returnedAt: '2026-10-10' });

    expect(res.status).toBe(200);
  });

  it('répond 404 pour un prêt inconnu et 400 pour une date invalide', async () => {
    const { app } = setup();
    expect((await request(app).post('/api/loans/99/return').send({})).status).toBe(404);
    const { loanId } = await openLoan(app);
    const res = await request(app).post(`/api/loans/${loanId}/return`).send({ returnedAt: 'hier' });
    expect(res.status).toBe(400);
  });
});

describe('listes', () => {
  it('liste l’historique d’un exemplaire, du plus récent au plus ancien', async () => {
    const { app } = setup();
    const copyId = await createCopy(app);
    const first = await lend(app, copyId, { borrowerName: 'Alice', loanedAt: '2026-01-05' });
    await request(app)
      .post(`/api/loans/${first.body.id}/return`)
      .send({ returnedAt: '2026-01-20' });
    await lend(app, copyId, { borrowerName: 'Bob', loanedAt: '2026-03-01' });

    const res = await request(app).get(`/api/copies/${copyId}/loans`);

    expect(res.status).toBe(200);
    expect(res.body.map((l: { borrowerName: string }) => l.borrowerName)).toEqual(['Bob', 'Alice']);
    expect(res.body[0].returnedAt).toBeNull();
    expect(res.body[1].returnedAt).toBe('2026-01-20');
  });

  it('renvoie une liste vide pour un exemplaire jamais prêté, 404 s’il n’existe pas', async () => {
    const { app } = setup();
    const copyId = await createCopy(app);

    expect((await request(app).get(`/api/copies/${copyId}/loans`)).body).toEqual([]);
    expect((await request(app).get('/api/copies/99/loans')).status).toBe(404);
  });

  it('liste les prêts en cours avec l’exemplaire, du plus ancien au plus récent', async () => {
    const { app } = setup();
    const a = await createCopy(app, 'Récent', '9782203001190');
    const b = await createCopy(app, 'Ancien', '9782203001191');
    const c = await createCopy(app, 'Rendu', '9782203001192');
    await lend(app, a, { borrowerName: 'Alice', loanedAt: '2026-09-01' });
    await lend(app, b, { borrowerName: 'Bob', loanedAt: '2026-02-01' });
    const done = await lend(app, c, { borrowerName: 'Chloé', loanedAt: '2026-01-01' });
    await request(app).post(`/api/loans/${done.body.id}/return`).send({});

    const res = await request(app).get('/api/loans');

    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      borrowerName: 'Bob',
      work: { title: 'Ancien', series: null, volumeNumber: null },
      format: 'book',
    });
    expect(res.body[1].work.title).toBe('Récent');
  });

  it('liste les emprunteurs avec leur nombre de prêts en cours', async () => {
    const { app } = setup();
    const a = await createCopy(app, 'A', '9782203001190');
    const b = await createCopy(app, 'B', '9782203001191');
    await lend(app, a, { borrowerName: 'bob' });
    await lend(app, b, { borrowerName: 'Alice' });
    const done = await lend(app, await createCopy(app, 'C', '9782203001192'), {
      borrowerName: 'Chloé',
    });
    await request(app).post(`/api/loans/${done.body.id}/return`).send({});

    const res = await request(app).get('/api/borrowers');

    expect(res.body.map((x: { name: string; openLoans: number }) => [x.name, x.openLoans])).toEqual(
      [
        ['Alice', 1],
        ['bob', 1],
        ['Chloé', 0],
      ],
    );
  });
});
