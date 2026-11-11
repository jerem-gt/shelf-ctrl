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

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Évite de remplacer le titre par celui d'une œuvre sans rapport avec le produit trouvé. */
export function isSameTitle(a: string, b: string): boolean {
  const foldedA = fold(a);
  const foldedB = fold(b);
  if (foldedA.length < 3 || foldedB.length < 3) {
    return foldedA === foldedB;
  }
  return foldedA === foldedB || foldedB.includes(foldedA) || foldedA.includes(foldedB);
}
