import { describe, expect, it } from 'vitest';

import { lastUsedParts } from './lastUsed';

const NOW = new Date(2026, 9, 29, 16, 0);

describe('lastUsedParts', () => {
  it('détecte aujourd’hui avec l’heure locale', () => {
    expect(lastUsedParts(new Date(2026, 9, 29, 14, 32).getTime(), NOW)).toEqual({
      kind: 'today',
      time: '14:32',
      date: '29/10/2026',
    });
  });

  it('détecte hier, y compris à la frontière de minuit', () => {
    expect(lastUsedParts(new Date(2026, 9, 28, 23, 59).getTime(), NOW).kind).toBe('yesterday');
    expect(lastUsedParts(new Date(2026, 9, 28, 9, 5).getTime(), NOW).time).toBe('09:05');
  });

  it('renvoie la date complète au-delà', () => {
    expect(lastUsedParts(new Date(2026, 9, 12, 18, 40).getTime(), NOW)).toEqual({
      kind: 'date',
      time: '18:40',
      date: '12/10/2026',
    });
  });

  it('gère le passage de mois pour hier', () => {
    const now = new Date(2026, 10, 1, 10, 0);
    expect(lastUsedParts(new Date(2026, 9, 31, 20, 0).getTime(), now).kind).toBe('yesterday');
  });
});
