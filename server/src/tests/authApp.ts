import request from 'supertest';
import { vi } from 'vitest';

import { type AuthOptions, createApp } from '../app.js';
import type { Mailer, MailMessage } from '../lib/mailer.js';
import { createTestDb, type TestDb } from './testDb.js';

export const TEST_SECRET = 'a'.repeat(40);

export interface FakeMailer extends Mailer {
  sent: MailMessage[];
}

/** Mailer de test : mémorise les messages, aucun SMTP réel. */
export function createFakeMailer(
  options: { configured?: boolean; fail?: boolean } = {},
): FakeMailer {
  const { configured = true, fail = false } = options;
  const sent: MailMessage[] = [];
  return {
    sent,
    isConfigured: () => configured,
    send: (message) => {
      if (fail) {
        return Promise.reject(new Error('smtp down'));
      }
      sent.push(message);
      return Promise.resolve();
    },
  };
}

/** Application avec authentification, mailer factice et journal espionné. */
export function createAuthApp(
  options: Partial<Omit<AuthOptions, 'mailer'>> & { db?: TestDb; mailer?: FakeMailer } = {},
) {
  const { db = createTestDb(), mailer = createFakeMailer(), ...auth } = options;
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const app = createApp(db, {
    barcodeProviders: [],
    titleSearchProviders: [],
    auth: { sessionSecret: TEST_SECRET, secureCookies: false, mailer, log, ...auth },
  });
  return { db, app, mailer, log };
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
