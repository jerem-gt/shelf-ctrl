import { describe, expect, it } from 'vitest';

import { formatDate } from './format';

describe('formatDate', () => {
  it('lit une date SQLite en UTC et l’affiche au format français', () => {
    expect(formatDate('2026-10-14 10:00:00')).toBe('14/10/2026');
  });
});
