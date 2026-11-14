import { vi } from 'vitest';

/**
 * Simule la largeur d'écran pour `useMediaQuery` : `matchMedia` répond `wide` à toute media query.
 * Renvoie de quoi la changer en cours de test. À défaire par `vi.unstubAllGlobals()`.
 */
export function stubScreen(wide: boolean) {
  let matches = wide;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    })),
  );
  return (next: boolean) => {
    matches = next;
    listeners.forEach((listener) => listener());
  };
}
