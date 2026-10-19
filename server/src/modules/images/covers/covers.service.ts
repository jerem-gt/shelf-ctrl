import type { MediaFormat } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';

import type { ImageStore } from '../imageStore.js';
import { createOpenLibraryCoverProvider } from './openLibrary.js';
import { createTmdbCoverProvider } from './tmdb.js';
import type { CoverProvider, FetchFn } from './types.js';

export interface CoverEnv {
  TMDB_API_KEY?: string;
}

/** Open Library pour les livres ; TMDB pour les films si sa clé est renseignée. */
export function createDefaultCoverProviders(
  env: CoverEnv = process.env,
  fetchFn: FetchFn = fetch,
): CoverProvider[] {
  const providers = [createOpenLibraryCoverProvider(fetchFn)];
  if (env.TMDB_API_KEY) {
    providers.push(createTmdbCoverProvider(env.TMDB_API_KEY, fetchFn));
  }
  return providers;
}

interface EditionRow {
  id: number;
  format: MediaFormat;
  barcode: string | null;
  cover_path: string | null;
  title: string;
  year: number | null;
}

export type FetchCoverOutcome = 'fetched' | 'not_found' | 'has_cover' | 'unknown_edition';

export function createCoverService(
  db: Database,
  store: ImageStore,
  providers: readonly CoverProvider[],
) {
  /** Recherches en cours par édition : une seconde demande s'y rattache au lieu de la doubler. */
  const inFlight = new Map<number, Promise<FetchCoverOutcome>>();

  const findEdition = (id: number): EditionRow | undefined =>
    db
      .prepare(
        `SELECT e.id, e.format, e.barcode, e.cover_path, w.title, w.year
         FROM editions e JOIN works w ON w.id = e.work_id
         WHERE e.id = ?`,
      )
      .get(id) as EditionRow | undefined;

  /** Enregistre l'image et retire l'ancienne ; `null` si l'édition a disparu entre-temps. */
  const setCover = async (editionId: number, image: Buffer): Promise<string | null> => {
    const name = await store.save('covers', editionId, image);
    const previous = findEdition(editionId)?.cover_path ?? null;
    const changed = db
      .prepare('UPDATE editions SET cover_path = ? WHERE id = ?')
      .run(name, editionId);
    if (changed.changes === 0) {
      await store.remove('covers', name);
      return null;
    }
    if (previous !== name) {
      await store.remove('covers', previous);
    }
    return name;
  };

  const search = async (edition: EditionRow, replace: boolean): Promise<FetchCoverOutcome> => {
    const query = {
      format: edition.format,
      barcode: edition.barcode,
      title: edition.title,
      year: edition.year,
    };
    for (const provider of providers.filter((candidate) => candidate.supports(query))) {
      try {
        const image = await provider.find(query);
        // La recherche dure plusieurs secondes : une pochette envoyée entre-temps l'emporte.
        if (!replace && findEdition(edition.id)?.cover_path) {
          return 'has_cover';
        }
        if (image && (await setCover(edition.id, image)) !== null) {
          return 'fetched';
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'erreur inconnue';
        console.warn(`[covers] ${provider.source} : ${reason}`);
      }
    }
    return 'not_found';
  };

  return {
    setCover,

    /** `false` : édition inconnue. */
    async clearCover(editionId: number): Promise<boolean> {
      const edition = findEdition(editionId);
      if (!edition) {
        return false;
      }
      db.prepare('UPDATE editions SET cover_path = NULL WHERE id = ?').run(editionId);
      await store.remove('covers', edition.cover_path);
      return true;
    },

    /**
     * Cherche la pochette en ligne, source après source. Sans `replace`, une pochette existante
     * est conservée. Une source en erreur ou qui renvoie une image illisible est ignorée.
     */
    async fetchForEdition(editionId: number, replace: boolean): Promise<FetchCoverOutcome> {
      const edition = findEdition(editionId);
      if (!edition) {
        return 'unknown_edition';
      }
      if (edition.cover_path !== null && !replace) {
        return 'has_cover';
      }
      const running = inFlight.get(editionId);
      if (running) {
        return running;
      }
      const promise = search(edition, replace).finally(() => inFlight.delete(editionId));
      inFlight.set(editionId, promise);
      return promise;
    },
  };
}

export type CoverService = ReturnType<typeof createCoverService>;
