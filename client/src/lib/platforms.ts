/** Plateformes proposées par défaut pour une annonce ou une vente. */
export const DEFAULT_PLATFORMS = ['Vinted', 'Leboncoin', 'eBay', 'Momox', 'Rakuten', 'Amazon'];

/**
 * Longueur maximale d'un titre d'annonce, par plateforme (en minuscules). Une `Map` : la
 * plateforme est une saisie libre, qu'un objet résoudrait aussi sur « constructor » ou « toString ».
 */
const TITLE_LIMITS = new Map([
  ['vinted', 60],
  ['leboncoin', 70],
  ['ebay', 80],
]);
const DEFAULT_TITLE_LIMIT = 80;

/**
 * Page où publier une annonce, par plateforme (en minuscules). Ces sites se protègent des robots :
 * les adresses n'ont pas pu être vérifiées automatiquement (eBay et Amazon seulement).
 */
const PUBLISH_URLS = new Map([
  ['vinted', 'https://www.vinted.fr/items/new'],
  ['leboncoin', 'https://www.leboncoin.fr/deposer-une-annonce'],
  ['ebay', 'https://www.ebay.fr/sl/sell'],
  ['momox', 'https://www.momox.fr/'],
  ['rakuten', 'https://fr.shopping.rakuten.com/'],
  ['amazon', 'https://sell.amazon.fr/'],
]);

/** Page de dépôt d'annonce d'une plateforme connue ; `null` pour une plateforme libre. */
export function publishUrl(platform: string | null): string | null {
  return PUBLISH_URLS.get(platform?.trim().toLowerCase() ?? '') ?? null;
}

export function titleLimit(platform: string | null): number {
  return TITLE_LIMITS.get(platform?.trim().toLowerCase() ?? '') ?? DEFAULT_TITLE_LIMIT;
}
