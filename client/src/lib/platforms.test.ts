import { describe, expect, it } from 'vitest';

import { titleLimit } from './platforms';

describe('titleLimit', () => {
  it('donne la limite de chaque plateforme, casse et espaces ignorés', () => {
    expect(titleLimit('Vinted')).toBe(60);
    expect(titleLimit(' LEBONCOIN ')).toBe(70);
    expect(titleLimit('eBay')).toBe(80);
  });

  it('applique la limite par défaut à une plateforme inconnue ou absente', () => {
    expect(titleLimit('Momox')).toBe(80);
    expect(titleLimit('')).toBe(80);
    expect(titleLimit(null)).toBe(80);
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'ne résout pas « %s » comme une plateforme',
    (name) => {
      expect(titleLimit(name)).toBe(80);
    },
  );
});
