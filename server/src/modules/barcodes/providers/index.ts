import { createBnfProvider } from './bnf.js';
import { createGoogleBooksProvider } from './googleBooks.js';
import { createOpenLibraryProvider } from './openLibrary.js';
import { createTmdbEnricher } from './tmdb.js';
import type { BarcodeProvider, FetchFn } from './types.js';
import { createUpcItemDbProvider } from './upcItemDb.js';

export interface ProviderEnv {
  GOOGLE_BOOKS_API_KEY?: string;
  TMDB_API_KEY?: string;
}

/**
 * Chaîne de sources, essayées dans l'ordre pour le type de code concerné.
 * Google Books et TMDB sont optionnels : ils s'activent si leur clé est renseignée.
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
  if (env.TMDB_API_KEY) {
    const enrich = createTmdbEnricher(env.TMDB_API_KEY, fetchFn);
    providers.push({
      ...upcItemDb,
      async lookup(code) {
        const suggestion = await upcItemDb.lookup(code);
        return suggestion ? enrich(suggestion) : null;
      },
    });
  } else {
    providers.push(upcItemDb);
  }

  return providers;
}
