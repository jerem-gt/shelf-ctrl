import type { Database } from 'better-sqlite3';
import { Router } from 'express';

import { parseBarcode } from './barcode.js';
import { createBarcodesService } from './barcodes.service.js';
import type { BarcodeProvider } from './providers/types.js';

export function createBarcodesRouter(db: Database, providers: readonly BarcodeProvider[]) {
  const router = Router();
  const service = createBarcodesService(db, providers);

  router.get('/:code', async (req, res) => {
    const barcode = parseBarcode(req.params.code);
    if (!barcode) {
      res.status(400).json({ error: 'invalid_barcode' });
      return;
    }
    const result = await service.resolve(barcode);
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: 'not_found' });
    }
  });

  return router;
}
