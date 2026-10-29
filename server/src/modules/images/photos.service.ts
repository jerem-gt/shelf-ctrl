import type { Database } from 'better-sqlite3';

import type { ImageStore } from './imageStore.js';

/** Photo d'un exemplaire (état réel de l'objet, utile pour une annonce). */
export function createPhotoService(db: Database, store: ImageStore) {
  const currentPhoto = (
    userId: number,
    copyId: number,
  ): { photo_path: string | null } | undefined =>
    db.prepare('SELECT photo_path FROM copies WHERE id = ? AND user_id = ?').get(copyId, userId) as
      { photo_path: string | null } | undefined;

  return {
    /** Nom du nouveau fichier, ou `null` si l'exemplaire est inconnu. */
    async set(userId: number, copyId: number, image: Buffer): Promise<string | null> {
      if (!currentPhoto(userId, copyId)) {
        return null;
      }
      const name = await store.save('photos', copyId, image);
      const previous = currentPhoto(userId, copyId);
      const changed = db
        .prepare('UPDATE copies SET photo_path = ? WHERE id = ? AND user_id = ?')
        .run(name, copyId, userId);
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
    async clear(userId: number, copyId: number): Promise<boolean> {
      const row = currentPhoto(userId, copyId);
      if (!row) {
        return false;
      }
      db.prepare('UPDATE copies SET photo_path = NULL WHERE id = ?').run(copyId);
      await store.remove('photos', row.photo_path);
      return true;
    },
  };
}
