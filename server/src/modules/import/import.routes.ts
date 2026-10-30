import type { Database } from 'better-sqlite3';
import express, { type Request, Router } from 'express';

import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { currentUserId } from '../../middleware.js';
import { buildTemplate, createImportService, type ImportDeps } from './import.service.js';

/** Corps brut en octet-stream uniquement : text/plain, envoyable par un formulaire cross-site, est ignoré (anti-CSRF). */
const rawFile = express.raw({ type: 'application/octet-stream', limit: '2mb' });

/** Le fichier envoyé ; absent, d'un autre type ou vide : 400. */
function fileBody(req: Request): Buffer {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new BadRequestError('import.empty_file');
  }
  return req.body;
}

/**
 * Monté sur `/api/import` : modèle de fichier, aperçu sans écriture, import en tâche de fond
 * (lancé par POST, suivi par GET). Les erreurs de fichier répondent 400 avec un code.
 */
export function createImportRouter(db: Database, deps: ImportDeps) {
  const router = Router();
  const service = createImportService(db, deps);

  router.get('/template', (_req, res) => {
    res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="shelfctrl-modele.csv"')
      .send(buildTemplate());
  });

  router.post('/preview', rawFile, (req, res) => {
    res.json(service.preview(currentUserId(res), fileBody(req)));
  });

  router.post('/', rawFile, (req, res) => {
    res.status(202).json(service.start(currentUserId(res), fileBody(req)));
  });

  router.get('/:id', (req, res) => {
    const job = service.get(currentUserId(res), req.params.id);
    if (!job) {
      throw new NotFoundError('import.not_found');
    }
    res.json(job);
  });

  return router;
}
