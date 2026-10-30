import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { currentUserId } from '../../middleware.js';
import { parseBarcode } from './barcode.js';
import { createBarcodesService } from './barcodes.service.js';
import type { BarcodeProvider } from './providers/types.js';

export function createBarcodesRouter(db: Database, providers: readonly BarcodeProvider[]) {
  const router = Router();
  const service = createBarcodesService(db, providers);

  router.get('/:code', async (req, res) => {
    const barcode = parseBarcode(req.params.code);
    if (!barcode) {
      throw new BadRequestError('barcode.invalid');
    }
    const result = await service.resolve(currentUserId(res), barcode);
    if (!result) {
      throw new NotFoundError('barcode.not_found');
    }
    res.json(result);
  });

  return router;
}
