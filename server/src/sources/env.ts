/**
 * Clés des sources externes facultatives : vide ou absente, la source est désactivée.
 * Lues dans `process.env` par défaut, injectées par les tests.
 */
export interface SourcesEnv {
  GOOGLE_BOOKS_API_KEY?: string;
  TMDB_API_KEY?: string;
  /** Application Twitch, pour IGDB (les deux sont requis). */
  IGDB_CLIENT_ID?: string;
  IGDB_CLIENT_SECRET?: string;
}
