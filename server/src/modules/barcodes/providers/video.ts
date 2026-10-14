import type { MediaFormat } from '@shelfctrl/types';

/** Format lu dans l'intitulé d'un produit (« Blade Runner 2049 [4K Ultra HD] »). */
export function detectVideoFormat(title: string): MediaFormat | null {
  if (/\b(?:4k|uhd|ultra\s*hd)\b/i.test(title)) {
    return 'uhd4k';
  }
  if (/\bblu-?ray\b/i.test(title)) {
    return 'bluray';
  }
  if (/\bdvd\b/i.test(title)) {
    return 'dvd';
  }
  return null;
}

const FORMAT_WORDS = String.raw`blu-?ray(?:\s*disc)?|dvd|4k(?:\s*ultra\s*hd)?|ultra\s*hd|uhd|steelbook`;
const BRACKETED_FORMAT = new RegExp(
  String.raw`\s*[\[(][^\])]*\b(?:${FORMAT_WORDS})\b[^\])]*[\])]`,
  'gi',
);
const BARE_FORMAT = new RegExp(String.raw`\s*[-–:,/+]?\s*\b(?:${FORMAT_WORDS})\b`, 'gi');

const SEPARATORS = new Set([' ', '-', '–', ':', ',', '/', '+']);

/** Retire les séparateurs en début et en fin de chaîne (une regex ancrée serait super-linéaire). */
function trimSeparators(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && SEPARATORS.has(value.charAt(start))) {
    start++;
  }
  while (end > start && SEPARATORS.has(value.charAt(end - 1))) {
    end--;
  }
  return value.slice(start, end);
}

/** Retire les mentions de support du titre d'un produit pour ne garder que l'œuvre. */
export function cleanVideoTitle(title: string): string {
  const cleaned = title
    .replaceAll(BRACKETED_FORMAT, '')
    .replaceAll(BARE_FORMAT, '')
    .replaceAll(/\s{2,}/g, ' ');
  return trimSeparators(cleaned) || title.trim();
}
