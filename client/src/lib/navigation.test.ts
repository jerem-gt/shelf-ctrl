import { describe, expect, it } from 'vitest';

import { ACCOUNT_ROUTES, COLLECTION_ROUTES, matchesAnyRoute } from './navigation';

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
