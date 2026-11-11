import type { SourcesEnv } from '../../../sources/env.js';
import type { FetchFn } from '../../../sources/http.js';
import { igdbClientFromEnv } from '../../../sources/igdb.js';
import { createBnfTitleSearch } from './bnf.js';
import { createIgdbTitleSearch } from './igdb.js';
import { createOpenLibraryTitleSearch } from './openLibrary.js';
import { createTmdbTitleSearch } from './tmdb.js';
import type { TitleSearchProvider } from './types.js';

/**
 * BnF puis Open Library pour les livres ; TMDB pour les films et IGDB pour les jeux vidéo si
 * leurs clés sont renseignées.
 */
export function createDefaultTitleSearchProviders(
  env: SourcesEnv = process.env,
  fetchFn: FetchFn = fetch,
): TitleSearchProvider[] {
  const providers = [createBnfTitleSearch(fetchFn), createOpenLibraryTitleSearch(fetchFn)];
  if (env.TMDB_API_KEY) {
    providers.push(createTmdbTitleSearch(env.TMDB_API_KEY, fetchFn));
  }
  const igdb = igdbClientFromEnv(env, fetchFn);
  if (igdb) {
    providers.push(createIgdbTitleSearch(igdb));
  }
  return providers;
}
