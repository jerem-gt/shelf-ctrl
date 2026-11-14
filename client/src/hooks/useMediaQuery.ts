import { useCallback, useSyncExternalStore } from 'react';

/** Point de rupture `md:` de Tailwind 4 (`--breakpoint-md`, 48rem) : menu et contenu côte à côte. */
export const MD_QUERY = '(min-width: 48rem)';

/** Suit une media query CSS. Sans `matchMedia` (jsdom), répond non : l'affichage mobile d'abord. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof globalThis.matchMedia !== 'function') {
        return () => undefined;
      }
      const list = globalThis.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => typeof globalThis.matchMedia === 'function' && globalThis.matchMedia(query).matches,
  );
}
