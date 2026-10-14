import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createDb, initDatabase } from '../../db/init.js';

function setup() {
  const db = createDb(':memory:');
  initDatabase(db);
  return { db, app: createApp(db) };
}

type TestApp = ReturnType<typeof setup>['app'];

const tintin = {
  work: { title: 'Tintin au Tibet', series: 'Tintin', volumeNumber: 20, creators: 'Hergé' },
  edition: { format: 'book', barcode: '9782203001190', publisher: 'Casterman' },
  condition: 'very_good',
  location: 'Salon',
};

describe('POST /api/copies', () => {
  it('crée l’œuvre, l’édition et l’exemplaire', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/copies').send(tintin);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'owned',
      condition: 'very_good',
      location: 'Salon',
      work: { title: 'Tintin au Tibet', series: 'Tintin', volumeNumber: 20 },
      edition: { format: 'book', barcode: '9782203001190', publisher: 'Casterman' },
    });
  });

  it('utilise l’état « good » par défaut', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/api/copies')
      .send({ work: { title: 'Alien' }, edition: { format: 'bluray' } });
    expect(res.status).toBe(201);
    expect(res.body.condition).toBe('good');
  });

  it('réutilise l’édition quand le code-barres est déjà connu', async () => {
    const { app, db } = setup();
    const first = await request(app).post('/api/copies').send(tintin);
    const second = await request(app).post('/api/copies').send(tintin);

    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);
    expect(second.body.edition.id).toBe(first.body.edition.id);
    expect(db.prepare('SELECT COUNT(*) AS n FROM editions').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM works').get()).toEqual({ n: 1 });
  });

  it('stocke un ISBN-10 en ISBN-13 et retrouve la même édition', async () => {
    const { app, db } = setup();
    const withIsbn10 = { ...tintin, edition: { format: 'book', barcode: '2203001194' } };
    const first = await request(app).post('/api/copies').send(withIsbn10);
    const second = await request(app).post('/api/copies').send(tintin);

    expect(first.body.edition.barcode).toBe('9782203001190');
    expect(second.body.edition.id).toBe(first.body.edition.id);
    expect(db.prepare('SELECT COUNT(*) AS n FROM editions').get()).toEqual({ n: 1 });
  });

  it('réutilise l’œuvre pour une autre édition du même titre', async () => {
    const { app, db } = setup();
    await request(app).post('/api/copies').send(tintin);
    await request(app)
      .post('/api/copies')
      .send({ ...tintin, edition: { format: 'book', barcode: '9782203001191' } });
    expect(db.prepare('SELECT COUNT(*) AS n FROM works').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM editions').get()).toEqual({ n: 2 });
  });

  it.each([
    ['titre manquant', { ...tintin, work: {} }],
    ['format inconnu', { ...tintin, edition: { format: 'vhs' } }],
    ['code-barres invalide', { ...tintin, edition: { format: 'book', barcode: 'abc' } }],
    ['état inconnu', { ...tintin, condition: 'mint' }],
  ])('rejette %s', async (_label, body) => {
    const { app } = setup();
    const res = await request(app).post('/api/copies').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation');
  });

  it('rejette un JSON mal formé', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/api/copies')
      .set('Content-Type', 'application/json')
      .send('{oups');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/copies', () => {
  async function seed(app: TestApp) {
    await request(app).post('/api/copies').send(tintin);
    await request(app)
      .post('/api/copies')
      .send({
        work: { title: 'Blade Runner' },
        edition: { format: 'uhd4k', barcode: '5051889000001' },
      });
    await request(app)
      .post('/api/copies')
      .send({
        work: { title: 'Astérix', series: 'Astérix', volumeNumber: 1 },
        edition: { format: 'book' },
      });
  }

  it('liste triée par série puis tome', async () => {
    const { app } = setup();
    await seed(app);
    const res = await request(app).get('/api/copies');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((c: { work: { title: string } }) => c.work.title)).toEqual([
      'Astérix',
      'Blade Runner',
      'Tintin au Tibet',
    ]);
  });

  it('filtre par format, par statut et par recherche', async () => {
    const { app, db } = setup();
    await seed(app);

    const byFormat = await request(app).get('/api/copies?format=uhd4k');
    expect(byFormat.body.total).toBe(1);

    const byQuery = await request(app).get('/api/copies?q=herg');
    expect(byQuery.body.items).toHaveLength(1);
    expect(byQuery.body.items[0].work.series).toBe('Tintin');

    const byBarcode = await request(app).get('/api/copies?q=5051889');
    expect(byBarcode.body.total).toBe(1);

    db.prepare("INSERT INTO borrowers (name) VALUES ('Alice')").run();
    db.prepare('INSERT INTO loans (copy_id, borrower_id) VALUES (1, 1)').run();
    const loaned = await request(app).get('/api/copies?status=loaned');
    expect(loaned.body.total).toBe(1);
    expect(loaned.body.items[0].status).toBe('loaned');
  });

  it('traite % comme un caractère littéral', async () => {
    const { app } = setup();
    await seed(app);
    const res = await request(app).get('/api/copies?q=%25');
    expect(res.body.total).toBe(0);
  });

  it('pagine avec limit et offset', async () => {
    const { app } = setup();
    await seed(app);
    const res = await request(app).get('/api/copies?limit=1&offset=1');
    expect(res.body.total).toBe(3);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].work.title).toBe('Blade Runner');
  });

  it('rejette des paramètres invalides', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/copies?limit=0')).status).toBe(400);
    expect((await request(app).get('/api/copies?status=lost')).status).toBe(400);
  });
});

describe('GET/PATCH/DELETE /api/copies/:id', () => {
  it('lit, modifie puis supprime un exemplaire', async () => {
    const { app } = setup();
    const created = await request(app).post('/api/copies').send(tintin);
    const url = `/api/copies/${created.body.id}`;

    expect((await request(app).get(url)).body.location).toBe('Salon');

    const patched = await request(app)
      .patch(url)
      .send({ condition: 'poor', conditionNote: 'Dos abîmé', location: null });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({
      condition: 'poor',
      conditionNote: 'Dos abîmé',
      location: null,
    });

    expect((await request(app).delete(url)).status).toBe(204);
    expect((await request(app).get(url)).status).toBe(404);
  });

  it('renvoie 404 pour un exemplaire inconnu', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/copies/99')).status).toBe(404);
    const patch = await request(app).patch('/api/copies/99').send({ condition: 'good' });
    expect(patch.status).toBe(404);
    expect((await request(app).delete('/api/copies/99')).status).toBe(404);
  });

  it('rejette un identifiant invalide et une modification vide', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/copies/abc')).status).toBe(400);
    const created = await request(app).post('/api/copies').send(tintin);
    expect((await request(app).patch(`/api/copies/${created.body.id}`).send({})).status).toBe(400);
  });
});
