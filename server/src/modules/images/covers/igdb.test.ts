import { describe, expect, it } from 'vitest';

import type { IgdbGame } from '../../../sources/igdb.js';
import { fakeIgdb, igdbGame as game, stubIgdbClient as stubClient } from '../../../tests/igdb.js';
import { createIgdbCoverProvider } from './igdb.js';

describe('jaquettes IGDB', () => {
  const query = {
    format: 'game' as const,
    barcode: null,
    title: 'Super Mario Odyssey',
    year: 2017,
  };

  it('ne sert que les jeux vidéo', () => {
    const provider = createIgdbCoverProvider(stubClient([]));
    expect(provider.supports(query)).toBe(true);
    expect(provider.supports({ ...query, format: 'bluray' })).toBe(false);
  });

  it('télécharge la jaquette du jeu correspondant', async () => {
    const { fetchFn, calls } = fakeIgdb();
    const image = await createIgdbCoverProvider(stubClient([game()]), fetchFn).find(query);

    expect(image?.toString()).toBe('image');
    expect(calls[0]?.url).toContain('t_cover_big_2x/co1mxf.jpg');
  });

  it('ignore un jeu d’une autre année ou sans jaquette', async () => {
    const provider = (games: IgdbGame[]) =>
      createIgdbCoverProvider(stubClient(games), fakeIgdb().fetchFn);
    expect(await provider([game({ year: 2020 })]).find(query)).toBeNull();
    expect(await provider([game({ coverUrl: null })]).find(query)).toBeNull();
  });
});
