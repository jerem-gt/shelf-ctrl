import { describe, expect, it } from 'vitest';

import { decodeCsv, detectDelimiter, parseCsv } from './csv.js';

describe('detectDelimiter', () => {
  it.each([
    ['a;b;c', ';'],
    ['a,b,c', ','],
    ['a\tb\tc', '\t'],
    ['a,b;c;d', ';'],
    ['sans séparateur', ';'],
  ])('%j → %j', (text, expected) => {
    expect(detectDelimiter(text)).toBe(expected);
  });

  it('ignore les séparateurs entre guillemets et ne lit que la première ligne', () => {
    expect(detectDelimiter('"a;b;c",d,e;f\n1;2;3;4;5')).toBe(',');
  });
});

describe('parseCsv', () => {
  it('lit des lignes séparées par des points-virgules', () => {
    expect(parseCsv('Titre;Tome\nTintin;20\nAlien;')).toEqual([
      ['Titre', 'Tome'],
      ['Tintin', '20'],
      ['Alien', ''],
    ]);
  });

  it('gère les guillemets, les guillemets doublés et les retours à la ligne dans un champ', () => {
    expect(parseCsv('a;b\n"un; deux";"il dit ""oui"""\n"ligne 1\nligne 2";x')).toEqual([
      ['a', 'b'],
      ['un; deux', 'il dit "oui"'],
      ['ligne 1\nligne 2', 'x'],
    ]);
  });

  it('accepte les fins de ligne Windows et ignore les lignes vides', () => {
    expect(parseCsv('a,b\r\n1,2\r\n\r\n ,\r\n3,4\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('garde un guillemet au milieu d’un champ tel quel', () => {
    expect(parseCsv('a;b\n5" de large;x')).toEqual([
      ['a', 'b'],
      ['5" de large', 'x'],
    ]);
  });

  it('renvoie un tableau vide pour un texte vide', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\n\n')).toEqual([]);
  });
});

describe('decodeCsv', () => {
  it('lit l’UTF-8 et retire le BOM', () => {
    const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Hergé', 'utf-8')]);

    expect(decodeCsv(bytes)).toBe('Hergé');
  });

  it('se replie sur Windows-1252 quand ce n’est pas de l’UTF-8', () => {
    expect(decodeCsv(Buffer.from([0x48, 0x65, 0x72, 0x67, 0xe9]))).toBe('Hergé');
  });
});
