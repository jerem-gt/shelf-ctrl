import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createAuthApp, loginAgent, TEST_SECRET, type TestApp } from '../../tests/authApp.js';
import { addTestUser, createTestDb } from '../../tests/testDb.js';

// Comptes et authentification viennent du module de ctrl-shared, testé là-bas : ici, ce qui est
// propre à ShelfCtrl (routes protégées, cookie, statistiques, collection et images d'un compte).

const PASSWORD = 'correct-horse';

function setup() {
  const ctx = createAuthApp();
  const userId = addTestUser(ctx.db, 'admin', {
    password: PASSWORD,
    email: 'admin@example.com',
    isAdmin: true,
  });
  const bobId = addTestUser(ctx.db, 'bob', { email: 'bob@example.com' });
  return { ...ctx, userId, adminId: userId, bobId };
}

const asAdmin = async () => {
  const ctx = setup();
  return { ...ctx, agent: await loginAgent(ctx.app, 'admin', PASSWORD) };
};

const login = (app: TestApp, body: object = { username: 'admin', password: PASSWORD }) =>
  request(app).post('/api/auth/login').send(body);
const cookieOf = (res: request.Response) => (res.headers['set-cookie'] as unknown as string[])[0];

describe('accès aux routes protégées', () => {
  it.each([
    ['GET', '/api/copies'],
    ['POST', '/api/copies'],
    ['GET', '/api/barcodes/9782203001190'],
    ['GET', '/api/loans'],
    ['GET', '/api/borrowers'],
    ['GET', '/api/sales'],
    ['GET', '/api/users'],
  ])('refuse %s %s sans session', async (method, path) => {
    const { app } = setup();
    const res = await request(app)[method.toLowerCase() as 'get' | 'post'](path);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('common.unauthorized');
  });

  it('laisse la route de santé publique', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  it('donne accès à l’API une fois connecté', async () => {
    const { app } = setup();
    const agent = await loginAgent(app, 'admin', PASSWORD);
    expect((await agent.get('/api/copies')).status).toBe(200);
    expect((await agent.get('/api/sales')).status).toBe(200);
  });
});

describe('cookie de session', () => {
  it('porte le nom de l’appli, HttpOnly et SameSite=Lax', async () => {
    const { app } = setup();
    const cookie = cookieOf(await login(app));
    expect(cookie).toMatch(/^shelfctrl\.sid=/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('déconnecte : le cookie est effacé et l’API se referme', async () => {
    const { app } = setup();
    const agent = await loginAgent(app, 'admin', PASSWORD);
    const out = await agent.post('/api/auth/logout');
    expect(out.status).toBe(204);
    expect(cookieOf(out)).toMatch(/^shelfctrl\.sid=;/);
    expect((await agent.get('/api/copies')).status).toBe(401);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('comptes (page Utilisateurs)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('liste les comptes avec leur nombre d’exemplaires et le dernier ajout', async () => {
    const { agent, db, bobId } = await asAdmin();
    const work = db.prepare("INSERT INTO works (user_id, title) VALUES (?, 'T')").run(bobId);
    const edition = db
      .prepare("INSERT INTO editions (user_id, work_id, format) VALUES (?, ?, 'book')")
      .run(bobId, work.lastInsertRowid);
    const copy = db.prepare(
      'INSERT INTO copies (user_id, edition_id, created_at) VALUES (?, ?, ?)',
    );
    copy.run(bobId, edition.lastInsertRowid, '2026-01-01 10:00:00');
    copy.run(bobId, edition.lastInsertRowid, '2026-03-01 10:00:00');

    const res = await agent.get('/api/users');

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      expect.objectContaining({
        username: 'admin',
        isAdmin: true,
        stats: { copyCount: 0, lastCopyAt: null },
      }),
      expect.objectContaining({
        username: 'bob',
        email: 'bob@example.com',
        isAdmin: false,
        stats: { copyCount: 2, lastCopyAt: '2026-03-01 10:00:00' },
      }),
    ]);
  });

  it('crée un compte, e-mail normalisé, qui peut se connecter avec une collection vide', async () => {
    const { agent, app } = await asAdmin();

    const res = await agent
      .post('/api/users')
      .send({ username: 'carol', password: 'long-enough', email: ' Carol@Example.com' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      username: 'carol',
      email: 'carol@example.com',
      isAdmin: false,
    });
    const carol = await loginAgent(app, 'carol', 'long-enough');
    expect((await carol.get('/api/copies')).body).toEqual({ items: [], total: 0 });
  });

  it('supprime le compte, ses données et ses sessions', async () => {
    const { agent, app, db, bobId } = await asAdmin();
    const bob = await loginAgent(app, 'bob');
    await bob.post('/api/copies').send({ work: { title: 'T' }, edition: { format: 'book' } });
    await bob.post('/api/platforms').send({ name: 'Vinted' });

    expect((await agent.delete(`/api/users/${bobId}`)).status).toBe(204);

    expect((await bob.get('/api/auth/me')).status).toBe(401);
    for (const table of ['users', 'works', 'editions', 'copies', 'platforms']) {
      expect(
        db
          .prepare(
            `SELECT COUNT(*) AS n FROM ${table} WHERE ${table === 'users' ? 'id' : 'user_id'} = ?`,
          )
          .get(bobId),
      ).toEqual({ n: 0 });
    }
  });

  it('efface ses images du disque, pas celles des autres comptes', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfctrl-users-'));
    dirs.push(dataDir);
    const db = createTestDb();
    const adminId = addTestUser(db, 'admin', { isAdmin: true });
    const bobId = addTestUser(db, 'bob');
    const app = createApp(db, {
      barcodeProviders: [],
      images: { dataDir, coverProviders: [] },
      auth: { sessionSecret: TEST_SECRET, secureCookies: false },
    });
    const covers = path.join(dataDir, 'images', 'covers');
    const photos = path.join(dataDir, 'images', 'photos');
    const insert = (userId: number, cover: string, photo: string) => {
      const work = db.prepare("INSERT INTO works (user_id, title) VALUES (?, 'T')").run(userId);
      const edition = db
        .prepare(
          "INSERT INTO editions (user_id, work_id, format, cover_path) VALUES (?, ?, 'book', ?)",
        )
        .run(userId, work.lastInsertRowid, cover);
      db.prepare('INSERT INTO copies (user_id, edition_id, photo_path) VALUES (?, ?, ?)').run(
        userId,
        edition.lastInsertRowid,
        photo,
      );
      fs.writeFileSync(path.join(covers, cover), 'x');
      fs.writeFileSync(path.join(photos, photo), 'x');
    };
    insert(adminId, '1-aaaaaaaaaa.webp', '1-bbbbbbbbbb.webp');
    insert(bobId, '2-cccccccccc.webp', '2-dddddddddd.webp');
    const agent = await loginAgent(app, 'admin');

    expect((await agent.delete(`/api/users/${bobId}`)).status).toBe(204);

    expect(fs.readdirSync(covers)).toEqual(['1-aaaaaaaaaa.webp']);
    expect(fs.readdirSync(photos)).toEqual(['1-bbbbbbbbbb.webp']);
  });
});

describe('sans authentification (tests de modules)', () => {
  it('agit pour le compte indiqué', async () => {
    const db = createTestDb();
    addTestUser(db, 'a');
    const b = addTestUser(db, 'b');
    const app = createApp(db, { barcodeProviders: [], actAsUserId: b });
    await request(app)
      .post('/api/copies')
      .send({ work: { title: 'T' }, edition: { format: 'book' } });
    expect(db.prepare('SELECT user_id FROM copies').get()).toEqual({ user_id: b });
  });
});
