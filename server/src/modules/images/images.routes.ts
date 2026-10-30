import express, { type Request, Router } from 'express';

import { HttpError, NotFoundError } from '../../lib/errors.js';
import { currentUserId } from '../../middleware.js';
import { copyIdSchema } from '../copies/copies.schema.js';
import type { CoverService } from './covers/covers.service.js';
import type { createPhotoService } from './photos.service.js';

const MAX_UPLOAD = '12mb';

/**
 * Corps brut : le fichier est envoyé tel quel. Un fichier sans type MIME connu arrive en
 * `application/octet-stream` ; son contenu est de toute façon vérifié par la conversion.
 */
const rawImage = express.raw({ type: ['image/*', 'application/octet-stream'], limit: MAX_UPLOAD });

/** Le corps brut de l'image ; un autre type de contenu n'a pas été lu par `rawImage`. */
function imageBody(req: Request): Buffer {
  if (!Buffer.isBuffer(req.body)) {
    throw new HttpError(415, 'common.unsupported_media_type');
  }
  return req.body;
}

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
    const coverPath = await covers.setCover(currentUserId(res), editionId, imageBody(req));
    if (coverPath === null) {
      throw new NotFoundError('edition.not_found');
    }
    res.json({ coverPath });
  });

  router.delete('/editions/:id/cover', async (req, res) => {
    if (!(await covers.clearCover(currentUserId(res), copyIdSchema.parse(req.params.id)))) {
      throw new NotFoundError('edition.not_found');
    }
    res.status(204).end();
  });

  /** Remplace la pochette par celle trouvée en ligne ; 404 si aucune source n'en a. */
  router.post('/editions/:id/cover/fetch', async (req, res) => {
    const outcome = await covers.fetchForEdition(
      currentUserId(res),
      copyIdSchema.parse(req.params.id),
      true,
    );
    if (outcome === 'unknown_edition') {
      throw new NotFoundError('edition.not_found');
    }
    if (outcome !== 'fetched') {
      throw new NotFoundError('image.no_cover_found');
    }
    res.json({ fetched: true });
  });

  router.put('/copies/:id/photo', rawImage, async (req, res) => {
    const copyId = copyIdSchema.parse(req.params.id);
    const photoPath = await photos.set(currentUserId(res), copyId, imageBody(req));
    if (photoPath === null) {
      throw new NotFoundError('copy.not_found');
    }
    res.json({ photoPath });
  });

  router.delete('/copies/:id/photo', async (req, res) => {
    if (!(await photos.clear(currentUserId(res), copyIdSchema.parse(req.params.id)))) {
      throw new NotFoundError('copy.not_found');
    }
    res.status(204).end();
  });

  return router;
}
