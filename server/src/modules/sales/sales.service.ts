import type { CopyStatus, MediaFormat, SaleItem, SaleListItem } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';

import { today } from '../../lib/isoDate.js';
import type { ListInput, SellInput, UpdateSaleInput } from './sales.schema.js';

export type SaleFailure =
  'not_found' | 'already_listed' | 'already_sold' | 'loaned' | 'invalid_date';
export type SaleResult = { ok: true; sale: SaleItem } | { ok: false; reason: SaleFailure };

interface SaleRow {
  id: number;
  copy_id: number;
  platform: string | null;
  price_cents: number | null;
  listed_at: string | null;
  sold_at: string | null;
}

interface SaleListRow extends SaleRow {
  title: string;
  series: string | null;
  volume_number: number | null;
  format: MediaFormat;
}

const SALE_COLUMNS = 's.id, s.copy_id, s.platform, s.price_cents, s.listed_at, s.sold_at';

function toSaleItem(row: SaleRow): SaleItem {
  return {
    id: row.id,
    copyId: row.copy_id,
    platform: row.platform,
    priceCents: row.price_cents,
    listedAt: row.listed_at,
    soldAt: row.sold_at,
  };
}

export function createSalesService(db: Database) {
  const copyExists = (copyId: number): boolean =>
    db.prepare('SELECT 1 FROM copies WHERE id = ?').get(copyId) !== undefined;

  const findByCopy = (copyId: number): SaleItem | null => {
    const row = db
      .prepare(`SELECT ${SALE_COLUMNS} FROM sales s WHERE s.copy_id = ?`)
      .get(copyId) as SaleRow | undefined;
    return row ? toSaleItem(row) : null;
  };

  const listForSale = db.transaction((copyId: number, input: ListInput): SaleResult => {
    if (!copyExists(copyId)) {
      return { ok: false, reason: 'not_found' };
    }
    const existing = findByCopy(copyId);
    if (existing) {
      return { ok: false, reason: existing.soldAt ? 'already_sold' : 'already_listed' };
    }
    db.prepare(
      'INSERT INTO sales (copy_id, platform, price_cents, listed_at) VALUES (?, ?, ?, ?)',
    ).run(copyId, input.platform ?? null, input.priceCents ?? null, input.listedAt ?? today());
    return { ok: true, sale: findByCopy(copyId) as SaleItem };
  });

  const sell = db.transaction((copyId: number, input: SellInput): SaleResult => {
    const row = db.prepare('SELECT status FROM copy_status WHERE copy_id = ?').get(copyId) as
      { status: CopyStatus } | undefined;
    if (!row) {
      return { ok: false, reason: 'not_found' };
    }
    if (row.status === 'sold') {
      return { ok: false, reason: 'already_sold' };
    }
    if (row.status === 'loaned') {
      return { ok: false, reason: 'loaned' };
    }

    const soldAt = input.soldAt ?? today();
    const existing = findByCopy(copyId);
    if (!existing) {
      db.prepare(
        'INSERT INTO sales (copy_id, platform, price_cents, sold_at) VALUES (?, ?, ?, ?)',
      ).run(copyId, input.platform ?? null, input.priceCents ?? null, soldAt);
    } else if (existing.listedAt !== null && soldAt < existing.listedAt) {
      return { ok: false, reason: 'invalid_date' };
    } else {
      db.prepare(
        'UPDATE sales SET platform = ?, price_cents = ?, sold_at = ? WHERE copy_id = ?',
      ).run(
        input.platform ?? existing.platform,
        input.priceCents ?? existing.priceCents,
        soldAt,
        copyId,
      );
    }
    return { ok: true, sale: findByCopy(copyId) as SaleItem };
  });

  return {
    listForSale,
    sell,

    /** `undefined` : exemplaire inconnu ; `null` : ni en vente ni vendu. */
    findForCopy(copyId: number): SaleItem | null | undefined {
      return copyExists(copyId) ? findByCopy(copyId) : undefined;
    },

    update(copyId: number, input: UpdateSaleInput): SaleResult {
      const existing = findByCopy(copyId);
      if (!existing) {
        return { ok: false, reason: 'not_found' };
      }
      db.prepare('UPDATE sales SET platform = ?, price_cents = ? WHERE copy_id = ?').run(
        input.platform === undefined ? existing.platform : input.platform,
        input.priceCents === undefined ? existing.priceCents : input.priceCents,
        copyId,
      );
      return { ok: true, sale: findByCopy(copyId) as SaleItem };
    },

    /** Retire l'annonce ou annule la vente : l'exemplaire redevient « en rayon ». */
    remove(copyId: number): boolean {
      return db.prepare('DELETE FROM sales WHERE copy_id = ?').run(copyId).changes > 0;
    },

    listAll(): SaleListItem[] {
      const rows = db
        .prepare(
          `SELECT ${SALE_COLUMNS}, w.title, w.series, w.volume_number, e.format
           FROM sales s
           JOIN copies c ON c.id = s.copy_id
           JOIN editions e ON e.id = c.edition_id
           JOIN works w ON w.id = e.work_id
           ORDER BY COALESCE(s.sold_at, s.listed_at) DESC, s.id DESC`,
        )
        .all() as SaleListRow[];
      return rows.map((row) => ({
        ...toSaleItem(row),
        work: { title: row.title, series: row.series, volumeNumber: row.volume_number },
        format: row.format,
      }));
    },
  };
}
