import type {
  BorrowerItem,
  CopyStatus,
  LoanItem,
  MediaFormat,
  OpenLoanItem,
} from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';

import { today } from '../../lib/isoDate.js';
import type { LendInput, ReturnInput } from './loans.schema.js';

export type LoanFailure =
  'not_found' | 'sold' | 'already_loaned' | 'already_returned' | 'invalid_date';
export type LoanResult = { ok: true; loan: LoanItem } | { ok: false; reason: LoanFailure };

interface LoanRow {
  id: number;
  copy_id: number;
  borrower_id: number;
  borrower_name: string;
  loaned_at: string;
  returned_at: string | null;
}

interface OpenLoanRow extends LoanRow {
  title: string;
  series: string | null;
  volume_number: number | null;
  format: MediaFormat;
}

const SELECT_LOANS = `
  SELECT l.id, l.copy_id, l.borrower_id, b.name AS borrower_name, l.loaned_at, l.returned_at
  FROM loans l
  JOIN borrowers b ON b.id = l.borrower_id`;

function toLoanItem(row: LoanRow): LoanItem {
  return {
    id: row.id,
    copyId: row.copy_id,
    borrowerId: row.borrower_id,
    borrowerName: row.borrower_name,
    loanedAt: row.loaned_at,
    returnedAt: row.returned_at,
  };
}

export function createLoansService(db: Database) {
  const findLoan = (userId: number, id: number): LoanItem | null => {
    const row = db.prepare(`${SELECT_LOANS} WHERE l.id = ? AND l.user_id = ?`).get(id, userId) as
      LoanRow | undefined;
    return row ? toLoanItem(row) : null;
  };

  /** Retrouve l'emprunteur sans tenir compte de la casse, ou le crée. */
  const findOrCreateBorrower = (userId: number, name: string): number => {
    const existing = db
      .prepare('SELECT id FROM borrowers WHERE user_id = ? AND name = ? COLLATE NOCASE')
      .get(userId, name) as { id: number } | undefined;
    if (existing) {
      return existing.id;
    }
    return Number(
      db.prepare('INSERT INTO borrowers (user_id, name) VALUES (?, ?)').run(userId, name)
        .lastInsertRowid,
    );
  };

  const lend = db.transaction((userId: number, copyId: number, input: LendInput): LoanResult => {
    const row = db
      .prepare(
        `SELECT cs.status FROM copy_status cs JOIN copies c ON c.id = cs.copy_id
         WHERE cs.copy_id = ? AND c.user_id = ?`,
      )
      .get(copyId, userId) as { status: CopyStatus } | undefined;
    if (!row) {
      return { ok: false, reason: 'not_found' };
    }
    if (row.status === 'sold') {
      return { ok: false, reason: 'sold' };
    }
    if (row.status === 'loaned') {
      return { ok: false, reason: 'already_loaned' };
    }
    const result = db
      .prepare('INSERT INTO loans (user_id, copy_id, borrower_id, loaned_at) VALUES (?, ?, ?, ?)')
      .run(
        userId,
        copyId,
        findOrCreateBorrower(userId, input.borrowerName),
        input.loanedAt ?? today(),
      );
    return { ok: true, loan: findLoan(userId, Number(result.lastInsertRowid)) as LoanItem };
  });

  return {
    lend,

    returnLoan(userId: number, id: number, input: ReturnInput): LoanResult {
      const loan = findLoan(userId, id);
      if (!loan) {
        return { ok: false, reason: 'not_found' };
      }
      if (loan.returnedAt !== null) {
        return { ok: false, reason: 'already_returned' };
      }
      const returnedAt = input.returnedAt ?? today();
      if (returnedAt < loan.loanedAt) {
        return { ok: false, reason: 'invalid_date' };
      }
      db.prepare('UPDATE loans SET returned_at = ? WHERE id = ?').run(returnedAt, id);
      return { ok: true, loan: findLoan(userId, id) as LoanItem };
    },

    /** Historique d'un exemplaire, du plus récent au plus ancien ; `null` si l'exemplaire n'existe pas. */
    listForCopy(userId: number, copyId: number): LoanItem[] | null {
      const exists = db
        .prepare('SELECT 1 FROM copies WHERE id = ? AND user_id = ?')
        .get(copyId, userId);
      if (!exists) {
        return null;
      }
      const rows = db
        .prepare(`${SELECT_LOANS} WHERE l.copy_id = ? ORDER BY l.loaned_at DESC, l.id DESC`)
        .all(copyId) as LoanRow[];
      return rows.map(toLoanItem);
    },

    listOpen(userId: number): OpenLoanItem[] {
      const rows = db
        .prepare(
          `SELECT l.id, l.copy_id, l.borrower_id, b.name AS borrower_name, l.loaned_at, l.returned_at,
                  w.title, w.series, w.volume_number, e.format
           FROM loans l
           JOIN borrowers b ON b.id = l.borrower_id
           JOIN copies c ON c.id = l.copy_id
           JOIN editions e ON e.id = c.edition_id
           JOIN works w ON w.id = e.work_id
           WHERE l.user_id = ? AND l.returned_at IS NULL
           ORDER BY l.loaned_at, l.id`,
        )
        .all(userId) as OpenLoanRow[];
      return rows.map((row) => ({
        ...toLoanItem(row),
        work: { title: row.title, series: row.series, volumeNumber: row.volume_number },
        format: row.format,
      }));
    },

    listBorrowers(userId: number): BorrowerItem[] {
      const rows = db
        .prepare(
          `SELECT b.id, b.name, COUNT(l.id) AS open_loans
           FROM borrowers b
           LEFT JOIN loans l ON l.borrower_id = b.id AND l.returned_at IS NULL
           WHERE b.user_id = ?
           GROUP BY b.id
           ORDER BY b.name COLLATE NOCASE`,
        )
        .all(userId) as { id: number; name: string; open_loans: number }[];
      return rows.map((row) => ({ id: row.id, name: row.name, openLoans: row.open_loans }));
    },
  };
}
