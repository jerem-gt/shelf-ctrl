import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createDb, initDatabase } from '../db/init.js';

function setup(auth?: { sessionSecret: string; secureCookies: boolean }) {
  const db = createDb(':memory:');
  initDatabase(db);
  return createApp(db, { barcodeProviders: [], titleSearchProviders: [], auth });
}

describe('GET /api/docs/openapi.json', () => {
  it('retourne la spec OpenAPI 3.1 avec les champs attendus', async () => {
    const res = await request(setup()).get('/api/docs/openapi.json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.info.title).toBe('ShelfCtrl API');
    expect(res.body.components.securitySchemes.sessionCookie.name).toBe('shelfctrl.sid');
    expect(res.body.paths['/api/copies'].post.requestBody).toBeDefined();
  });

  it('documente les paramètres de requête de la liste des exemplaires', async () => {
    const res = await request(setup()).get('/api/docs/openapi.json');

    const names = res.body.paths['/api/copies'].get.parameters.map(
      (param: { name: string }) => param.name,
    );
    expect(names).toEqual(['q', 'format', 'status', 'limit', 'offset']);
  });

  it('reste accessible sans session, contrairement au reste de l’API', async () => {
    const app = setup({ sessionSecret: 'x'.repeat(32), secureCookies: false });

    expect((await request(app).get('/api/docs/openapi.json')).status).toBe(200);
    expect((await request(app).get('/api/docs/')).status).toBe(200);
    expect((await request(app).get('/api/copies')).status).toBe(401);
  });
});
