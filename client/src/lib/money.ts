import { currentLang, currentLocale } from './format';

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

/** 1250 → « 12,50 » (« 12.50 » en anglais) pour préremplir un champ ; `null` → champ vide. */
export function priceToInput(cents: number | null): string {
  if (cents === null) {
    return '';
  }
  const value = (cents / 100).toFixed(2);
  return currentLang() === 'en' ? value : value.replace('.', ',');
}

const EURO = new Map<string, Intl.NumberFormat>();

/** Montant en euros dans la langue de l'interface (formateur gardé par locale). */
export function formatPrice(cents: number): string {
  const locale = currentLocale();
  let format = EURO.get(locale);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });
    EURO.set(locale, format);
  }
  return format.format(cents / 100);
}
