import type { FetchFn } from '../sources/http.js';
import type { IgdbClient, IgdbGame } from '../sources/igdb.js';

/** Un jeu tel que le renvoie l'API IGDB. */
export const ODYSSEY = {
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

export interface Call {
  url: string;
  init: RequestInit | undefined;
}

/**
 * Twitch, IGDB et ses images simulés : `games` répond aux recherches, `statuses` force leurs
 * codes HTTP.
 */
export function fakeIgdb(games: unknown = [ODYSSEY], statuses: number[] = []) {
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

/** Jeu déjà ramené par le client IGDB (Super Mario Odyssey par défaut). */
export const igdbGame = (overrides: Partial<IgdbGame> = {}): IgdbGame => ({
  title: 'Super Mario Odyssey',
  year: 2017,
  series: 'Super Mario',
  developers: 'Nintendo EPD',
  publisher: 'Nintendo',
  consoles: ['Nintendo Switch'],
  coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1mxf.jpg',
  ...overrides,
});

/** Client IGDB qui renvoie ces jeux, ou échoue avec cette erreur. */
export const stubIgdbClient = (games: IgdbGame[] | Error): IgdbClient => ({
  searchGames: () => (games instanceof Error ? Promise.reject(games) : Promise.resolve(games)),
});
