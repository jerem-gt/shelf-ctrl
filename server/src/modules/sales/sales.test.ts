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

const listForSale = (app: TestApp, copyId: number, body: object = {}) =>
  request(app).post(`/api/copies/${copyId}/sale`).send(body);

const sell = (app: TestApp, copyId: number, body: object = {}) =>
  request(app).post(`/api/copies/${copyId}/sale/sold`).send(body);

const statusOf = async (app: TestApp, copyId: number) =>
  (await request(app).get(`/api/copies/${copyId}`)).body.status as string;

describe('POST /api/copies/:id/sale (mise en vente)', () => {
  it('met l’exemplaire en vente', async () => {
    const { app } = setup();
    const copyId = await createCopy(app);

    const res = await listForSale(app, copyId, {
      platform: ' Vinted ',
      priceCents: 1250,
      listedAt: '2026-10-01',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      copyId,
      platform: 'Vinted',
      priceCents: 1250,
      listedAt: '2026-10-01',
      soldAt: null,
    });
    expect(await statusOf(app, copyId)).toBe('listed');
  });

  it('accepte une annonce sans plateforme ni prix, datée d’aujourd’hui', async () => {
    const { app } = setup();
    const res = await listForSale(app, await createCopy(app));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ platform: null, priceCents: null });
    expect(res.body.listedAt).toBe(new Date().toISOString().slice(0, 10));
  });

  it('refuse un exemplaire déjà en vente ou déjà vendu', async () => {
    const { app } = setup();
    const copyId = await createCopy(app);
    await listForSale(app, copyId);

    const again = await listForSale(app, copyId);
    expect(again.status).toBe(409);
    expect(again.body).toEqual({ error: 'already_listed' });

    await sell(app, copyId);
    const afterSale = await listForSale(app, copyId);
    expect(afterSale.status).toBe(409);
    expect(afterSale.body).toEqual({ error: 'already_sold' });
  });

  it('répond 404 pour un exemplaire inconnu', async () => {
    const { app } = setup();
    expect((await listForSale(app, 99)).status).toBe(404);
  });

  it.each([
    ['prix négatif', { priceCents: -1 }],
    ['prix décimal', { priceCents: 12.5 }],
    ['prix trop élevé', { priceCents: 10_000_001 }],
    ['plateforme vide', { platform: '   ' }],
    ['date mal formée', { listedAt: 'hier' }],
  ])('rejette %s', async (_label, body) => {
    const { app } = setup();
    const res = await listForSale(app, await createCopy(app), body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation');
  });
});

describe('POST /api/copies/:id/sale/sold (vente)', () => {
  it('vend un exemplaire en vente en gardant ou en corrigeant plateforme et prix', async () => {
    const { app } = setup();
    const kept = await createCopy(app, 'A', '9782203001190');
    await listForSale(app, kept, { platform: 'Vinted', priceCents: 1500, listedAt: '2026-10-01' });
    const fixed = await createCopy(app, 'B', '9782203001191');
    await listForSale(app, fixed, { platform: 'Vinted', priceCents: 1500, listedAt: '2026-10-01' });

    const keptRes = await sell(app, kept, { soldAt: '2026-10-05' });
    const fixedRes = await sell(app, fixed, {
      soldAt: '2026-10-06',
      platform: 'Leboncoin',
      priceCents: 1200,
    });

    expect(keptRes.status).toBe(200);
    expect(keptRes.body).toMatchObject({
      platform: 'Vinted',
      priceCents: 1500,
      listedAt: '2026-10-01',
      soldAt: '2026-10-05',
    });
    expect(fixedRes.body).toMatchObject({ platform: 'Leboncoin', priceCents: 1200 });
    expect(await statusOf(app, kept)).toBe('sold');
  });

  it('enregistre une vente directe, sans annonce préalable', async () => {
    const { app } = setup();
    const copyId = await createCopy(app);

    const res = await sell(app, copyId, { platform: 'Momox', priceCents: 400 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ platform: 'Momox', priceCents: 400, listedAt: null });
    expect(res.body.soldAt).toBe(new Date().toISOString().slice(0, 10));
    expect(await statusOf(app, copyId)).toBe('sold');
  });

  it('refuse un exemplaire déjà vendu', async () => {
    const { app } = setup();
    const copyId = await createCopy(app);
    await sell(app, copyId);

    const res = await sell(app, copyId);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'already_sold' });
  });

  it('refuse un exemplaire prêté, puis l’accepte une fois rendu', async () => {
    const { app } = setup();
    const copyId = await createCopy(app);
    const loan = await request(app)
      .post(`/api/copies/${copyId}/loans`)
      .send({ borrowerName: 'Alice' });

    const refused = await sell(app, copyId);
    expect(refused.status).toBe(409);
    expect(refused.body).toEqual({ error: 'loaned' });

    await request(app).post(`/api/loans/${loan.body.id}/return`).send({});
    expect((await sell(app, copyId)).status).toBe(200);
  });

  it('refuse une vente antérieure à la mise en vente, mais accepte le même jour', async () => {
    const { app } = setup();
    const copyId = await createCopy(app);
    await listForSale(app, copyId, { listedAt: '2026-10-10' });

    const early = await sell(app, copyId, { soldAt: '2026-10-09' });
    expect(early.status).toBe(400);
    expect(early.body).toEqual({ error: 'invalid_date' });

    expect((await sell(app, copyId, { soldAt: '2026-10-10' })).status).toBe(200);
  });

  it('répond 404 pour un exemplaire inconnu et 400 pour une date invalide', async () => {
    const { app } = setup();
    expect((await sell(app, 99)).status).toBe(404);
    const res = await sell(app, await createCopy(app), { soldAt: '2026-02-30' });
    expect(res.status).toBe(400);
  });
});

describe('GET, PATCH et DELETE /api/copies/:id/sale', () => {
  it('lit la vente d’un exemplaire : null sans vente, 404 si l’exemplaire n’existe pas', async () => {
    const { app } = setup();
    const copyId = await createCopy(app);

    const none = await request(app).get(`/api/copies/${copyId}/sale`);
    expect(none.status).toBe(200);
    expect(none.body).toBeNull();

    await listForSale(app, copyId, { priceCents: 900 });
    expect((await request(app).get(`/api/copies/${copyId}/sale`)).body.priceCents).toBe(900);

    expect((await request(app).get('/api/copies/99/sale')).status).toBe(404);
  });

  it('modifie plateforme et prix, y compris pour les effacer', async () => {
    const { app } = setup();
    const copyId = await createCopy(app);
    await listForSale(app, copyId, { platform: 'Vinted', priceCents: 1000 });

    const changed = await request(app)
      .patch(`/api/copies/${copyId}/sale`)
      .send({ priceCents: 800 });
    expect(changed.body).toMatchObject({ platform: 'Vinted', priceCents: 800 });

    const cleared = await request(app)
      .patch(`/api/copies/${copyId}/sale`)
      .send({ platform: null, priceCents: null });
    expect(cleared.body).toMatchObject({ platform: null, priceCents: null });
  });

  it('rejette une modification vide et répond 404 sans vente', async () => {
    const { app } = setup();
    const copyId = await createCopy(app);

    const missing = await request(app).patch(`/api/copies/${copyId}/sale`).send({ priceCents: 1 });
    expect(missing.status).toBe(404);

    await listForSale(app, copyId);
    const empty = await request(app).patch(`/api/copies/${copyId}/sale`).send({});
    expect(empty.status).toBe(400);
  });

  it('retire une annonce et annule une vente : l’exemplaire redevient en rayon', async () => {
    const { app } = setup();
    const listed = await createCopy(app, 'A', '9782203001190');
    const sold = await createCopy(app, 'B', '9782203001191');
    await listForSale(app, listed);
    await sell(app, sold);

    expect((await request(app).delete(`/api/copies/${listed}/sale`)).status).toBe(204);
    expect((await request(app).delete(`/api/copies/${sold}/sale`)).status).toBe(204);

    expect(await statusOf(app, listed)).toBe('owned');
    expect(await statusOf(app, sold)).toBe('owned');
    expect((await listForSale(app, listed)).status).toBe(201);
  });

  it('répond 404 pour retirer une vente qui n’existe pas', async () => {
    const { app } = setup();
    const res = await request(app).delete(`/api/copies/${await createCopy(app)}/sale`);

    expect(res.status).toBe(404);
  });

  it('supprime la vente avec l’exemplaire', async () => {
    const { app, db } = setup();
    const copyId = await createCopy(app);
    await sell(app, copyId);

    await request(app).delete(`/api/copies/${copyId}`);

    expect(db.prepare('SELECT COUNT(*) AS n FROM sales').get()).toEqual({ n: 0 });
  });

  it('interdit deux lignes de vente pour le même exemplaire au niveau de la base', async () => {
    const { app, db } = setup();
    const copyId = await createCopy(app);
    await listForSale(app, copyId);

    expect(() =>
      db.prepare("INSERT INTO sales (copy_id, listed_at) VALUES (?, date('now'))").run(copyId),
    ).toThrow();
  });
});

describe('GET /api/sales', () => {
  it('liste annonces et ventes avec l’exemplaire, les plus récentes d’abord', async () => {
    const { app } = setup();
    const a = await createCopy(app, 'Ancienne annonce', '9782203001190');
    const b = await createCopy(app, 'Vendu récemment', '9782203001191');
    const c = await createCopy(app, 'Annonce récente', '9782203001192');
    await listForSale(app, a, { listedAt: '2026-01-01', priceCents: 500 });
    await sell(app, b, { soldAt: '2026-09-01', priceCents: 700, platform: 'Vinted' });
    await listForSale(app, c, { listedAt: '2026-10-01' });

    const res = await request(app).get('/api/sales');

    expect(res.status).toBe(200);
    expect(res.body.map((s: { work: { title: string } }) => s.work.title)).toEqual([
      'Annonce récente',
      'Vendu récemment',
      'Ancienne annonce',
    ]);
    expect(res.body[1]).toMatchObject({
      platform: 'Vinted',
      priceCents: 700,
      soldAt: '2026-09-01',
      format: 'book',
      work: { series: null, volumeNumber: null },
    });
  });

  it('renvoie une liste vide sans vente', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/sales')).body).toEqual([]);
  });
});
