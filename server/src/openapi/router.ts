import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { buildOpenApiSpec } from './spec.js';

export function createDocsRouter(): Router {
  const router = Router();
  const spec = buildOpenApiSpec();

  router.get('/openapi.json', (_req, res) => {
    res.json(spec);
  });

  router.use('/', swaggerUi.serveFiles(spec), swaggerUi.setup(spec));

  return router;
}
