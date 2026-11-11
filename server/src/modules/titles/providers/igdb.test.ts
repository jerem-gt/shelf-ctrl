import { describe, expect, it } from 'vitest';

import { igdbGame as game, stubIgdbClient as stubClient } from '../../../tests/igdb.js';
import { createIgdbTitleSearch } from './igdb.js';

describe('recherche par titre IGDB', () => {
  it('liste toutes les consoles, mais ne préremplit que la console unique', async () => {
    const results = await createIgdbTitleSearch(
      stubClient([game(), game({ title: 'Mario Kart 8', consoles: ['Wii U', 'Nintendo Switch'] })]),
    ).search('mario');

    expect(results[0]).toEqual({
      barcode: null,
      source: 'igdb',
      suggestion: {
        work: {
          title: 'Super Mario Odyssey',
          series: 'Super Mario',
          volumeNumber: null,
          creators: 'Nintendo EPD',
          year: 2017,
        },
        edition: {
          format: 'game',
          publisher: 'Nintendo',
          releaseYear: 2017,
          language: null,
          console: 'Nintendo Switch',
        },
      },
      consoles: ['Nintendo Switch'],
    });
    expect(results[1]?.suggestion.edition.console).toBeNull();
    expect(results[1]?.consoles).toEqual(['Wii U', 'Nintendo Switch']);
  });
});
