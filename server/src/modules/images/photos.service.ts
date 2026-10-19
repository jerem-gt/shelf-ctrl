import type { Database } from 'better-sqlite3';

import type { ImageStore } from './imageStore.js';

/** Photo d'un exemplaire (état réel de l'objet, utile pour une annonce). */
export function createPhotoService(db: Database, store: ImageStore) {
  const currentPhoto = (copyId: number): { photo_path: string | null } | undefined =>
    db.prepare('SELECT photo_path FROM copies WHERE id = ?').get(copyId) as
      { photo_path: string | null } | undefined;

  return {
    /** Nom du nouveau fichier, ou `null` si l'exemplaire est inconnu. */
    async set(copyId: number, image: Buffer): Promise<string | null> {
      if (!currentPhoto(copyId)) {
        return null;
      }
      const name = await store.save('photos', copyId, image);
      const previous = currentPhoto(copyId);
      const changed = db.prepare('UPDATE copies SET photo_path = ? WHERE id = ?').run(name, copyId);
      if (changed.changes === 0) {
        // L'exemplaire a été supprimé pendant la conversion.
        await store.remove('photos', name);
        return null;
      }
      if (previous?.photo_path !== name) {
        await store.remove('photos', previous?.photo_path ?? null);
      }
      return name;
    },

    /** `false` : exemplaire inconnu. */
    async clear(copyId: number): Promise<boolean> {
      const row = currentPhoto(copyId);
      if (!row) {
        return false;
      }
      db.prepare('UPDATE copies SET photo_path = NULL WHERE id = ?').run(copyId);
      await store.remove('photos', row.photo_path);
      return true;
    },
  };
}
