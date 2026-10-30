import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { loginAgent, TEST_SECRET } from './tests/authApp.js';
import { addTestUser, createTestDb } from './tests/testDb.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const TINTIN = {
  work: { title: 'Tintin au Tibet', series: 'Tintin', volumeNumber: 20 },
  edition: { format: 'book', barcode: '9782203001190' },
};

/** Requêtes une à une : supertest ouvre un serveur par requête. */
async function inSequence(requests: (() => PromiseLike<{ status: number }>)[]) {
  const statuses: { status: number }[] = [];
  for (const send of requests) {
    statuses.push(await send());
  }
  return statuses;
}

/** Deux comptes sur la même base : alice a un exemplaire prêté, un en vente, une pochette. */
async function setup() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfctrl-isolation-'));
  tempDirs.push(dataDir);
  const db = createTestDb();
  addTestUser(db, 'alice', { isAdmin: true });
  addTestUser(db, 'bob');
  const app = createApp(db, {
    barcodeProviders: [],
    titleSearchProviders: [],
    images: { dataDir, coverProviders: [] },
    auth: { sessionSecret: TEST_SECRET, secureCookies: false },
  });
  const alice = await loginAgent(app, 'alice');
  const bob = await loginAgent(app, 'bob');

  const loaned = (await alice.post('/api/copies').send(TINTIN)).body as {
    id: number;
    edition: { id: number };
  };
  const listed = (await alice.post('/api/copies').send(TINTIN)).body as { id: number };
  const loan = (await alice.post(`/api/copies/${loaned.id}/loans`).send({ borrowerName: 'Paul' }))
    .body as { id: number };
  await alice.post(`/api/copies/${listed.id}/sale`).send({ platform: 'Vinted' });
  const platform = (await alice.post('/api/platforms').send({ name: 'Vinted' })).body as {
    id: number;
  };
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#f00' } })
    .png()
    .toBuffer();
  const cover = (
    await alice
      .put(`/api/editions/${loaned.edition.id}/cover`)
      .set('Content-Type', 'image/png')
      .send(png)
  ).body as { coverPath: string };
  await alice.put(`/api/copies/${loaned.id}/photo`).set('Content-Type', 'image/png').send(png);
  const photoPath = ((await alice.get(`/api/copies/${loaned.id}`)).body as { photoPath: string })
    .photoPath;

  return { db, app, alice, bob, loaned, listed, loan, platform, cover, photoPath, png };
}

describe('isolation des comptes', () => {
  it('les listes d’un compte ne montrent rien des autres', async () => {
    const { alice, bob } = await setup();

    expect((await bob.get('/api/copies')).body).toEqual({ items: [], total: 0 });
    expect((await bob.get('/api/loans')).body).toEqual([]);
    expect((await bob.get('/api/borrowers')).body).toEqual([]);
    expect((await bob.get('/api/sales')).body).toEqual([]);
    expect((await bob.get('/api/platforms')).body).toEqual({ items: [] });
    expect((await alice.get('/api/copies')).body.total).toBe(2);
  });

  it('un exemplaire d’un autre compte est introuvable (404), en lecture comme en écriture', async () => {
    const { alice, bob, loaned, listed, png } = await setup();
    const responses = await inSequence([
      () => bob.get(`/api/copies/${loaned.id}`),
      () => bob.patch(`/api/copies/${loaned.id}`).send({ location: 'Chez Bob' }),
      () => bob.get(`/api/copies/${loaned.id}/loans`),
      () => bob.post(`/api/copies/${listed.id}/loans`).send({ borrowerName: 'Bob' }),
      () => bob.get(`/api/copies/${listed.id}/sale`),
      () => bob.post(`/api/copies/${loaned.id}/sale`).send({ platform: 'eBay' }),
      () => bob.patch(`/api/copies/${listed.id}/sale`).send({ priceCents: 1 }),
      () => bob.post(`/api/copies/${listed.id}/sale/sold`).send({}),
      () => bob.delete(`/api/copies/${listed.id}/sale`),
      () => bob.put(`/api/copies/${loaned.id}/photo`).set('Content-Type', 'image/png').send(png),
      () => bob.delete(`/api/copies/${loaned.id}/photo`),
    ]);
    expect(responses.map((res) => res.status)).toEqual(Array(responses.length).fill(404));

    expect((await bob.delete(`/api/copies/${listed.id}`)).status).toBe(404);
    const copy = (await alice.get(`/api/copies/${listed.id}`)).body as {
      status: string;
      location: string | null;
    };
    expect(copy.status).toBe('listed');
  });

  it('un prêt, une pochette et une plateforme d’un autre compte sont introuvables', async () => {
    const { bob, loan, loaned, platform, png } = await setup();
    const responses = await inSequence([
      () => bob.post(`/api/loans/${loan.id}/return`).send({}),
      () =>
        bob
          .put(`/api/editions/${loaned.edition.id}/cover`)
          .set('Content-Type', 'image/png')
          .send(png),
      () => bob.delete(`/api/editions/${loaned.edition.id}/cover`),
      () => bob.post(`/api/editions/${loaned.edition.id}/cover/fetch`),
      () => bob.patch(`/api/platforms/${platform.id}`).send({ publishUrl: null }),
      () => bob.delete(`/api/platforms/${platform.id}`),
      () => bob.put('/api/platforms/default').send({ id: platform.id }),
    ]);
    expect(responses.map((res) => res.status)).toEqual(Array(responses.length).fill(404));
  });

  it('les appareils mémorisés d’un compte ne sont ni listés ni oubliables par un autre', async () => {
    const { db, alice, bob } = await setup();
    const { id: aliceId } = (await alice.get('/api/auth/me')).body as { id: number };
    db.prepare(
      `INSERT INTO trusted_devices (user_id, token_hash, label, created_at, last_used_at, expires_at)
       VALUES (?, 'hash', 'Firefox · Linux', 1, 1, ?)`,
    ).run(aliceId, Date.now() + 60_000);

    expect((await bob.get('/api/auth/devices')).body).toEqual({ items: [] });
    expect((await alice.get('/api/auth/devices')).body.items).toHaveLength(1);
    const { id } = (await alice.get('/api/auth/devices')).body.items[0] as { id: number };
    expect((await bob.delete(`/api/auth/devices/${id}`)).status).toBe(404);
    expect((await bob.delete('/api/auth/devices')).status).toBe(204);
    expect((await alice.get('/api/auth/devices')).body.items).toHaveLength(1);
  });

  it('les images d’un compte ne sont servies qu’à lui', async () => {
    const { alice, bob, cover, photoPath } = await setup();

    expect((await alice.get(`/covers/${cover.coverPath}`)).status).toBe(200);
    expect((await alice.get(`/photos/${photoPath}`)).status).toBe(200);
    expect((await bob.get(`/covers/${cover.coverPath}`)).status).toBe(404);
    expect((await bob.get(`/photos/${photoPath}`)).status).toBe(404);
  });

  it('un même code-barres, emprunteur ou plateforme vit séparément dans chaque compte', async () => {
    const { alice, bob } = await setup();

    const lookup = await bob.get('/api/barcodes/9782203001190');
    expect(lookup.status).toBe(404);

    const bobCopy = (await bob.post('/api/copies').send(TINTIN)).body as { id: number };
    expect(
      (await bob.post(`/api/copies/${bobCopy.id}/loans`).send({ borrowerName: 'Paul' })).status,
    ).toBe(201);
    expect((await bob.post('/api/platforms').send({ name: 'Vinted' })).status).toBe(201);

    expect((await bob.get('/api/barcodes/9782203001190')).body.source).toBe('local');
    expect((await bob.get('/api/borrowers')).body).toEqual([
      expect.objectContaining({ name: 'Paul', openLoans: 1 }),
    ]);
    expect((await alice.get('/api/borrowers')).body).toEqual([
      expect.objectContaining({ name: 'Paul', openLoans: 1 }),
    ]);
  });

  it('l’import se fait par compte : doublons, tâche suivie et import simultané', async () => {
    const { alice, bob } = await setup();
    const csv = Buffer.from(
      'Titre;Série;Tome;Format;Code-barres\nTintin au Tibet;Tintin;20;Livre;9782203001190\n',
    );
    const send = (agent: typeof alice, url: string) =>
      agent.post(url).set('Content-Type', 'application/octet-stream').send(csv);

    expect((await send(alice, '/api/import/preview')).body.duplicates).toBe(1);
    expect((await send(bob, '/api/import/preview')).body.duplicates).toBe(0);

    const job = (await send(alice, '/api/import')).body as { id: string };
    expect((await send(bob, '/api/import')).status).toBe(202);
    expect((await bob.get(`/api/import/${job.id}`)).status).toBe(404);
    expect((await alice.get(`/api/import/${job.id}`)).status).toBe(200);
  });
});
