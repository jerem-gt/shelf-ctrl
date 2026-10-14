import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createDb, initDatabase } from '../../db/init.js';
import { syncAdminUser } from './auth.repo.js';

const SECRET = 'a'.repeat(40);
const PASSWORD = 'correct-horse';
// Coût bcrypt minimal : les tests n'ont pas besoin de la lenteur de la production.
const TEST_COST = 4;

function setup({ secureCookies = false } = {}) {
  const db = createDb(':memory:');
  initDatabase(db);
  syncAdminUser(db, 'admin', PASSWORD, TEST_COST);
  const options = { barcodeProviders: [], auth: { sessionSecret: SECRET, secureCookies } };
  return { db, options, app: createApp(db, options) };
}

type TestApp = ReturnType<typeof setup>['app'];

const login = (app: TestApp, body: object = { username: 'admin', password: PASSWORD }) =>
  request(app).post('/api/auth/login').send(body);

const cookieOf = (res: request.Response) => (res.headers['set-cookie'] as unknown as string[])[0];
const sessionCookie = (res: request.Response) => cookieOf(res).split(';')[0];

describe('accès aux routes protégées', () => {
  it.each([
    ['GET', '/api/copies'],
    ['POST', '/api/copies'],
    ['GET', '/api/barcodes/9782203001190'],
    ['GET', '/api/loans'],
    ['GET', '/api/borrowers'],
    ['GET', '/api/sales'],
  ])('refuse %s %s sans session', async (method, path) => {
    const { app } = setup();
    const res = await request(app)[method.toLowerCase() as 'get' | 'post'](path);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('laisse la route de santé publique', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  it('donne accès à l’API une fois connecté', async () => {
    const { app } = setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'admin', password: PASSWORD });

    expect((await agent.get('/api/copies')).status).toBe(200);
    expect((await agent.get('/api/sales')).status).toBe(200);
  });

  it('refuse un cookie de session falsifié', async () => {
    const { app } = setup();
    const res = await request(app)
      .get('/api/copies')
      .set('Cookie', 'shelfctrl.sid=s%3Aforged.invalidsignature');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/login', () => {
  it('connecte l’administrateur et pose un cookie de session sûr', async () => {
    const { app } = setup();
    const res = await login(app);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: 'admin' });
    const cookie = cookieOf(res);
    expect(cookie).toMatch(/^shelfctrl\.sid=/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Secure');
  });

  it.each([
    ['mot de passe incorrect', { username: 'admin', password: 'wrong' }],
    ['identifiant inconnu', { username: 'root', password: PASSWORD }],
  ])('refuse un %s sans ouvrir de session', async (_label, body) => {
    const { app } = setup();
    const res = await login(app, body);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_credentials' });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it.each([
    ['sans corps', {}],
    ['sans mot de passe', { username: 'admin' }],
    ['identifiant vide', { username: '', password: PASSWORD }],
    ['identifiant trop long', { username: 'a'.repeat(201), password: PASSWORD }],
  ])('rejette une requête %s', async (_label, body) => {
    const { app } = setup();
    const res = await login(app, body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'validation' });
  });

  it('change d’identifiant de session à chaque connexion', async () => {
    const { app } = setup();
    const first = sessionCookie(await login(app));
    const second = sessionCookie(await login(app));

    expect(second).not.toBe(first);
  });

  it('marque le cookie Secure derrière HTTPS seulement (mode « auto »)', async () => {
    const { app } = setup({ secureCookies: true });
    app.set('trust proxy', 1);

    const https = await login(app).set('X-Forwarded-Proto', 'https');
    expect(cookieOf(https)).toContain('Secure');

    const http = await login(app);
    expect(http.status).toBe(200);
    expect(cookieOf(http)).not.toContain('Secure');
  });
});

describe('limitation des tentatives', () => {
  const failAttempts = async (app: TestApp, count: number) => {
    for (let i = 0; i < count; i += 1) {
      await login(app, { username: 'admin', password: 'wrong' });
    }
  };

  it('bloque la connexion après 10 échecs, même avec le bon mot de passe', async () => {
    const { app } = setup();
    await failAttempts(app, 10);

    const res = await login(app);

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'too_many_attempts' });
  });

  it('remet le compteur à zéro après une connexion réussie', async () => {
    const { app } = setup();
    await failAttempts(app, 9);
    expect((await login(app)).status).toBe(200);

    await failAttempts(app, 9);

    expect((await login(app)).status).toBe(200);
  });
});

describe('GET /api/auth/me et POST /api/auth/logout', () => {
  it('renvoie l’utilisateur connecté, 401 sinon', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/auth/me')).status).toBe(401);

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'admin', password: PASSWORD });
    const me = await agent.get('/api/auth/me');

    expect(me.status).toBe(200);
    expect(me.body).toEqual({ username: 'admin' });
  });

  it('déconnecte : le cookie est effacé et l’API se referme', async () => {
    const { app } = setup();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'admin', password: PASSWORD });

    const out = await agent.post('/api/auth/logout');

    expect(out.status).toBe(204);
    expect(cookieOf(out)).toMatch(/^shelfctrl\.sid=;/);
    expect((await agent.get('/api/copies')).status).toBe(401);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('accepte une déconnexion sans session', async () => {
    const { app } = setup();
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
  });
});

describe('persistance des sessions', () => {
  it('garde la session après un redémarrage (même base, nouvelle instance)', async () => {
    const { app, db, options } = setup();
    const cookie = sessionCookie(await login(app));

    const restarted = createApp(db, options);

    const res = await request(restarted).get('/api/copies').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  it('invalide les sessions quand le mot de passe change dans l’environnement', async () => {
    const { app, db } = setup();
    const cookie = sessionCookie(await login(app));
    expect((await request(app).get('/api/copies').set('Cookie', cookie)).status).toBe(200);

    syncAdminUser(db, 'admin', 'another-password', TEST_COST);

    expect((await request(app).get('/api/copies').set('Cookie', cookie)).status).toBe(401);
    expect((await login(app, { username: 'admin', password: 'another-password' })).status).toBe(
      200,
    );
  });
});
