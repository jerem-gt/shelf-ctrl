import { describe, expect, it } from 'vitest';

import { titleResult } from './result.js';

describe('titleResult', () => {
  it('met null ou [] à ce que la source ne donne pas', () => {
    expect(titleResult({ source: 'tmdb', work: { title: 'Alien' } })).toEqual({
      barcode: null,
      source: 'tmdb',
      suggestion: {
        work: { title: 'Alien', series: null, volumeNumber: null, creators: null, year: null },
        edition: {
          format: null,
          publisher: null,
          releaseYear: null,
          language: null,
          console: null,
        },
      },
      consoles: [],
    });
  });

  it('ne laisse pas un champ undefined écraser la valeur par défaut', () => {
    const result = titleResult({
      source: 'openlibrary',
      barcode: undefined,
      work: { title: 'Tintin', year: undefined },
      edition: { format: 'book', publisher: undefined },
      consoles: undefined,
    });

    expect(result.barcode).toBeNull();
    expect(result.suggestion.work.year).toBeNull();
    expect(result.suggestion.edition).toEqual({
      format: 'book',
      publisher: null,
      releaseYear: null,
      language: null,
      console: null,
    });
    expect(result.consoles).toEqual([]);
  });
});
