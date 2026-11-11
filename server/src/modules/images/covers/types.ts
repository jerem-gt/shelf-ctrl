import type { MediaFormat } from '@shelfctrl/types';

/** Ce que l'on sait d'une édition pour lui trouver une pochette. */
export interface CoverQuery {
  format: MediaFormat;
  barcode: string | null;
  title: string;
  year: number | null;
}

export interface CoverProvider {
  source: string;
  /** Faux quand la source ne peut rien pour cette édition (pas d'ISBN, pas de clé…). */
  supports(query: CoverQuery): boolean;
  /** `null` : pas de pochette. Une erreur (réseau, quota…) est levée. */
  find(query: CoverQuery): Promise<Buffer | null>;
}
