import type { PlatformItem } from '@shelfctrl/types';
import { describe, expect, it } from 'vitest';

import { findKnownPlatform, publishUrl, titleLimit } from './platforms';

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

describe('publishUrl avec les réglages du compte', () => {
  const custom: PlatformItem = {
    id: 1,
    name: 'BDfugue',
    publishUrl: 'https://www.bdfugue.com/vendre',
    isDefault: false,
  };

  it('utilise l’adresse d’une plateforme personnalisée, casse ignorée', () => {
    expect(publishUrl('bdfugue', [custom])).toBe('https://www.bdfugue.com/vendre');
  });

  it('retombe sur l’adresse intégrée pour une plateforme connue sans adresse en base', () => {
    const vinted: PlatformItem = { id: 2, name: 'Vinted', publishUrl: null, isDefault: true };

    expect(publishUrl('Vinted', [vinted])).toBe('https://www.vinted.fr/items/new');
  });

  it('ne renvoie rien pour une plateforme personnalisée sans adresse', () => {
    expect(publishUrl('BDfugue', [{ ...custom, publishUrl: null }])).toBeNull();
    expect(publishUrl('BDfugue')).toBeNull();
  });
});

describe('findKnownPlatform', () => {
  it('reconnaît une plateforme connue, casse et espaces ignorés', () => {
    expect(findKnownPlatform(' VINTED ')?.name).toBe('Vinted');
    expect(findKnownPlatform('BDfugue')).toBeUndefined();
    expect(findKnownPlatform(null)).toBeUndefined();
    expect(findKnownPlatform('constructor')).toBeUndefined();
  });
});
