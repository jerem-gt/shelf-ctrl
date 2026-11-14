import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { stubScreen } from '@/tests/stubScreen';

import { MD_QUERY, useMediaQuery } from './useMediaQuery';

describe('useMediaQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('répond non sans matchMedia (affichage mobile d’abord)', () => {
    expect(renderHook(() => useMediaQuery(MD_QUERY)).result.current).toBe(false);
  });

  it('suit les changements de la media query', () => {
    const resize = stubScreen(false);
    const { result } = renderHook(() => useMediaQuery(MD_QUERY));
    expect(result.current).toBe(false);

    act(() => resize(true));

    expect(result.current).toBe(true);
  });
});
