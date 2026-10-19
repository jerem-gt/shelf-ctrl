import { describe, expect, it } from 'vitest';

import { mapHeaders } from './columns.js';
import { needsCompletion, NoColumnsError, parseTable } from './rows.js';

const table = (header: string[], ...rows: string[][]) => [header, ...rows];

describe('mapHeaders', () => {
  it('reconnaît les en-têtes français et anglais, accents et casse ignorés', () => {
    const { columns, ignored } = mapHeaders([
      'TITRE',
      'Série',
      'N°',
      'Éditeur',
      'Code-barres',
      'Prix',
    ]);

    expect([...columns.values()]).toEqual(['title', 'series', 'volume', 'publisher', 'barcode']);
    expect(ignored).toEqual(['Prix']);
  });

  it('garde la première colonne quand un champ apparaît deux fois', () => {
    const { columns, ignored } = mapHeaders(['Titre', 'Title']);

    expect([...columns.entries()]).toEqual([[0, 'title']]);
    expect(ignored).toEqual(['Title']);
  });
});

describe('parseTable', () => {
  it('lit une ligne complète, quel que soit l’ordre des colonnes', () => {
    const { rows } = parseTable(
      table(
        ['État', 'Tome', 'Titre', 'Format', 'Code-barres', 'Année'],
        ['Très bon état', 'T3', 'Alien', 'blu-ray', '978-2-203-00119-0', '1979'],
      ),
    );

    expect(rows[0]).toMatchObject({
      line: 2,
      issues: [],
      draft: {
        title: 'Alien',
        volumeNumber: 3,
        format: 'bluray',
        condition: 'very_good',
        barcode: '9782203001190',
        barcodeKind: 'isbn',
        releaseYear: 1979,
      },
    });
  });

  it('numérote les lignes comme un tableur (en-tête = ligne 1)', () => {
    const { rows } = parseTable(table(['Titre'], ['A'], ['B']));

    expect(rows.map((row) => row.line)).toEqual([2, 3]);
  });

  it('refuse un fichier sans colonne titre ni code-barres', () => {
    expect(() => parseTable(table(['Auteur', 'Éditeur'], ['Hergé', 'Casterman']))).toThrow(
      NoColumnsError,
    );
  });

  it('accepte un fichier réduit à une colonne de codes-barres', () => {
    const { rows } = parseTable(table(['ISBN'], ['9782203001190']));

    expect(rows[0].issues).toEqual([]);
    expect(rows[0].draft.title).toBeNull();
  });

  it.each([
    [
      { Titre: 'X', Format: 'cassette' },
      { code: 'invalid_format', field: 'format' },
    ],
    [
      { Titre: 'X', État: 'bof' },
      { code: 'invalid_condition', field: 'condition' },
    ],
    [
      { Titre: 'X', Tome: 'deux' },
      { code: 'invalid_volume', field: 'volume' },
    ],
    [
      { Titre: 'X', Tome: '0' },
      { code: 'invalid_volume', field: 'volume' },
    ],
    [
      { Titre: 'X', Année: '79' },
      { code: 'invalid_year', field: 'year' },
    ],
    [
      { Titre: 'X', 'Code-barres': '9782203001191' },
      { code: 'invalid_barcode', field: 'barcode' },
    ],
    [{ Titre: 'x'.repeat(201) }, { code: 'too_long', field: 'title' }],
    [
      { Titre: '', Série: 'S' },
      { code: 'missing_title', field: 'title' },
    ],
  ])('signale %j', (cells, issue) => {
    const header = Object.keys(cells);
    const { rows } = parseTable(table(header, Object.values(cells)));

    expect(rows[0].issues).toEqual([issue]);
  });

  it('suppose un livre sans format, sauf pour un code vidéo (EAN)', () => {
    const { rows } = parseTable(
      table(
        ['Titre', 'Code-barres'],
        ['Sans code', ''],
        ['Livre', '9782203001190'],
        ['Film', '5051889000006'],
      ),
    );

    expect(rows.map((row) => row.draft.format)).toEqual(['book', 'book', null]);
    expect(rows[2].issues).toEqual([]);
  });

  it('ne suppose pas de format quand la valeur donnée est invalide', () => {
    const { rows } = parseTable(table(['Titre', 'Format'], ['X', 'cassette']));

    expect(rows[0].draft.format).toBeNull();
  });
});

describe('needsCompletion', () => {
  const draft = (cells: Record<string, string>) =>
    parseTable(table(Object.keys(cells), Object.values(cells))).rows[0].draft;

  it('complète une ligne qui a un code-barres mais pas de titre, d’auteurs ou d’éditeur', () => {
    expect(needsCompletion(draft({ 'Code-barres': '9782203001190' }))).toBe(true);
    expect(
      needsCompletion(draft({ Titre: 'T', Éditeur: 'E', 'Code-barres': '9782203001190' })),
    ).toBe(true);
  });

  it('ne cherche rien sans code-barres, ni pour une ligne complète', () => {
    expect(needsCompletion(draft({ Titre: 'T' }))).toBe(false);
    expect(
      needsCompletion(
        draft({ Titre: 'T', Auteurs: 'A', Éditeur: 'E', 'Code-barres': '9782203001190' }),
      ),
    ).toBe(false);
  });

  it('complète un code vidéo sans support, même avec titre, auteurs et éditeur', () => {
    expect(
      needsCompletion(
        draft({ Titre: 'T', Auteurs: 'A', Éditeur: 'E', 'Code-barres': '5051889000006' }),
      ),
    ).toBe(true);
  });
});
