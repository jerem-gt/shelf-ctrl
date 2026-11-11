import { describe, expect, it } from 'vitest';

import { type Call, fakeIgdb, ODYSSEY } from '../tests/igdb.js';
import type { FetchFn } from './http.js';
import { createIgdbClient, igdbClientFromEnv } from './igdb.js';

const header = (call: Call | undefined, name: string) => new Headers(call?.init?.headers).get(name);

describe('client IGDB', () => {
  it('obtient un jeton, cherche le jeu et en garde l’essentiel', async () => {
    const { fetchFn, calls, gameCalls } = fakeIgdb();
    const games = await createIgdbClient('id', 'secret', fetchFn).searchGames('mario', 5);

    expect(calls[0]?.url).toContain('client_id=id');
    expect(calls[0]?.url).toContain('grant_type=client_credentials');
    expect(header(gameCalls()[0], 'Client-ID')).toBe('id');
    expect(header(gameCalls()[0], 'Authorization')).toBe('Bearer jeton-1');
    expect(gameCalls()[0]?.init?.body).toContain('search "mario";');
    expect(gameCalls()[0]?.init?.body).toContain('limit 5;');
    expect(games).toEqual([
      {
        title: 'Super Mario Odyssey',
        year: 2017,
        series: 'Super Mario',
        developers: 'Nintendo EPD',
        publisher: 'Nintendo',
        consoles: ['Nintendo Switch'],
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1mxf.jpg',
      },
    ]);
  });

  it('échappe guillemets et barres obliques de la recherche', async () => {
    const { fetchFn, gameCalls } = fakeIgdb([]);
    await createIgdbClient('id', 'secret', fetchFn).searchGames('a "b" \\ c\n', 5);

    expect(gameCalls()[0]?.init?.body).toContain(String.raw`search "a \"b\" \\ c";`);
  });

  it('réutilise le jeton jusqu’à son expiration', async () => {
    const { fetchFn, calls } = fakeIgdb();
    let now = 0;
    const client = createIgdbClient('id', 'secret', fetchFn, () => now);

    await client.searchGames('a', 1);
    await client.searchGames('b', 1);
    expect(calls.filter((call) => call.url.includes('twitch'))).toHaveLength(1);

    now = 3600 * 1000;
    await client.searchGames('c', 1);
    expect(calls.filter((call) => call.url.includes('twitch'))).toHaveLength(2);
  });

  it('redemande un jeton une fois sur un 401', async () => {
    const { fetchFn, gameCalls } = fakeIgdb([ODYSSEY], [401]);
    const games = await createIgdbClient('id', 'secret', fetchFn).searchGames('mario', 5);

    expect(games).toHaveLength(1);
    expect(header(gameCalls()[1], 'Authorization')).toBe('Bearer jeton-2');
  });

  it('lève une erreur sur un échec HTTP ou une réponse inattendue', async () => {
    await expect(
      createIgdbClient('id', 's', fakeIgdb([], [429]).fetchFn).searchGames('a', 1),
    ).rejects.toThrow('HTTP 429');
    await expect(
      createIgdbClient('id', 's', fakeIgdb({ autre: 1 }).fetchFn).searchGames('a', 1),
    ).rejects.toThrow('Réponse inattendue');
    const noToken: FetchFn = () => Promise.resolve(new Response('{}', { status: 400 }));
    await expect(createIgdbClient('id', 's', noToken).searchGames('a', 1)).rejects.toThrow(
      'jeton HTTP 400',
    );
  });

  it('tolère un jeu réduit à son nom', async () => {
    const [game] = await createIgdbClient(
      'id',
      's',
      fakeIgdb([{ name: 'Tetris' }]).fetchFn,
    ).searchGames('tetris', 1);

    expect(game).toEqual({
      title: 'Tetris',
      year: null,
      series: null,
      developers: null,
      publisher: null,
      consoles: [],
      coverUrl: null,
    });
  });

  it('ne s’active qu’avec ses deux identifiants', () => {
    expect(igdbClientFromEnv({})).toBeNull();
    expect(igdbClientFromEnv({ IGDB_CLIENT_ID: 'id' })).toBeNull();
    expect(igdbClientFromEnv({ IGDB_CLIENT_ID: 'id', IGDB_CLIENT_SECRET: 's' })).not.toBeNull();
  });
});
