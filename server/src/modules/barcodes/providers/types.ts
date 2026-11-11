import type { BarcodeKind, BarcodeSource, BarcodeSuggestion } from '@shelfctrl/types';

export interface BarcodeProvider {
  source: Exclude<BarcodeSource, 'local'>;
  /** Types de codes que cette source sait résoudre. */
  kinds: readonly BarcodeKind[];
  /** `null` : code inconnu de la source. Une erreur (réseau, quota…) est levée. */
  lookup(code: string): Promise<BarcodeSuggestion | null>;
}

/** Complète une fiche trouvée par une autre source ; ne lève jamais (fiche inchangée en cas d'échec). */
export type Enricher = (suggestion: BarcodeSuggestion) => Promise<BarcodeSuggestion>;
