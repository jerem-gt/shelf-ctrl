import type { BarcodeSuggestion } from '@shelfctrl/types';
import { describe, expect, it } from 'vitest';

import { igdbGame as game, stubIgdbClient as stubClient } from '../../../tests/igdb.js';
import { createIgdbEnricher } from './igdb.js';

describe('enrichissement IGDB', () => {
  const scanned: BarcodeSuggestion = {
    work: {
      title: 'super mario odyssey',
      series: null,
      volumeNumber: null,
      creators: null,
      year: null,
    },
    edition: {
      format: 'game',
      publisher: 'Nintendo FR',
      releaseYear: null,
      language: null,
      console: null,
    },
  };

  it('complète la fiche sans écraser l’éditeur connu', async () => {
    const enriched = await createIgdbEnricher(stubClient([game()]))(scanned);

    expect(enriched).toEqual({
      work: {
        title: 'Super Mario Odyssey',
        series: 'Super Mario',
        volumeNumber: null,
        creators: 'Nintendo EPD',
        year: 2017,
      },
      edition: {
        format: 'game',
        publisher: 'Nintendo FR',
        releaseYear: null,
        language: null,
        console: 'Nintendo Switch',
      },
    });
  });

  it('ne devine pas la console d’un jeu multi-plateformes', async () => {
    const multi = game({ consoles: ['PlayStation 4', 'Xbox One'] });
    const enriched = await createIgdbEnricher(stubClient([multi]))(scanned);

    expect(enriched.edition.console).toBeNull();
  });

  it('garde la fiche d’origine si le jeu est sans rapport ou si l’appel échoue', async () => {
    const unrelated = game({ title: 'Tetris' });
    expect(await createIgdbEnricher(stubClient([unrelated]))(scanned)).toBe(scanned);
    expect(await createIgdbEnricher(stubClient(new Error('HTTP 500')))(scanned)).toBe(scanned);
  });
});
