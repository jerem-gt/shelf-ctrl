import { describe, expect, it, vi } from 'vitest';

import { addTestUser, createTestDb } from '../../tests/testDb.js';
import { announceSetupToken, hasUsers, SetupToken } from './setup.js';

describe('SetupToken', () => {
  it('génère un jeton base64url de 43 caractères, différent à chaque instance', () => {
    const a = new SetupToken().current();
    const b = new SetupToken().current();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('verify accepte le bon jeton et refuse les autres (y compris de longueur différente)', () => {
    const token = new SetupToken();
    expect(token.verify(token.current() as string)).toBe(true);
    expect(token.verify('nope')).toBe(false);
    expect(token.verify('')).toBe(false);
  });

  it('consume invalide le jeton', () => {
    const token = new SetupToken();
    const value = token.current() as string;
    token.consume();
    expect(token.current()).toBeNull();
    expect(token.verify(value)).toBe(false);
  });
});

describe('announceSetupToken', () => {
  it('écrit une ligne "setup token: <jeton>" quand aucun compte n’existe', () => {
    const db = createTestDb();
    const token = new SetupToken();
    const log = vi.fn();
    announceSetupToken(db, token, log);
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][0]).toContain(`setup token: ${token.current()}`);
  });

  it('n’écrit rien si un compte existe déjà', () => {
    const db = createTestDb();
    addTestUser(db, 'alice');
    const log = vi.fn();
    announceSetupToken(db, new SetupToken(), log);
    expect(log).not.toHaveBeenCalled();
    expect(hasUsers(db)).toBe(true);
  });
});
