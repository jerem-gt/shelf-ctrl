import type { BarcodeKind } from '@shelfctrl/types';

export interface ParsedBarcode {
  /** Forme canonique : ISBN-13 pour un livre, EAN-13 (ou EAN-8) pour le reste. */
  code: string;
  kind: BarcodeKind;
}

/** Contrôle EAN/UPC : les poids 3 et 1 alternent à partir du chiffre qui précède la clé. */
function hasValidEanChecksum(digits: string): boolean {
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const fromRight = body.length - 1 - i;
    sum += Number(body[i]) * (fromRight % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

function isValidIsbn10(value: string): boolean {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const char = value[i];
    const digit = char === 'X' ? 10 : Number(char);
    sum += (10 - i) * digit;
  }
  return sum % 11 === 0;
}

function isbn10ToIsbn13(isbn10: string): string {
  const body = `978${isbn10.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return `${body}${(10 - (sum % 10)) % 10}`;
}

/** ISBN-10 équivalent d'un ISBN-13 en 978 (les 979 n'en ont pas) : certains catalogues n'indexent que lui. */
export function isbn13ToIsbn10(isbn13: string): string | null {
  if (!/^978\d{10}$/.test(isbn13)) {
    return null;
  }
  const body = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += (10 - i) * Number(body[i]);
  }
  const check = (11 - (sum % 11)) % 11;
  return `${body}${check === 10 ? 'X' : check}`;
}

/** Valide un code saisi ou scanné et le ramène à sa forme canonique ; `null` s'il est invalide. */
export function parseBarcode(raw: string): ParsedBarcode | null {
  const cleaned = raw.replaceAll(/[\s-]/g, '').toUpperCase();

  if (/^\d{9}[\dX]$/.test(cleaned)) {
    return isValidIsbn10(cleaned) ? { code: isbn10ToIsbn13(cleaned), kind: 'isbn' } : null;
  }
  if (/^\d{13}$/.test(cleaned) && hasValidEanChecksum(cleaned)) {
    return { code: cleaned, kind: /^97[89]/.test(cleaned) ? 'isbn' : 'ean' };
  }
  if (/^\d{12}$/.test(cleaned) && hasValidEanChecksum(cleaned)) {
    return { code: `0${cleaned}`, kind: 'ean' };
  }
  if (/^\d{8}$/.test(cleaned) && hasValidEanChecksum(cleaned)) {
    return { code: cleaned, kind: 'ean' };
  }
  return null;
}

/**
 * Forme à stocker : canonique si le code est valide, sinon tel que saisi.
 * Évite qu'un même livre existe deux fois (ISBN-10 saisi, ISBN-13 scanné).
 */
export function normalizeBarcode(raw: string): string {
  return parseBarcode(raw)?.code ?? raw.trim().toUpperCase();
}
