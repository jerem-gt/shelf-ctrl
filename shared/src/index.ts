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

/** Un prêt d'exemplaire ; `returnedAt` vaut `null` tant qu'il est en cours. Dates au format AAAA-MM-JJ. */
export interface LoanItem {
  id: number;
  copyId: number;
  borrowerId: number;
  borrowerName: string;
  loanedAt: string;
  returnedAt: string | null;
}

/** Prêt en cours avec de quoi identifier l'exemplaire dans une liste. */
export interface OpenLoanItem extends LoanItem {
  work: Pick<WorkSummary, 'title' | 'series' | 'volumeNumber'>;
  format: MediaFormat;
}

export interface BorrowerItem {
  id: number;
  name: string;
  openLoans: number;
}

/**
 * Mise en vente ou vente d'un exemplaire (au plus une par exemplaire). Sans `soldAt` : en vente ;
 * avec : vendu. `listedAt` est `null` pour une vente directe. Prix en centimes, dates AAAA-MM-JJ.
 */
export interface SaleItem {
  id: number;
  copyId: number;
  platform: string | null;
  priceCents: number | null;
  listedAt: string | null;
  soldAt: string | null;
}

/** Vente avec de quoi identifier l'exemplaire dans une liste. */
export interface SaleListItem extends SaleItem {
  work: Pick<WorkSummary, 'title' | 'series' | 'volumeNumber'>;
  format: MediaFormat;
}

/** Brouillon d'annonce généré par un LLM : à relire avant de le coller sur la plateforme. */
export interface ListingDraft {
  title: string;
  description: string;
  /** Estimation en centimes, indicative : le modèle ne connaît pas les prix du marché du jour. */
  suggestedPriceCents: number | null;
}

/** `isbn` : livre (préfixe 978/979) ; `ean` : tout autre code (vidéo). */
export type BarcodeKind = 'isbn' | 'ean';

export type BarcodeSource = 'local' | 'bnf' | 'openlibrary' | 'googlebooks' | 'upcitemdb';

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

/** Utilisateur connecté (réponse de `/api/auth/me` et de la connexion). */
export interface SessionResponse {
  username: string;
}

export interface HealthResponse {
  status: 'ok';
}
