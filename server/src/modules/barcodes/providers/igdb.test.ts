import type { BarcodeSuggestion } from '@shelfctrl/types';
import { describe, expect, it } from 'vitest';

import { createIgdbCoverProvider } from '../../images/covers/igdb.js';
import { createIgdbTitleSearch } from '../../titles/providers/igdb.js';
import {
  createIgdbClient,
  createIgdbEnricher,
  type IgdbClient,
  igdbClientFromEnv,
  type IgdbGame,
} from './igdb.js';
import type { FetchFn } from './types.js';

const ODYSSEY = {
  name: 'Super Mario Odyssey',
  first_release_date: 1509062400, // 2017-10-27
  cover: { image_id: 'co1mxf' },
  platforms: [{ name: 'Nintendo Switch' }],
  collections: [{ name: 'Super Mario' }],
  franchises: [{ name: 'Mario' }],
  involved_companies: [
    { company: { name: 'Nintendo EPD' }, developer: true, publisher: false },
    { company: { name: 'Nintendo' }, developer: false, publisher: true },
  ],
};

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** Twitch puis IGDB simulés : `games` répond aux recherches, `statuses` force leurs codes HTTP. */
function fakeIgdb(games: unknown = [ODYSSEY], statuses: number[] = []) {
  const calls: Call[] = [];
  let tokens = 0;
  const fetchFn: FetchFn = (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    calls.push({ url, init });
    if (url.startsWith('https://id.twitch.tv')) {
      tokens++;
      return Promise.resolve(
        new Response(JSON.stringify({ access_token: `jeton-${tokens}`, expires_in: 3600 })),
      );
    }
    if (url.startsWith('https://images.igdb.com')) {
      return Promise.resolve(
        new Response(Buffer.from('image'), { headers: { 'content-type': 'image/jpeg' } }),
      );
    }
    const status = statuses.shift() ?? 200;
    return Promise.resolve(new Response(JSON.stringify(games), { status }));
  };
  const gameCalls = () => calls.filter((call) => call.url === 'https://api.igdb.com/v4/games');
  return { fetchFn, calls, gameCalls };
}

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

const game = (overrides: Partial<IgdbGame> = {}): IgdbGame => ({
  title: 'Super Mario Odyssey',
  year: 2017,
  series: 'Super Mario',
  developers: 'Nintendo EPD',
  publisher: 'Nintendo',
  consoles: ['Nintendo Switch'],
  coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1mxf.jpg',
  ...overrides,
});

const stubClient = (games: IgdbGame[] | Error): IgdbClient => ({
  searchGames: () => (games instanceof Error ? Promise.reject(games) : Promise.resolve(games)),
});

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
