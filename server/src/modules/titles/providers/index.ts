import type { FetchFn } from '../../barcodes/providers/types.js';
import { createBnfTitleSearch } from './bnf.js';
import { createOpenLibraryTitleSearch } from './openLibrary.js';
import { createTmdbTitleSearch } from './tmdb.js';
import type { TitleSearchProvider } from './types.js';

export interface TitleSearchEnv {
  TMDB_API_KEY?: string;
}

/** BnF puis Open Library pour les livres ; TMDB pour les films si sa clé est renseignée. */
export function createDefaultTitleSearchProviders(
  env: TitleSearchEnv = process.env,
  fetchFn: FetchFn = fetch,
): TitleSearchProvider[] {
  const providers = [createBnfTitleSearch(fetchFn), createOpenLibraryTitleSearch(fetchFn)];
  if (env.TMDB_API_KEY) {
    providers.push(createTmdbTitleSearch(env.TMDB_API_KEY, fetchFn));
  }
  return providers;
}
