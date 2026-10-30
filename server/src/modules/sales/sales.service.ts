import type { CopyStatus, MediaFormat, SaleItem, SaleListItem } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';

import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { today } from '../../lib/isoDate.js';
import type { ListInput, SellInput, UpdateSaleInput } from './sales.schema.js';

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
  const copyExists = (userId: number, copyId: number): boolean =>
    db.prepare('SELECT 1 FROM copies WHERE id = ? AND user_id = ?').get(copyId, userId) !==
    undefined;

  const findByCopy = (userId: number, copyId: number): SaleItem | null => {
    const row = db
      .prepare(`SELECT ${SALE_COLUMNS} FROM sales s WHERE s.copy_id = ? AND s.user_id = ?`)
      .get(copyId, userId) as SaleRow | undefined;
    return row ? toSaleItem(row) : null;
  };

  const listForSale = db.transaction(
    (userId: number, copyId: number, input: ListInput): SaleItem => {
      if (!copyExists(userId, copyId)) {
        throw new NotFoundError('copy.not_found');
      }
      const existing = findByCopy(userId, copyId);
      if (existing) {
        throw new ConflictError(existing.soldAt ? 'sale.already_sold' : 'sale.already_listed');
      }
      db.prepare(
        'INSERT INTO sales (user_id, copy_id, platform, price_cents, listed_at) VALUES (?, ?, ?, ?, ?)',
      ).run(
        userId,
        copyId,
        input.platform ?? null,
        input.priceCents ?? null,
        input.listedAt ?? today(),
      );
      return findByCopy(userId, copyId) as SaleItem;
    },
  );

  const sell = db.transaction((userId: number, copyId: number, input: SellInput): SaleItem => {
    const row = db
      .prepare(
        `SELECT cs.status FROM copy_status cs JOIN copies c ON c.id = cs.copy_id
         WHERE cs.copy_id = ? AND c.user_id = ?`,
      )
      .get(copyId, userId) as { status: CopyStatus } | undefined;
    if (!row) {
      throw new NotFoundError('copy.not_found');
    }
    if (row.status === 'sold') {
      throw new ConflictError('sale.already_sold');
    }
    if (row.status === 'loaned') {
      throw new ConflictError('sale.copy_loaned');
    }

    const soldAt = input.soldAt ?? today();
    const existing = findByCopy(userId, copyId);
    if (!existing) {
      db.prepare(
        'INSERT INTO sales (user_id, copy_id, platform, price_cents, sold_at) VALUES (?, ?, ?, ?, ?)',
      ).run(userId, copyId, input.platform ?? null, input.priceCents ?? null, soldAt);
    } else if (existing.listedAt !== null && soldAt < existing.listedAt) {
      throw new BadRequestError('sale.invalid_date');
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
    return findByCopy(userId, copyId) as SaleItem;
  });

  return {
    listForSale,
    sell,

    /** `null` : ni en vente ni vendu. */
    findForCopy(userId: number, copyId: number): SaleItem | null {
      if (!copyExists(userId, copyId)) {
        throw new NotFoundError('copy.not_found');
      }
      return findByCopy(userId, copyId);
    },

    update(userId: number, copyId: number, input: UpdateSaleInput): SaleItem {
      const existing = findByCopy(userId, copyId);
      if (!existing) {
        throw new NotFoundError('sale.not_found');
      }
      db.prepare('UPDATE sales SET platform = ?, price_cents = ? WHERE copy_id = ?').run(
        input.platform === undefined ? existing.platform : input.platform,
        input.priceCents === undefined ? existing.priceCents : input.priceCents,
        copyId,
      );
      return findByCopy(userId, copyId) as SaleItem;
    },

    /** Retire l'annonce ou annule la vente : l'exemplaire redevient « en rayon ». */
    remove(userId: number, copyId: number): void {
      const { changes } = db
        .prepare('DELETE FROM sales WHERE copy_id = ? AND user_id = ?')
        .run(copyId, userId);
      if (changes === 0) {
        throw new NotFoundError('sale.not_found');
      }
    },

    listAll(userId: number): SaleListItem[] {
      const rows = db
        .prepare(
          `SELECT ${SALE_COLUMNS}, w.title, w.series, w.volume_number, e.format
           FROM sales s
           JOIN copies c ON c.id = s.copy_id
           JOIN editions e ON e.id = c.edition_id
           JOIN works w ON w.id = e.work_id
           WHERE s.user_id = ?
           ORDER BY COALESCE(s.sold_at, s.listed_at) DESC, s.id DESC`,
        )
        .all(userId) as SaleListRow[];
      return rows.map((row) => ({
        ...toSaleItem(row),
        work: { title: row.title, series: row.series, volumeNumber: row.volume_number },
        format: row.format,
      }));
    },
  };
}
