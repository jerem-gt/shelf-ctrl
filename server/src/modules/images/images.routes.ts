import express, { Router } from 'express';

import { copyIdSchema } from '../copies/copies.schema.js';
import type { CoverService } from './covers/covers.service.js';
import { InvalidImageError } from './imageStore.js';
import type { createPhotoService } from './photos.service.js';

const MAX_UPLOAD = '12mb';

/** Corps brut : le fichier est envoyé tel quel, avec son `Content-Type` d'image. */
const rawImage = express.raw({ type: 'image/*', limit: MAX_UPLOAD });

/**
 * Monté sur `/api` : pochette d'une édition (envoi, récupération en ligne, retrait) et photo
 * d'un exemplaire (envoi, retrait). Les fichiers sont servis par `/covers` et `/photos`.
 */
export function createImagesRouter(
  covers: CoverService,
  photos: ReturnType<typeof createPhotoService>,
) {
  const router = Router();

  router.put('/editions/:id/cover', rawImage, async (req, res) => {
    const editionId = copyIdSchema.parse(req.params.id);
    if (!Buffer.isBuffer(req.body)) {
      res.status(415).json({ error: 'unsupported_media_type' });
      return;
    }
    try {
      const coverPath = await covers.setCover(editionId, req.body);
      if (coverPath === null) {
        res.status(404).json({ error: 'not_found' });
      } else {
        res.json({ coverPath });
      }
    } catch (error) {
      if (!(error instanceof InvalidImageError)) {
        throw error;
      }
      res.status(415).json({ error: 'invalid_image' });
    }
  });

  router.delete('/editions/:id/cover', async (req, res) => {
    if (await covers.clearCover(copyIdSchema.parse(req.params.id))) {
      res.status(204).end();
    } else {
      res.status(404).json({ error: 'not_found' });
    }
  });

  /** Remplace la pochette par celle trouvée en ligne ; 404 si aucune source n'en a. */
  router.post('/editions/:id/cover/fetch', async (req, res) => {
    const outcome = await covers.fetchForEdition(copyIdSchema.parse(req.params.id), true);
    if (outcome === 'fetched') {
      res.json({ fetched: true });
    } else {
      res
        .status(404)
        .json({ error: outcome === 'unknown_edition' ? 'not_found' : 'no_cover_found' });
    }
  });

  router.put('/copies/:id/photo', rawImage, async (req, res) => {
    const copyId = copyIdSchema.parse(req.params.id);
    if (!Buffer.isBuffer(req.body)) {
      res.status(415).json({ error: 'unsupported_media_type' });
      return;
    }
    try {
      const photoPath = await photos.set(copyId, req.body);
      if (photoPath === null) {
        res.status(404).json({ error: 'not_found' });
      } else {
        res.json({ photoPath });
      }
    } catch (error) {
      if (!(error instanceof InvalidImageError)) {
        throw error;
      }
      res.status(415).json({ error: 'invalid_image' });
    }
  });

  router.delete('/copies/:id/photo', async (req, res) => {
    if (await photos.clear(copyIdSchema.parse(req.params.id))) {
      res.status(204).end();
    } else {
      res.status(404).json({ error: 'not_found' });
    }
  });

  return router;
}
