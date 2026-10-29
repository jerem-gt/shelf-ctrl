import type { Database } from 'better-sqlite3';
import express, { Router } from 'express';

import { currentUserId } from '../../middleware.js';
import {
  buildTemplate,
  createImportService,
  EmptyFileError,
  type ImportDeps,
  ImportRunningError,
  TooManyRowsError,
} from './import.service.js';
import { MAX_ROWS, NoColumnsError } from './rows.js';

/** Corps brut en octet-stream uniquement : text/plain, envoyable par un formulaire cross-site, est ignoré (anti-CSRF). */
const rawFile = express.raw({ type: 'application/octet-stream', limit: '2mb' });

/**
 * Monté sur `/api/import` : modèle de fichier, aperçu sans écriture, import en tâche de fond
 * (lancé par POST, suivi par GET). Les erreurs de fichier répondent 400 avec un code.
 */
export function createImportRouter(db: Database, deps: ImportDeps) {
  const router = Router();
  const service = createImportService(db, deps);

  const fileProblem = (error: unknown): { status: number; body: object } | null => {
    if (error instanceof EmptyFileError) {
      return { status: 400, body: { error: 'empty_file' } };
    }
    if (error instanceof NoColumnsError) {
      return { status: 400, body: { error: 'no_columns' } };
    }
    if (error instanceof TooManyRowsError) {
      return { status: 400, body: { error: 'too_many_rows', max: MAX_ROWS } };
    }
    if (error instanceof ImportRunningError) {
      return { status: 409, body: { error: 'import_running' } };
    }
    return null;
  };

  router.get('/template', (_req, res) => {
    res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="shelfctrl-modele.csv"')
      .send(buildTemplate());
  });

  router.post('/preview', rawFile, (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: 'empty_file' });
      return;
    }
    try {
      res.json(service.preview(currentUserId(res), req.body));
    } catch (error) {
      const problem = fileProblem(error);
      if (!problem) {
        throw error;
      }
      res.status(problem.status).json(problem.body);
    }
  });

  router.post('/', rawFile, (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: 'empty_file' });
      return;
    }
    try {
      res.status(202).json(service.start(currentUserId(res), req.body));
    } catch (error) {
      const problem = fileProblem(error);
      if (!problem) {
        throw error;
      }
      res.status(problem.status).json(problem.body);
    }
  });

  router.get('/:id', (req, res) => {
    const job = service.get(currentUserId(res), req.params.id);
    if (job) {
      res.json(job);
    } else {
      res.status(404).json({ error: 'not_found' });
    }
  });

  return router;
}
