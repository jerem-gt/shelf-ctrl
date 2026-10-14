import { describe, expect, it } from 'vitest';

import { createDb, initDatabase } from '../db/init.js';
import { FailureRateLimiter } from './rateLimit.js';

function setup(maxAttempts = 3, windowMs = 1000) {
  const db = createDb(':memory:');
  initDatabase(db);
  const clock = { now: 1_000_000 };
  const limiter = new FailureRateLimiter(db, maxAttempts, windowMs, () => clock.now);
  return { limiter, clock };
}

describe('FailureRateLimiter', () => {
  it('autorise tant que le seuil d’échecs n’est pas atteint', () => {
    const { limiter } = setup();
    expect(limiter.isAllowed('ip')).toBe(true);

    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(true);

    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(false);
  });

  it('compte chaque clé séparément', () => {
    const { limiter } = setup(1);
    limiter.recordFailure('a');

    expect(limiter.isAllowed('a')).toBe(false);
    expect(limiter.isAllowed('b')).toBe(true);
  });

  it('autorise de nouveau une fois la fenêtre écoulée, et repart de zéro', () => {
    const { limiter, clock } = setup(2, 1000);
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(false);

    clock.now += 1000;
    expect(limiter.isAllowed('ip')).toBe(true);

    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(true);
    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(false);
  });

  it('redémarre la fenêtre quand un échec arrive après son expiration, sans passer par isAllowed', () => {
    const { limiter, clock } = setup(2, 1000);
    limiter.recordFailure('ip');
    limiter.recordFailure('ip');

    clock.now += 1500;
    limiter.recordFailure('ip');

    expect(limiter.isAllowed('ip')).toBe(true);
  });

  it('remet le compteur à zéro après une réussite', () => {
    const { limiter } = setup(1);
    limiter.recordFailure('ip');
    expect(limiter.isAllowed('ip')).toBe(false);

    limiter.reset('ip');

    expect(limiter.isAllowed('ip')).toBe(true);
  });
});
