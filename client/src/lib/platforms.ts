/** Plateformes proposées par défaut pour une annonce ou une vente. */
export const DEFAULT_PLATFORMS = ['Vinted', 'Leboncoin', 'eBay', 'Momox', 'Rakuten', 'Amazon'];

/** Longueur maximale d'un titre d'annonce, par plateforme (en minuscules). */
const TITLE_LIMITS: Record<string, number> = { vinted: 60, leboncoin: 70, ebay: 80 };
const DEFAULT_TITLE_LIMIT = 80;

export function titleLimit(platform: string | null): number {
  return TITLE_LIMITS[platform?.trim().toLowerCase() ?? ''] ?? DEFAULT_TITLE_LIMIT;
}
