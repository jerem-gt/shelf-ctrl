import type { Database } from 'better-sqlite3';
import express from 'express';

import type { CopiesHooks } from '../copies/copies.routes.js';
import { createCoverService } from './covers/covers.service.js';
import type { CoverProvider } from './covers/types.js';
import { createImagesRouter } from './images.routes.js';
import { createImageStore } from './imageStore.js';
import { createPhotoService } from './photos.service.js';

export interface ImagesOptions {
  /** Les images vivent dans `<dataDir>/images`. */
  dataDir: string;
  /** Sources de pochettes pour les nouvelles éditions (vide : envoi manuel uniquement). */
  coverProviders: readonly CoverProvider[];
}

/** Les noms de fichiers contiennent l'empreinte du contenu : le cache peut être immuable. */
const STATIC_OPTIONS = { maxAge: '1y', immutable: true, index: false, fallthrough: false } as const;

export function createImages(db: Database, options: ImagesOptions) {
  const store = createImageStore(options.dataDir);
  const covers = createCoverService(db, store, options.coverProviders);
  const photos = createPhotoService(db, store);

  const copiesHooks: CopiesHooks = {
    /** Pochette cherchée en ligne en arrière-plan : l'ajout n'attend pas le réseau. */
    onCreated(copy) {
      if (copy.edition.coverPath === null) {
        covers.fetchForEdition(copy.edition.id, false).catch((error: unknown) => {
          console.warn('[covers]', error instanceof Error ? error.message : error);
        });
      }
    },
    /** L'exemplaire est déjà supprimé : un fichier qui résiste ne doit pas faire échouer la requête. */
    async onRemoved(files) {
      const outcomes = await Promise.allSettled([
        store.remove('photos', files.photoPath),
        store.remove('covers', files.coverPath),
      ]);
      for (const outcome of outcomes) {
        if (outcome.status === 'rejected') {
          const reason: unknown = outcome.reason;
          console.warn('[images] fichier non supprimé :', reason);
        }
      }
    },
  };

  return {
    /** Cherche la pochette d'une édition sans la remplacer ; `true` si elle a été trouvée. */
    fetchCover: async (editionId: number): Promise<boolean> =>
      (await covers.fetchForEdition(editionId, false)) === 'fetched',
    router: createImagesRouter(covers, photos),
    copiesHooks,
    covers: express.static(store.dirOf('covers'), STATIC_OPTIONS),
    photos: express.static(store.dirOf('photos'), STATIC_OPTIONS),
  };
}
