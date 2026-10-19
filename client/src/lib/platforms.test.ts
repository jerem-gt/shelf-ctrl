import { describe, expect, it } from 'vitest';

import { publishUrl, titleLimit } from './platforms';

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

describe('publishUrl', () => {
  it('donne la page de dépôt d’une plateforme connue, casse et espaces ignorés', () => {
    expect(publishUrl('Vinted')).toBe('https://www.vinted.fr/items/new');
    expect(publishUrl(' LEBONCOIN ')).toBe('https://www.leboncoin.fr/deposer-une-annonce');
  });

  it('ne renvoie rien pour une plateforme libre ou absente', () => {
    expect(publishUrl('Mon site perso')).toBeNull();
    expect(publishUrl('')).toBeNull();
    expect(publishUrl(null)).toBeNull();
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'ne résout pas « %s » comme une plateforme',
    (name) => {
      expect(publishUrl(name)).toBeNull();
    },
  );
});
