import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_ROUTES,
  COLLECTION_ROUTES,
  isSettingsSection,
  matchesAnyRoute,
  settingsPath,
} from './navigation';

describe('rubriques des réglages', () => {
  it('reconnaît les seules rubriques existantes', () => {
    expect(isSettingsSection('platforms')).toBe(true);
    expect(isSettingsSection('inconnue')).toBe(false);
    expect(isSettingsSection(null)).toBe(false);
  });

  it('donne l’adresse d’une rubrique', () => {
    expect(settingsPath('twoFactor')).toBe('/settings?section=twoFactor');
  });
});

describe('matchesAnyRoute', () => {
  it('reconnaît les pages de la collection', () => {
    expect(matchesAnyRoute('/add', COLLECTION_ROUTES)).toBe(true);
    expect(matchesAnyRoute('/import', COLLECTION_ROUTES)).toBe(true);
    expect(matchesAnyRoute('/copies/12', COLLECTION_ROUTES)).toBe(true);
    expect(matchesAnyRoute('/loans', COLLECTION_ROUTES)).toBe(false);
  });

  it('ne se contente pas d’un préfixe', () => {
    expect(matchesAnyRoute('/address', COLLECTION_ROUTES)).toBe(false);
    expect(matchesAnyRoute('/administration', ACCOUNT_ROUTES)).toBe(false);
    expect(matchesAnyRoute('/admin', ACCOUNT_ROUTES)).toBe(true);
  });
});
