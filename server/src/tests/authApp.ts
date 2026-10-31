import request from 'supertest';
import { vi } from 'vitest';

import { type AuthOptions, createApp } from '../app.js';
import { createTestDb, type TestDb } from './testDb.js';

export const TEST_SECRET = 'a'.repeat(40);

/** Application avec authentification, sans SMTP, journal espionné. */
export function createAuthApp(options: Partial<AuthOptions> & { db?: TestDb } = {}) {
  const { db = createTestDb(), ...auth } = options;
  const mailer = { isConfigured: () => false, send: () => Promise.resolve() };
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const app = createApp(db, {
    barcodeProviders: [],
    titleSearchProviders: [],
    auth: { sessionSecret: TEST_SECRET, secureCookies: false, mailer, log, ...auth },
  });
  return { db, app, log };
}

export type TestApp = ReturnType<typeof createAuthApp>['app'];

/** Agent connecté (cookie de session conservé entre les requêtes). */
export async function loginAgent(app: TestApp, username: string, password = 'password') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ username, password });
  if (res.status !== 200) {
    throw new Error(`Connexion de ${username} refusée : ${res.status}`);
  }
  return agent;
}
