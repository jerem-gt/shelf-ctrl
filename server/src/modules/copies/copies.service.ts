import type {
  CopyCondition,
  CopyItem,
  CopyListResponse,
  CopyStatus,
  MediaFormat,
} from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';

import { normalizeBarcode } from '../barcodes/barcode.js';
import type { CreateCopyInput, ListCopiesQuery, UpdateCopyInput } from './copies.schema.js';

interface CopyRow {
  id: number;
  status: CopyStatus;
  condition: CopyCondition;
  condition_note: string | null;
  location: string | null;
  photo_path: string | null;
  created_at: string;
  edition_id: number;
  format: MediaFormat;
  barcode: string | null;
  publisher: string | null;
  release_year: number | null;
  language: string | null;
  cover_path: string | null;
  work_id: number;
  title: string;
  series: string | null;
  volume_number: number | null;
  creators: string | null;
  year: number | null;
}

const SELECT_COPIES = `
  SELECT c.id, cs.status, c.condition, c.condition_note, c.location, c.photo_path, c.created_at,
         e.id AS edition_id, e.format, e.barcode, e.publisher, e.release_year, e.language, e.cover_path,
         w.id AS work_id, w.title, w.series, w.volume_number, w.creators, w.year
  FROM copies c
  JOIN copy_status cs ON cs.copy_id = c.id
  JOIN editions e ON e.id = c.edition_id
  JOIN works w ON w.id = e.work_id`;

function toCopyItem(row: CopyRow): CopyItem {
  return {
    id: row.id,
    status: row.status,
    condition: row.condition,
    conditionNote: row.condition_note,
    location: row.location,
    photoPath: row.photo_path,
    createdAt: row.created_at,
    edition: {
      id: row.edition_id,
      format: row.format,
      barcode: row.barcode,
      publisher: row.publisher,
      releaseYear: row.release_year,
      language: row.language,
      coverPath: row.cover_path,
    },
    work: {
      id: row.work_id,
      title: row.title,
      series: row.series,
      volumeNumber: row.volume_number,
      creators: row.creators,
      year: row.year,
    },
  };
}

/** Fichiers d'image à supprimer après la suppression d'un exemplaire. */
export interface RemovedFiles {
  photoPath: string | null;
  coverPath: string | null;
}

function escapeLike(value: string) {
  return value.replaceAll(/[\\%_]/g, String.raw`\$&`);
}

export function createCopiesService(db: Database) {
  const findById = (id: number): CopyItem | null => {
    const row = db.prepare(`${SELECT_COPIES} WHERE c.id = ?`).get(id) as CopyRow | undefined;
    return row ? toCopyItem(row) : null;
  };

  const findOrCreateWork = (work: CreateCopyInput['work']): number => {
    const series = work.series ?? null;
    const volumeNumber = work.volumeNumber ?? null;
    const existing = db
      .prepare('SELECT id FROM works WHERE title = ? AND series IS ? AND volume_number IS ?')
      .get(work.title, series, volumeNumber) as { id: number } | undefined;
    if (existing) {
      return existing.id;
    }
    const result = db
      .prepare(
        'INSERT INTO works (title, series, volume_number, creators, year) VALUES (?, ?, ?, ?, ?)',
      )
      .run(work.title, series, volumeNumber, work.creators ?? null, work.year ?? null);
    return Number(result.lastInsertRowid);
  };

  const findOrCreateEdition = (input: CreateCopyInput): number => {
    const barcode = input.edition.barcode ? normalizeBarcode(input.edition.barcode) : null;
    if (barcode) {
      const existing = db.prepare('SELECT id FROM editions WHERE barcode = ?').get(barcode) as
        { id: number } | undefined;
      if (existing) {
        return existing.id;
      }
    }
    const result = db
      .prepare(
        `INSERT INTO editions (work_id, format, barcode, publisher, release_year, language)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        findOrCreateWork(input.work),
        input.edition.format,
        barcode,
        input.edition.publisher ?? null,
        input.edition.releaseYear ?? null,
        input.edition.language ?? null,
      );
    return Number(result.lastInsertRowid);
  };

  const create = db.transaction((input: CreateCopyInput): CopyItem => {
    const result = db
      .prepare(
        'INSERT INTO copies (edition_id, condition, condition_note, location) VALUES (?, ?, ?, ?)',
      )
      .run(
        findOrCreateEdition(input),
        input.condition,
        input.conditionNote ?? null,
        input.location ?? null,
      );
    return findById(Number(result.lastInsertRowid)) as CopyItem;
  });

  return {
    create,
    findById,

    list(query: ListCopiesQuery): CopyListResponse {
      const clauses: string[] = [];
      const params: (string | number)[] = [];

      if (query.q) {
        const like = `%${escapeLike(query.q)}%`;
        clauses.push(
          String.raw`(w.title LIKE ? ESCAPE '\' OR w.series LIKE ? ESCAPE '\' OR w.creators LIKE ? ESCAPE '\' OR e.barcode LIKE ? ESCAPE '\')`,
        );
        params.push(like, like, like, like);
      }
      if (query.format) {
        clauses.push('e.format = ?');
        params.push(query.format);
      }
      if (query.status) {
        clauses.push('cs.status = ?');
        params.push(query.status);
      }

      const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
      const rows = db
        .prepare(
          `${SELECT_COPIES}${where}
           ORDER BY COALESCE(w.series, w.title) COLLATE NOCASE, w.volume_number, w.title COLLATE NOCASE, c.id
           LIMIT ? OFFSET ?`,
        )
        .all(...params, query.limit, query.offset) as CopyRow[];
      const count = db
        .prepare(
          `SELECT COUNT(*) AS total FROM copies c
           JOIN copy_status cs ON cs.copy_id = c.id
           JOIN editions e ON e.id = c.edition_id
           JOIN works w ON w.id = e.work_id${where}`,
        )
        .get(...params) as { total: number };

      return { items: rows.map(toCopyItem), total: count.total };
    },

    update(id: number, input: UpdateCopyInput): CopyItem | null {
      const fields: string[] = [];
      const params: (string | number | null)[] = [];
      if (input.condition !== undefined) {
        fields.push('condition = ?');
        params.push(input.condition);
      }
      if (input.conditionNote !== undefined) {
        fields.push('condition_note = ?');
        params.push(input.conditionNote);
      }
      if (input.location !== undefined) {
        fields.push('location = ?');
        params.push(input.location);
      }
      const result = db
        .prepare(`UPDATE copies SET ${fields.join(', ')} WHERE id = ?`)
        .run(...params, id);
      return result.changes > 0 ? findById(id) : null;
    },

    /**
     * Supprime l'exemplaire (et ses prêts et ventes, en cascade), puis l'édition et l'œuvre
     * qui n'ont plus d'exemplaire : sinon un code-barres resterait « connu » sans rien posséder.
     * Renvoie les fichiers d'image devenus orphelins, ou `null` si l'exemplaire n'existe pas.
     */
    remove: db.transaction((id: number): RemovedFiles | null => {
      const row = db
        .prepare(
          `SELECT c.edition_id, c.photo_path, e.cover_path
           FROM copies c JOIN editions e ON e.id = c.edition_id
           WHERE c.id = ?`,
        )
        .get(id) as
        { edition_id: number; photo_path: string | null; cover_path: string | null } | undefined;
      if (!row) {
        return null;
      }
      db.prepare('DELETE FROM copies WHERE id = ?').run(id);
      const edition = db
        .prepare(
          `DELETE FROM editions
           WHERE id = ? AND NOT EXISTS (SELECT 1 FROM copies WHERE edition_id = ?)
           RETURNING work_id`,
        )
        .get(row.edition_id, row.edition_id) as { work_id: number } | undefined;
      if (edition) {
        db.prepare(
          `DELETE FROM works
           WHERE id = ? AND NOT EXISTS (SELECT 1 FROM editions WHERE work_id = ?)`,
        ).run(edition.work_id, edition.work_id);
      }
      // La pochette appartient à l'édition : elle ne disparaît qu'avec elle.
      return { photoPath: row.photo_path, coverPath: edition ? row.cover_path : null };
    }),
  };
}

export type CopiesService = ReturnType<typeof createCopiesService>;
