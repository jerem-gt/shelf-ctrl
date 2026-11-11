import { z } from 'zod';

import { normalizeConsole } from '../lib/consoles.js';
import type { FetchFn } from './http.js';
import { isSameTitle } from './text.js';

const REQUEST_TIMEOUT_MS = 5000;
/** Le jeton est renouvelé une minute avant son expiration annoncée. */
const TOKEN_MARGIN_MS = 60_000;

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const GAMES_URL = 'https://api.igdb.com/v4/games';
const COVER_BASE = 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x';

const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number() });

const named = z.object({ name: z.string().min(1) });
const gamesSchema = z.array(
  z.object({
    name: z.string().min(1),
    first_release_date: z.number().optional(),
    cover: z.object({ image_id: z.string().min(1) }).optional(),
    platforms: z.array(named).optional(),
    collections: z.array(named).optional(),
    franchises: z.array(named).optional(),
    involved_companies: z
      .array(
        z.object({
          company: named,
          developer: z.boolean().optional(),
          publisher: z.boolean().optional(),
        }),
      )
      .optional(),
  }),
);

/** Un jeu tel que le décrit IGDB, ramené à ce qu'en garde ShelfCtrl. */
export interface IgdbGame {
  title: string;
  year: number | null;
  /** Série (collection IGDB), à défaut la franchise. */
  series: string | null;
  developers: string | null;
  publisher: string | null;
  /** Consoles du jeu, sous leur nom connu quand on le reconnaît. */
  consoles: string[];
  coverUrl: string | null;
}

export interface IgdbClient {
  /** Une erreur (réseau, identifiants, quota…) est levée ; aucun résultat renvoie `[]`. */
  searchGames(query: string, limit: number): Promise<IgdbGame[]>;
}

/** Échappe une chaîne pour la syntaxe Apicalypse (`search "…"`), sans caractères de contrôle. */
function quote(value: string): string {
  const cleaned = [...value]
    .filter((char) => char >= ' ')
    .join('')
    .replaceAll('\\', '\\\\')
    .replaceAll('"', String.raw`\"`);
  return `"${cleaned}"`;
}

const unique = (values: string[]) => [...new Set(values)];

function toGame(raw: z.infer<typeof gamesSchema>[number]): IgdbGame {
  const companies = raw.involved_companies ?? [];
  const developers = unique(
    companies.filter((company) => company.developer).map((c) => c.company.name),
  );
  const publisher = companies.find((company) => company.publisher)?.company.name ?? null;
  const releaseYear =
    raw.first_release_date === undefined
      ? null
      : new Date(raw.first_release_date * 1000).getUTCFullYear();
  return {
    title: raw.name,
    year: releaseYear,
    series: raw.collections?.[0]?.name ?? raw.franchises?.[0]?.name ?? null,
    developers: developers.length > 0 ? developers.join(', ') : null,
    publisher,
    consoles: unique(
      (raw.platforms ?? [])
        .map((platform) => normalizeConsole(platform.name))
        .filter((name): name is string => name !== null),
    ),
    coverUrl: raw.cover ? `${COVER_BASE}/${raw.cover.image_id}.jpg` : null,
  };
}

/**
 * IGDB (base de jeux de Twitch, gratuite) : identifiants d'une application Twitch, échangés
 * contre un jeton d'application gardé en mémoire et renouvelé à l'expiration ou sur un 401.
 */
export function createIgdbClient(
  clientId: string,
  clientSecret: string,
  fetchFn: FetchFn = fetch,
  now: () => number = Date.now,
): IgdbClient {
  let token: { value: string; expiresAt: number } | null = null;

  const fetchToken = async (): Promise<string> => {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    });
    const res = await fetchFn(`${TOKEN_URL}?${params}`, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`jeton HTTP ${res.status}`);
    }
    const parsed = tokenSchema.safeParse(await res.json());
    if (!parsed.success) {
      throw new Error('Réponse inattendue');
    }
    token = {
      value: parsed.data.access_token,
      expiresAt: now() + parsed.data.expires_in * 1000 - TOKEN_MARGIN_MS,
    };
    return token.value;
  };

  const currentToken = async (): Promise<string> =>
    token !== null && token.expiresAt > now() ? token.value : fetchToken();

  const post = (accessToken: string, body: string) =>
    fetchFn(GAMES_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Client-ID': clientId,
        Authorization: `Bearer ${accessToken}`,
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  return {
    async searchGames(query, limit) {
      const body = [
        `search ${quote(query)};`,
        'fields name, first_release_date, cover.image_id, platforms.name, collections.name,',
        'franchises.name, involved_companies.developer, involved_companies.publisher,',
        'involved_companies.company.name;',
        `limit ${limit};`,
      ].join(' ');
      let res = await post(await currentToken(), body);
      if (res.status === 401) {
        // Jeton révoqué avant son terme : un seul nouvel essai avec un jeton neuf.
        res = await post(await fetchToken(), body);
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const parsed = gamesSchema.safeParse(await res.json());
      if (!parsed.success) {
        throw new Error('Réponse inattendue');
      }
      return parsed.data.map(toGame);
    },
  };
}

/** La console d'un jeu sorti sur une seule : c'est forcément celle-là ; `null` sinon. */
export function onlyConsole(game: IgdbGame): string | null {
  return game.consoles.length === 1 ? game.consoles[0] : null;
}

export interface IgdbEnv {
  IGDB_CLIENT_ID?: string;
  IGDB_CLIENT_SECRET?: string;
}

/** Client IGDB si ses deux identifiants sont renseignés, sinon `null` (source désactivée). */
export function igdbClientFromEnv(env: IgdbEnv, fetchFn: FetchFn = fetch): IgdbClient | null {
  return env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET
    ? createIgdbClient(env.IGDB_CLIENT_ID, env.IGDB_CLIENT_SECRET, fetchFn)
    : null;
}

/** Premier jeu dont le titre correspond (et l'année, quand on la connaît). */
export function findMatchingGame(
  games: readonly IgdbGame[],
  title: string,
  year: number | null = null,
): IgdbGame | null {
  return (
    games.find((game) => isSameTitle(title, game.title) && (year === null || game.year === year)) ??
    null
  );
}
