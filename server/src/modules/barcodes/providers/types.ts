import type { BarcodeKind, BarcodeSource, BarcodeSuggestion } from '@shelfctrl/types';

export type FetchFn = typeof fetch;

export interface BarcodeProvider {
  source: Exclude<BarcodeSource, 'local'>;
  /** Types de codes que cette source sait résoudre. */
  kinds: readonly BarcodeKind[];
  /** `null` : code inconnu de la source. Une erreur (réseau, quota…) est levée. */
  lookup(code: string): Promise<BarcodeSuggestion | null>;
}

const REQUEST_TIMEOUT_MS = 5000;

export async function fetchJson(fetchFn: FetchFn, url: string): Promise<unknown> {
  const res = await fetchFn(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

/** Année (4 chiffres) extraite d'une date libre (« 1960 », « October 1, 1988 »…). */
export function extractYear(value: string | undefined): number | null {
  const match = value ? /\b(\d{4})\b/.exec(value) : null;
  return match ? Number(match[1]) : null;
}

/** Numéro de tome lu dans un titre (« Vol.11 », « Tome 3 », « T. 2 »). */
export function extractVolume(title: string): number | null {
  const match = /(?:\bvol(?:ume)?\.?|\btome|\bt\.)\s*(\d{1,3})\b/i.exec(title);
  return match ? Number(match[1]) : null;
}
