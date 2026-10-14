/** Support physique d'une édition. */
export const MEDIA_FORMATS = ['book', 'dvd', 'bluray', 'uhd4k'] as const;
export type MediaFormat = (typeof MEDIA_FORMATS)[number];

/** État d'un exemplaire, du meilleur au pire (aligné sur les échelles Vinted / eBay). */
export const COPY_CONDITIONS = ['new', 'very_good', 'good', 'acceptable', 'poor'] as const;
export type CopyCondition = (typeof COPY_CONDITIONS)[number];

/** Statut dérivé des mouvements (prêts, ventes) : jamais stocké. */
export const COPY_STATUSES = ['owned', 'loaned', 'listed', 'sold'] as const;
export type CopyStatus = (typeof COPY_STATUSES)[number];

export interface WorkSummary {
  id: number;
  title: string;
  series: string | null;
  volumeNumber: number | null;
  creators: string | null;
  year: number | null;
}

export interface EditionSummary {
  id: number;
  format: MediaFormat;
  barcode: string | null;
  publisher: string | null;
  releaseYear: number | null;
  language: string | null;
  coverPath: string | null;
}

/** Un exemplaire physique avec son édition et son œuvre. */
export interface CopyItem {
  id: number;
  status: CopyStatus;
  condition: CopyCondition;
  conditionNote: string | null;
  location: string | null;
  createdAt: string;
  edition: EditionSummary;
  work: WorkSummary;
}

export interface CopyListResponse {
  items: CopyItem[];
  total: number;
}

/** `isbn` : livre (préfixe 978/979) ; `ean` : tout autre code (vidéo). */
export type BarcodeKind = 'isbn' | 'ean';

export type BarcodeSource = 'local' | 'openlibrary' | 'googlebooks' | 'upcitemdb';

/** Fiche proposée pour un code-barres : à relire par l'utilisateur avant enregistrement. */
export interface BarcodeSuggestion {
  work: Omit<WorkSummary, 'id'>;
  edition: {
    format: MediaFormat | null;
    publisher: string | null;
    releaseYear: number | null;
    language: string | null;
  };
}

export interface BarcodeLookupResponse {
  /** Code normalisé (ISBN-13, EAN-13…). */
  barcode: string;
  kind: BarcodeKind;
  source: BarcodeSource;
  /** Une édition portant ce code existe déjà dans la collection. */
  known: boolean;
  suggestion: BarcodeSuggestion;
}

export interface HealthResponse {
  status: 'ok';
}
