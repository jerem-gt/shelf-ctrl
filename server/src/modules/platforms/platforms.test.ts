import type { PlatformItem } from '@shelfctrl/types';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createTestDbWithUser } from '../../tests/testDb.js';

function setup() {
  const { db } = createTestDbWithUser();
  return createApp(db, { barcodeProviders: [], titleSearchProviders: [] });
}

type TestApp = ReturnType<typeof setup>;

const create = (app: TestApp, body: object) => request(app).post('/api/platforms').send(body);
const list = async (app: TestApp) =>
  (await request(app).get('/api/platforms')).body.items as PlatformItem[];

describe('GET /api/platforms', () => {
  it('renvoie une liste vide tant que rien n’est réglé', async () => {
    const res = await request(setup()).get('/api/platforms');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('trie les plateformes par nom, sans tenir compte de la casse', async () => {
    const app = setup();
    for (const name of ['eBay', 'Vinted', 'amazon']) {
      await create(app, { name });
    }

    expect((await list(app)).map((item) => item.name)).toEqual(['amazon', 'eBay', 'Vinted']);
  });
});

describe('POST /api/platforms', () => {
  it('ajoute une plateforme, la première devenant la plateforme par défaut', async () => {
    const app = setup();

    const first = await create(app, { name: '  Vinted ' });
    const second = await create(app, { name: 'eBay' });

    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ name: 'Vinted', publishUrl: null, isDefault: true });
    expect(second.body.isDefault).toBe(false);
  });

  it('garde l’adresse de dépôt d’une plateforme personnalisée', async () => {
    const res = await create(setup(), {
      name: 'BDfugue',
      publishUrl: ' https://www.bdfugue.com/vendre ',
    });

    expect(res.body).toMatchObject({ publishUrl: 'https://www.bdfugue.com/vendre' });
  });

  it('refuse un doublon, à la casse près', async () => {
    const app = setup();
    await create(app, { name: 'Vinted' });

    const res = await create(app, { name: 'vinted' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'duplicate' });
    expect(await list(app)).toHaveLength(1);
  });

  it.each([
    ['un nom vide', { name: '   ' }],
    ['un nom trop long', { name: 'x'.repeat(101) }],
    ['une adresse javascript:', { name: 'X', publishUrl: 'javascript:alert(1)' }],
    ['une adresse data:', { name: 'X', publishUrl: 'data:text/html,<b>x</b>' }],
    ['une adresse sans protocole', { name: 'X', publishUrl: 'www.vinted.fr' }],
    ['une adresse trop longue', { name: 'X', publishUrl: `https://a.fr/${'x'.repeat(500)}` }],
  ])('rejette %s', async (_label, body) => {
    const app = setup();

    expect((await create(app, body)).status).toBe(400);
    expect(await list(app)).toEqual([]);
  });
});

describe('PATCH /api/platforms/:id', () => {
  it('modifie ou efface l’adresse de dépôt', async () => {
    const app = setup();
    const { id } = (await create(app, { name: 'BDfugue' })).body;

    const set = await request(app)
      .patch(`/api/platforms/${id}`)
      .send({ publishUrl: 'https://www.bdfugue.com/' });
    const cleared = await request(app).patch(`/api/platforms/${id}`).send({ publishUrl: null });

    expect(set.body.publishUrl).toBe('https://www.bdfugue.com/');
    expect(cleared.body.publishUrl).toBeNull();
  });

  it('rejette une adresse dangereuse et répond 404 pour une plateforme inconnue', async () => {
    const app = setup();
    const { id } = (await create(app, { name: 'BDfugue' })).body;

    expect(
      (await request(app).patch(`/api/platforms/${id}`).send({ publishUrl: 'javascript:alert(1)' }))
        .status,
    ).toBe(400);
    expect((await request(app).patch('/api/platforms/999').send({ publishUrl: null })).status).toBe(
      404,
    );
  });
});

describe('PUT /api/platforms/default', () => {
  it('change la plateforme par défaut, une seule à la fois', async () => {
    const app = setup();
    await create(app, { name: 'Vinted' });
    const { id } = (await create(app, { name: 'eBay' })).body;

    const res = await request(app).put('/api/platforms/default').send({ id });

    expect(res.status).toBe(204);
    expect((await list(app)).map((item) => [item.name, item.isDefault])).toEqual([
      ['eBay', true],
      ['Vinted', false],
    ]);
  });

  it('retire la plateforme par défaut avec id null', async () => {
    const app = setup();
    await create(app, { name: 'Vinted' });

    expect((await request(app).put('/api/platforms/default').send({ id: null })).status).toBe(204);

    expect((await list(app)).some((item) => item.isDefault)).toBe(false);
  });

  it('répond 404 pour une plateforme inconnue sans perdre l’actuelle', async () => {
    const app = setup();
    await create(app, { name: 'Vinted' });

    const res = await request(app).put('/api/platforms/default').send({ id: 999 });

    expect(res.status).toBe(404);
    expect((await list(app))[0].isDefault).toBe(true);
  });

  it('rejette un corps invalide', async () => {
    expect((await request(setup()).put('/api/platforms/default').send({})).status).toBe(400);
  });
});

describe('DELETE /api/platforms/:id', () => {
  it('retire la plateforme, sans en désigner une autre par défaut', async () => {
    const app = setup();
    const { id } = (await create(app, { name: 'Vinted' })).body;
    await create(app, { name: 'eBay' });

    expect((await request(app).delete(`/api/platforms/${id}`)).status).toBe(204);

    const items = await list(app);
    expect(items.map((item) => item.name)).toEqual(['eBay']);
    expect(items[0].isDefault).toBe(false);
  });

  it('répond 404 pour une plateforme inconnue', async () => {
    expect((await request(setup()).delete('/api/platforms/999')).status).toBe(404);
  });

  it('ne touche pas à l’historique des ventes', async () => {
    const app = setup();
    const { id } = (await create(app, { name: 'Vinted' })).body;
    const copy = (
      await request(app)
        .post('/api/copies')
        .send({ work: { title: 'Tintin' }, edition: { format: 'book' } })
    ).body;
    await request(app).post(`/api/copies/${copy.id}/sale`).send({ platform: 'Vinted' });

    await request(app).delete(`/api/platforms/${id}`);

    expect((await request(app).get(`/api/copies/${copy.id}/sale`)).body.platform).toBe('Vinted');
  });
});
