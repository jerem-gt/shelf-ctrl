import { useSyncExternalStore } from 'react';

import { safeStorage } from '@/lib/safeStorage';

export type ThemeMode = 'light' | 'dark' | 'system';

/** Clé lue aussi par `public/theme-init.js` (anti-flash). */
const KEY = 'shelfctrl.theme';

function readStored(): ThemeMode {
  const v = safeStorage.getItem(KEY);
  if (v === 'light' || v === 'dark') return v;
  return 'system';
}

let current: ThemeMode = readStored();
const listeners = new Set<() => void>();

const media =
  typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia('(prefers-color-scheme: dark)')
    : null;

/** État sombre effectif pour un mode donné. */
function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'system') return media?.matches ?? false;
  return mode === 'dark';
}

/** Pose (ou retire) la classe `.dark` sur <html> selon le mode courant. */
function applyTheme() {
  document.documentElement.classList.toggle('dark', resolveDark(current));
  // Retire le fond posé par theme-init.js : les variables CSS prennent le relais.
  document.documentElement.style.removeProperty('background-color');
}

applyTheme();

// En mode système, suivre en direct la préférence de l'appareil.
media?.addEventListener('change', () => {
  if (current === 'system') {
    applyTheme();
    for (const cb of listeners) cb();
  }
});

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ThemeMode {
  return current;
}

/** Choisit le thème ; `system` efface le choix mémorisé. */
export function setTheme(mode: ThemeMode) {
  current = mode;
  if (mode === 'system') {
    safeStorage.removeItem(KEY);
  } else {
    safeStorage.setItem(KEY, mode);
  }
  applyTheme();
  for (const cb of listeners) cb();
}

/** Mode choisi (`light` | `dark` | `system`). */
export function useTheme(): ThemeMode {
  return useSyncExternalStore(subscribe, getSnapshot);
}
