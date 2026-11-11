import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'shelfctrl.theme';

interface MockMql {
  matches: boolean;
  addEventListener: (type: string, cb: () => void) => void;
  emit: () => void;
}

let mql: MockMql;
let mod: typeof import('./useTheme');

function makeMql(): MockMql {
  const listeners = new Set<() => void>();
  return {
    matches: false,
    addEventListener: (_type, cb) => listeners.add(cb),
    emit: () => {
      for (const cb of listeners) cb();
    },
  };
}

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

describe('useTheme', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    mql = makeMql();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mql),
    );
    // Module à état : réimporté pour repartir d'un store neuf.
    vi.resetModules();
    mod = await import('./useTheme');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.documentElement.classList.remove('dark');
  });

  it('suit le système quand rien n’est mémorisé', () => {
    const { result } = renderHook(() => mod.useTheme());
    expect(result.current).toBe('system');
  });

  it('reprend le thème mémorisé au chargement', async () => {
    localStorage.setItem(KEY, 'dark');
    vi.resetModules();
    const reloaded = await import('./useTheme');
    const { result } = renderHook(() => reloaded.useTheme());
    expect(result.current).toBe('dark');
    expect(isDark()).toBe(true);
  });

  it('setTheme("dark") pose .dark et le mémorise', () => {
    const { result } = renderHook(() => mod.useTheme());
    act(() => mod.setTheme('dark'));

    expect(result.current).toBe('dark');
    expect(isDark()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('dark');
  });

  it('setTheme("light") retire .dark et le mémorise, même si le système est sombre', () => {
    mql.matches = true;
    act(() => mod.setTheme('light'));

    expect(isDark()).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('light');
  });

  it('setTheme("system") efface le choix et suit l’appareil', () => {
    localStorage.setItem(KEY, 'light');
    mql.matches = true;
    act(() => mod.setTheme('system'));

    expect(isDark()).toBe(true);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('retire le fond posé par theme-init.js', async () => {
    document.documentElement.style.backgroundColor = '#0f172a';
    vi.resetModules();
    await import('./useTheme');
    expect(document.documentElement.style.backgroundColor).toBe('');
  });

  it('en mode système, suit le changement de préférence de l’appareil', () => {
    act(() => mod.setTheme('system'));
    expect(isDark()).toBe(false);

    act(() => {
      mql.matches = true;
      mql.emit();
    });
    expect(isDark()).toBe(true);
  });

  it('ignore le changement de préférence quand un thème est choisi', () => {
    act(() => mod.setTheme('light'));
    act(() => {
      mql.matches = true;
      mql.emit();
    });
    expect(isDark()).toBe(false);
  });
});
