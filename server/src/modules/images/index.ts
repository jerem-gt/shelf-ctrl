import type { Database } from 'better-sqlite3';
import express, { type RequestHandler, Router } from 'express';

import { currentUserId } from '../../middleware.js';
import type { CopiesHooks } from '../copies/copies.routes.js';
import { createCoverService } from './covers/covers.service.js';
import type { CoverProvider } from './covers/types.js';
import { createImagesRouter } from './images.routes.js';
import { createImageStore, type ImageKind } from './imageStore.js';
import { createPhotoService } from './photos.service.js';

export interface ImagesOptions {
  /** Les images vivent dans `<dataDir>/images`. */
  dataDir: string;
  /** Sources de pochettes pour les nouvelles éditions (vide : envoi manuel uniquement). */
  coverProviders: readonly CoverProvider[];
}

/** Les noms de fichiers contiennent l'empreinte du contenu : le cache peut être immuable. */
const STATIC_OPTIONS = { maxAge: '1y', immutable: true, index: false, fallthrough: false } as const;

/** Fichiers d'image d'un compte, à effacer du disque après sa suppression. */
export interface AccountImages {
  covers: string[];
  photos: string[];
}

const OWNER_QUERY: Record<ImageKind, string> = {
  covers: 'SELECT 1 FROM editions WHERE cover_path = ? AND user_id = ?',
  photos: 'SELECT 1 FROM copies WHERE photo_path = ? AND user_id = ?',
};

export function createImages(db: Database, options: ImagesOptions) {
  const store = createImageStore(options.dataDir);

  /** Sert les fichiers du seul compte connecté : celui d'un autre compte répond 404. */
  const serve = (kind: ImageKind): Router => {
    const owned = db.prepare(OWNER_QUERY[kind]);
    const checkOwner: RequestHandler = (req, res, next) => {
      if (owned.get(req.path.slice(1), currentUserId(res)) === undefined) {
        res.status(404).end();
        return;
      }
      next();
    };
    return Router().use(checkOwner, express.static(store.dirOf(kind), STATIC_OPTIONS));
  };

  /** Un fichier qui résiste ne doit pas faire échouer la requête : les données sont déjà supprimées. */
  const removeFiles = async (kind: ImageKind, names: readonly (string | null)[]) => {
    const outcomes = await Promise.allSettled(names.map((name) => store.remove(kind, name)));
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        const reason: unknown = outcome.reason;
        console.warn('[images] fichier non supprimé :', reason);
      }
    }
  };
  const covers = createCoverService(db, store, options.coverProviders);
  const photos = createPhotoService(db, store);

  const copiesHooks: CopiesHooks = {
    /** Pochette cherchée en ligne en arrière-plan : l'ajout n'attend pas le réseau. */
    onCreated(userId, copy) {
      if (copy.edition.coverPath === null) {
        covers.fetchForEdition(userId, copy.edition.id, false).catch((error: unknown) => {
          console.warn('[covers]', error instanceof Error ? error.message : error);
        });
      }
    },
    async onRemoved(files) {
      await Promise.all([
        removeFiles('photos', [files.photoPath]),
        removeFiles('covers', [files.coverPath]),
      ]);
    },
  };

  return {
    /** Cherche la pochette d'une édition sans la remplacer ; `true` si elle a été trouvée. */
    fetchCover: async (userId: number, editionId: number): Promise<boolean> =>
      (await covers.fetchForEdition(userId, editionId, false)) === 'fetched',
    /** Efface les fichiers d'un compte supprimé. */
    removeAccountImages: async (files: AccountImages): Promise<void> => {
      await Promise.all([removeFiles('covers', files.covers), removeFiles('photos', files.photos)]);
    },
    router: createImagesRouter(covers, photos),
    copiesHooks,
    covers: serve('covers'),
    photos: serve('photos'),
  };
}
