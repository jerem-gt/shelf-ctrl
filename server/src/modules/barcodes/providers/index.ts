import { isGameFormat } from '@shelfctrl/types';

import { createBnfProvider } from './bnf.js';
import { createGoogleBooksProvider } from './googleBooks.js';
import { createIgdbEnricher, igdbClientFromEnv, type IgdbEnv } from './igdb.js';
import { createOpenLibraryProvider } from './openLibrary.js';
import { createTmdbEnricher } from './tmdb.js';
import type { BarcodeProvider, Enricher, FetchFn } from './types.js';
import { createUpcItemDbProvider } from './upcItemDb.js';

export interface ProviderEnv extends IgdbEnv {
  GOOGLE_BOOKS_API_KEY?: string;
  TMDB_API_KEY?: string;
}

/**
 * Chaîne de sources, essayées dans l'ordre pour le type de code concerné.
 * Google Books, TMDB et IGDB sont optionnels : ils s'activent si leur clé est renseignée.
 * TMDB fiabilise les fiches de films d'UPCitemdb, IGDB celles de jeux vidéo.
 */
export function createDefaultProviders(
  env: ProviderEnv = process.env,
  fetchFn: FetchFn = fetch,
): BarcodeProvider[] {
  // La BnF d'abord : elle donne série et tome des BD francophones, que les autres sources manquent.
  const providers: BarcodeProvider[] = [createBnfProvider(fetchFn)];

  if (env.GOOGLE_BOOKS_API_KEY) {
    providers.push(createGoogleBooksProvider(env.GOOGLE_BOOKS_API_KEY, fetchFn));
  }
  providers.push(createOpenLibraryProvider(fetchFn));

  const upcItemDb = createUpcItemDbProvider(fetchFn);
  const enrichMovie: Enricher | null = env.TMDB_API_KEY
    ? createTmdbEnricher(env.TMDB_API_KEY, fetchFn)
    : null;
  const igdb = igdbClientFromEnv(env, fetchFn);
  const enrichGame: Enricher | null = igdb ? createIgdbEnricher(igdb) : null;
  if (enrichMovie || enrichGame) {
    providers.push({
      ...upcItemDb,
      async lookup(code) {
        const suggestion = await upcItemDb.lookup(code);
        if (!suggestion) {
          return null;
        }
        const enrich = isGameFormat(suggestion.edition.format) ? enrichGame : enrichMovie;
        return enrich ? enrich(suggestion) : suggestion;
      },
    });
  } else {
    providers.push(upcItemDb);
  }

  return providers;
}
