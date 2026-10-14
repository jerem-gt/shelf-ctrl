import { describe, expect, it } from 'vitest';

import { loadAuthConfig } from './config.js';

const SECRET = 'a'.repeat(32);

describe('loadAuthConfig', () => {
  it('lit la configuration de production', () => {
    const config = loadAuthConfig({
      NODE_ENV: 'production',
      SESSION_SECRET: SECRET,
      ADMIN_USER: ' jerem ',
      ADMIN_PASSWORD: 'long-enough',
      SECURE_COOKIE: 'true',
    });

    expect(config).toEqual({
      adminUser: 'jerem',
      adminPassword: 'long-enough',
      sessionSecret: SECRET,
      secureCookies: true,
    });
  });

  it('utilise « admin » par défaut et des cookies non sécurisés sans SECURE_COOKIE', () => {
    const config = loadAuthConfig({
      NODE_ENV: 'production',
      SESSION_SECRET: SECRET,
      ADMIN_PASSWORD: 'long-enough',
    });

    expect(config.adminUser).toBe('admin');
    expect(config.secureCookies).toBe(false);
  });

  it.each([
    ['secret absent', { SESSION_SECRET: undefined }, /SESSION_SECRET/],
    [
      'secret vide, comme un compose dont la variable manque',
      { SESSION_SECRET: '' },
      /SESSION_SECRET/,
    ],
    ['secret trop court', { SESSION_SECRET: 'a'.repeat(31) }, /SESSION_SECRET/],
    ['mot de passe absent', { ADMIN_PASSWORD: undefined }, /ADMIN_PASSWORD/],
    ['mot de passe vide', { ADMIN_PASSWORD: '' }, /ADMIN_PASSWORD/],
    ['mot de passe trop court', { ADMIN_PASSWORD: 'short' }, /ADMIN_PASSWORD/],
  ])('refuse de démarrer en production : %s', (_label, override, message) => {
    const env = {
      NODE_ENV: 'production',
      SESSION_SECRET: SECRET,
      ADMIN_PASSWORD: 'long-enough',
      ...override,
    };

    expect(() => loadAuthConfig(env)).toThrow(message);
  });

  it('accepte les valeurs d’exemple hors production, mais les exige', () => {
    expect(
      loadAuthConfig({ SESSION_SECRET: 'dev-secret', ADMIN_PASSWORD: 'changeme' }).sessionSecret,
    ).toBe('dev-secret');
    expect(() => loadAuthConfig({ ADMIN_PASSWORD: 'changeme' })).toThrow(/requis/);
    expect(() => loadAuthConfig({ SESSION_SECRET: 'dev-secret' })).toThrow(/requis/);
  });
});
