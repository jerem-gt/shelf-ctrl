import { describe, expect, it } from 'vitest';

import { normalizeBarcode, parseBarcode } from './barcode.js';

describe('parseBarcode', () => {
  it.each([
    ['ISBN-13', '9782203001190', '9782203001190', 'isbn'],
    ['ISBN-13 avec tirets', '978-2-203-00119-0', '9782203001190', 'isbn'],
    ['ISBN-10 converti en ISBN-13', '2203001194', '9782203001190', 'isbn'],
    ['ISBN-10 avec clé X', '080442957x', '9780804429573', 'isbn'],
    ['EAN-13 vidéo', '5051889000006', '5051889000006', 'ean'],
    ['UPC-A complété par un zéro', '883929244324', '0883929244324', 'ean'],
    ['EAN-8', '96385074', '96385074', 'ean'],
    ['code entouré d’espaces', '  3333297329439 ', '3333297329439', 'ean'],
  ])('accepte %s', (_label, raw, code, kind) => {
    expect(parseBarcode(raw)).toEqual({ code, kind });
  });

  it.each([
    ['mauvaise clé EAN-13', '5051889000001'],
    ['mauvaise clé ISBN-10', '2203001195'],
    ['mauvaise clé EAN-8', '96385075'],
    ['mauvaise clé UPC-A', '883929244325'],
    ['lettres', 'abcdefghijklm'],
    ['trop court', '1234'],
    ['vide', ''],
    ['14 chiffres', '12345678901231'],
  ])('refuse %s', (_label, raw) => {
    expect(parseBarcode(raw)).toBeNull();
  });
});

describe('normalizeBarcode', () => {
  it('ramène un ISBN-10 valide en ISBN-13', () => {
    expect(normalizeBarcode('2203001194')).toBe('9782203001190');
  });

  it('conserve en majuscules un code invalide, tel que saisi', () => {
    expect(normalizeBarcode(' ab-12 ')).toBe('AB-12');
  });
});
