import { describe, expect, it } from 'vitest';

import { loadAuthConfig } from './config.js';

const SECRET = 'a'.repeat(32);

describe('loadAuthConfig', () => {
  it('lit la configuration de production', () => {
    const config = loadAuthConfig({
      NODE_ENV: 'production',
      SESSION_SECRET: SECRET,
      SECURE_COOKIE: 'true',
      APP_URL: ' https://shelf.example.com// ',
    });

    expect(config).toEqual({
      sessionSecret: SECRET,
      secureCookies: true,
      appUrl: 'https://shelf.example.com',
      obsoleteAdminVariables: false,
    });
  });

  it('sans SECURE_COOKIE ni APP_URL : cookies non sécurisés, pas d’URL publique', () => {
    const config = loadAuthConfig({ NODE_ENV: 'production', SESSION_SECRET: SECRET, APP_URL: '' });

    expect(config.secureCookies).toBe(false);
    expect(config.appUrl).toBeUndefined();
  });

  it('signale ADMIN_USER / ADMIN_PASSWORD, devenues obsolètes', () => {
    expect(
      loadAuthConfig({ SESSION_SECRET: SECRET, ADMIN_PASSWORD: 'changeme' }).obsoleteAdminVariables,
    ).toBe(true);
    expect(loadAuthConfig({ SESSION_SECRET: SECRET, ADMIN_USER: '' }).obsoleteAdminVariables).toBe(
      false,
    );
  });

  it.each([
    ['secret absent', undefined],
    ['secret vide, comme un compose dont la variable manque', ''],
    ['secret trop court', 'a'.repeat(31)],
  ])('refuse de démarrer en production : %s', (_label, secret) => {
    expect(() => loadAuthConfig({ NODE_ENV: 'production', SESSION_SECRET: secret })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it('accepte un secret d’exemple hors production, mais l’exige', () => {
    expect(loadAuthConfig({ SESSION_SECRET: 'dev-secret' }).sessionSecret).toBe('dev-secret');
    expect(() => loadAuthConfig({})).toThrow(/requis/);
  });
});
