/** Support physique d'une édition. */
export const MEDIA_FORMATS = ['book', 'dvd', 'bluray', 'uhd4k'] as const;
export type MediaFormat = (typeof MEDIA_FORMATS)[number];

/** État d'un exemplaire, du meilleur au pire (aligné sur les échelles Vinted / eBay). */
export const COPY_CONDITIONS = ['new', 'very_good', 'good', 'acceptable', 'poor'] as const;
export type CopyCondition = (typeof COPY_CONDITIONS)[number];

/** Statut dérivé des mouvements (prêts, ventes) : jamais stocké. */
export const COPY_STATUSES = ['owned', 'loaned', 'listed', 'sold'] as const;
export type CopyStatus = (typeof COPY_STATUSES)[number];

export interface HealthResponse {
  status: 'ok';
}
