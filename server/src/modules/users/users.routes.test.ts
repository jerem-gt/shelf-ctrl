import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createAuthApp, loginAgent, TEST_SECRET } from '../../tests/authApp.js';
import { addTestUser, createTestDb } from '../../tests/testDb.js';

function setup() {
  const ctx = createAuthApp();
  const adminId = addTestUser(ctx.db, 'admin', { isAdmin: true, email: 'admin@example.com' });
  const bobId = addTestUser(ctx.db, 'bob', { email: 'bob@example.com' });
  return { ...ctx, adminId, bobId };
}

const asAdmin = async () => {
  const ctx = setup();
  return { ...ctx, agent: await loginAgent(ctx.app, 'admin') };
};

describe('GET /api/users', () => {
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
      expect.objectContaining({ username: 'admin', isAdmin: true, copyCount: 0, lastCopyAt: null }),
      expect.objectContaining({
        username: 'bob',
        email: 'bob@example.com',
        isAdmin: false,
        copyCount: 2,
        lastCopyAt: '2026-03-01 10:00:00',
      }),
    ]);
  });

  it('retourne 403 pour un non-admin et 401 sans session', async () => {
    const { app } = setup();
    const bob = await loginAgent(app, 'bob');
    expect((await bob.get('/api/users')).status).toBe(403);
    expect((await request(app).get('/api/users')).status).toBe(401);
  });
});

describe('POST /api/users', () => {
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

  it.each([
    ['nom pris', { username: 'bob' }, 'user.username_taken'],
    ['e-mail pris', { username: 'carol', email: 'BOB@example.com' }, 'user.email_taken'],
  ])('retourne 409 : %s', async (_label, body, error) => {
    const { agent } = await asAdmin();
    const res = await agent.post('/api/users').send({ password: 'long-enough', ...body });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(error);
  });

  it.each([
    ['mot de passe trop court', { username: 'carol', password: 'short' }],
    ['e-mail invalide', { username: 'carol', password: 'long-enough', email: 'x' }],
  ])('retourne 400 : %s', async (_label, body) => {
    const { agent } = await asAdmin();
    expect((await agent.post('/api/users').send(body)).status).toBe(400);
  });

  it('retourne 403 pour un non-admin', async () => {
    const { app } = setup();
    const bob = await loginAgent(app, 'bob');
    const res = await bob.post('/api/users').send({ username: 'x', password: 'long-enough' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/users/:id', () => {
  it('modifie le nom et l’e-mail, puis efface l’e-mail avec null', async () => {
    const { agent, bobId } = await asAdmin();
    const res = await agent
      .patch(`/api/users/${bobId}`)
      .send({ username: 'robert', email: 'Robert@example.com' });
    expect(res.body).toMatchObject({ username: 'robert', email: 'robert@example.com' });
    const cleared = await agent.patch(`/api/users/${bobId}`).send({ email: null });
    expect(cleared.body.email).toBeNull();
  });

  it('promeut un compte, qui accède tout de suite à /api/users', async () => {
    const { agent, app, bobId } = await asAdmin();
    const bob = await loginAgent(app, 'bob');
    await agent.patch(`/api/users/${bobId}`).send({ isAdmin: true });
    expect((await bob.get('/api/users')).status).toBe(200);
  });

  it('un admin rétrogradé perd ses droits immédiatement', async () => {
    const { agent, app, bobId } = await asAdmin();
    await agent.patch(`/api/users/${bobId}`).send({ isAdmin: true });
    const bob = await loginAgent(app, 'bob');
    await agent.patch(`/api/users/${bobId}`).send({ isAdmin: false });
    expect((await bob.get('/api/users')).status).toBe(403);
  });

  it('refuse de rétrograder le dernier admin, accepte s’il en reste un autre', async () => {
    const { agent, adminId, bobId } = await asAdmin();
    const last = await agent.patch(`/api/users/${adminId}`).send({ isAdmin: false });
    expect(last.status).toBe(409);
    expect(last.body.error.code).toBe('user.last_admin');

    await agent.patch(`/api/users/${bobId}`).send({ isAdmin: true });
    expect((await agent.patch(`/api/users/${adminId}`).send({ isAdmin: false })).status).toBe(200);
  });

  it('deux admins qui se rétrogradent l’un l’autre en même temps en laissent un', async () => {
    const { agent, app, db, adminId, bobId } = await asAdmin();
    await agent.patch(`/api/users/${bobId}`).send({ isAdmin: true });
    const bob = await loginAgent(app, 'bob');

    // Le mot de passe impose un hachage asynchrone entre la vérification et l'écriture.
    const results = await Promise.all([
      agent.patch(`/api/users/${bobId}`).send({ isAdmin: false, password: 'new-password' }),
      bob.patch(`/api/users/${adminId}`).send({ isAdmin: false, password: 'new-password' }),
    ]);

    expect(results.map((res) => res.status).sort((a, b) => a - b)).toEqual([200, 409]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get()).toEqual({
      n: 1,
    });
  }, 20_000);

  it('redéfinir le mot de passe d’un autre compte ferme toutes ses sessions', async () => {
    const { agent, app, bobId } = await asAdmin();
    const bob = await loginAgent(app, 'bob');
    await agent.patch(`/api/users/${bobId}`).send({ password: 'new-password' });
    expect((await bob.get('/api/auth/me')).status).toBe(401);
    await loginAgent(app, 'bob', 'new-password');
  });

  it('redéfinir son propre mot de passe garde la session courante, ferme les autres', async () => {
    const { agent, app, adminId } = await asAdmin();
    const other = await loginAgent(app, 'admin');
    await agent.patch(`/api/users/${adminId}`).send({ password: 'new-password' });
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await other.get('/api/auth/me')).status).toBe(401);
  });

  it('accepte de renvoyer son propre nom, refuse celui d’un autre', async () => {
    const { agent, adminId } = await asAdmin();
    expect((await agent.patch(`/api/users/${adminId}`).send({ username: 'admin' })).status).toBe(
      200,
    );
    const taken = await agent.patch(`/api/users/${adminId}`).send({ username: 'bob' });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('user.username_taken');
  });

  it('retourne 404 pour un compte inconnu et 400 pour un corps vide', async () => {
    const { agent, bobId } = await asAdmin();
    expect((await agent.patch('/api/users/999').send({ username: 'x' })).status).toBe(404);
    expect((await agent.patch(`/api/users/${bobId}`).send({})).status).toBe(400);
  });
});

describe('DELETE /api/users/:id', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
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

  it('refuse de supprimer son propre compte', async () => {
    const { agent, adminId } = await asAdmin();
    const res = await agent.delete(`/api/users/${adminId}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('user.cannot_delete_self');
  });

  it('supprime un autre admin s’il en reste un, 404 pour un inconnu', async () => {
    const { agent, bobId } = await asAdmin();
    await agent.patch(`/api/users/${bobId}`).send({ isAdmin: true });
    expect((await agent.delete(`/api/users/${bobId}`)).status).toBe(204);
    expect((await agent.delete('/api/users/999')).status).toBe(404);
  });
});
