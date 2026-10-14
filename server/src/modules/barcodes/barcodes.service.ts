import type { BarcodeLookupResponse, MediaFormat } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';

import type { ParsedBarcode } from './barcode.js';
import type { BarcodeProvider } from './providers/types.js';

interface KnownEditionRow {
  format: MediaFormat;
  publisher: string | null;
  release_year: number | null;
  language: string | null;
  title: string;
  series: string | null;
  volume_number: number | null;
  creators: string | null;
  year: number | null;
}

export function createBarcodesService(db: Database, providers: readonly BarcodeProvider[]) {
  const findKnown = (barcode: ParsedBarcode): BarcodeLookupResponse | null => {
    const row = db
      .prepare(
        `SELECT e.format, e.publisher, e.release_year, e.language,
                w.title, w.series, w.volume_number, w.creators, w.year
         FROM editions e JOIN works w ON w.id = e.work_id
         WHERE e.barcode = ?`,
      )
      .get(barcode.code) as KnownEditionRow | undefined;
    if (!row) {
      return null;
    }
    return {
      barcode: barcode.code,
      kind: barcode.kind,
      source: 'local',
      known: true,
      suggestion: {
        work: {
          title: row.title,
          series: row.series,
          volumeNumber: row.volume_number,
          creators: row.creators,
          year: row.year,
        },
        edition: {
          format: row.format,
          publisher: row.publisher,
          releaseYear: row.release_year,
          language: row.language,
        },
      },
    };
  };

  return {
    /**
     * Cherche d'abord dans la collection, puis dans chaque source adaptée au type de code.
     * Une source en erreur (réseau, quota) est ignorée : on passe à la suivante.
     * `null` quand personne ne connaît le code → saisie manuelle côté client.
     */
    async resolve(barcode: ParsedBarcode): Promise<BarcodeLookupResponse | null> {
      const known = findKnown(barcode);
      if (known) {
        return known;
      }

      for (const provider of providers) {
        if (!provider.kinds.includes(barcode.kind)) {
          continue;
        }
        try {
          const suggestion = await provider.lookup(barcode.code);
          if (suggestion) {
            return {
              barcode: barcode.code,
              kind: barcode.kind,
              source: provider.source,
              known: false,
              suggestion,
            };
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'erreur inconnue';
          console.warn(`[barcode] ${provider.source} : ${reason}`);
        }
      }
      return null;
    },
  };
}
