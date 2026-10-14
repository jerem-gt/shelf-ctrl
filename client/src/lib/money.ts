const PRICE_FORMAT = /^\d+([.,]\d{1,2})?$/;

/** Motif HTML d'un prix saisi en euros : « 12 », « 12,5 » ou « 12.50 ». */
export const PRICE_PATTERN = String.raw`\d+([.,]\d{1,2})?`;

/** « 12,50 » → 1250 ; une saisie vide ou invalide → `null` (pas de prix). */
export function parsePrice(input: string): number | null {
  const value = input.trim();
  if (!PRICE_FORMAT.test(value)) {
    return null;
  }
  return Math.round(Number(value.replace(',', '.')) * 100);
}

/** 1250 → « 12,50 » pour préremplir un champ ; `null` → champ vide. */
export function priceToInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

const EURO = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function formatPrice(cents: number): string {
  return EURO.format(cents / 100);
}
