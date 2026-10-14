import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ne met à jour la valeur qu’après le délai', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(result.current).toBe('a');

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(result.current).toBe('ab');
  });

  it('repart de zéro à chaque changement', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    await act(() => vi.advanceTimersByTimeAsync(200));
    rerender({ value: 'abc' });
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(result.current).toBe('a');

    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current).toBe('abc');
  });
});
