import type { PlatformItem } from '@shelfctrl/types';

interface KnownPlatform {
  name: string;
  /**
   * Page où publier une annonce. Ces sites se protègent des robots : les adresses n'ont pas pu
   * être vérifiées automatiquement (seules celles d'eBay et d'Amazon l'ont été).
   */
  publishUrl: string;
  /** Longueur maximale d'un titre d'annonce. */
  titleLimit: number;
}

/** Plateformes que l'application connaît : adresse de dépôt et limite de titre sont intégrées. */
export const KNOWN_PLATFORMS: readonly KnownPlatform[] = [
  { name: 'Vinted', publishUrl: 'https://www.vinted.fr/items/new', titleLimit: 60 },
  {
    name: 'Leboncoin',
    publishUrl: 'https://www.leboncoin.fr/deposer-une-annonce',
    titleLimit: 70,
  },
  { name: 'eBay', publishUrl: 'https://www.ebay.fr/sl/sell', titleLimit: 80 },
  { name: 'Momox', publishUrl: 'https://www.momox.fr/', titleLimit: 80 },
  { name: 'Rakuten', publishUrl: 'https://fr.shopping.rakuten.com/', titleLimit: 80 },
  { name: 'Amazon', publishUrl: 'https://sell.amazon.fr/', titleLimit: 80 },
];

/** Proposées tant que le compte n'a réglé aucune plateforme. */
export const DEFAULT_PLATFORMS: readonly string[] = KNOWN_PLATFORMS.map(
  (platform) => platform.name,
);

const DEFAULT_TITLE_LIMIT = 80;

const normalize = (name: string | null): string => name?.trim().toLowerCase() ?? '';

/**
 * Une `Map` : le nom est une saisie libre, qu'un objet résoudrait aussi sur « constructor » ou
 * « toString ».
 */
const KNOWN_BY_NAME = new Map(
  KNOWN_PLATFORMS.map((platform) => [normalize(platform.name), platform]),
);

/** Plateforme connue de l'application d'après son nom, casse et espaces ignorés. */
export function findKnownPlatform(name: string | null): KnownPlatform | undefined {
  return KNOWN_BY_NAME.get(normalize(name));
}

/**
 * Page de dépôt d'une plateforme : l'adresse saisie dans les réglages pour une plateforme
 * personnalisée, sinon celle d'une plateforme connue ; `null` si on n'en a pas.
 */
export function publishUrl(
  platform: string | null,
  settings: readonly PlatformItem[] = [],
): string | null {
  const configured = settings.find((item) => normalize(item.name) === normalize(platform));
  return configured?.publishUrl ?? findKnownPlatform(platform)?.publishUrl ?? null;
}

export function titleLimit(platform: string | null): number {
  return findKnownPlatform(platform)?.titleLimit ?? DEFAULT_TITLE_LIMIT;
}
