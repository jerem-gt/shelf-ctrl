import {
  consoleOf,
  type CopyCondition,
  type CopyItem,
  type CopyListResponse,
  type CopyStatus,
  isGameFormat,
  type MediaFormat,
} from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';

import { normalizeConsole } from '../../lib/consoles.js';
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
  console: string | null;
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
         e.id AS edition_id, e.format, e.barcode, e.publisher, e.release_year, e.language, e.console, e.cover_path,
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
      console: row.console,
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

/**
 * Console à enregistrer : seul un jeu vidéo en a une, sous son nom connu quand on la reconnaît
 * (« ps5 » → « PlayStation 5 ») pour que le filtre et l'import la retrouvent.
 */
function consoleFor(format: MediaFormat, value: string | null | undefined): string | null {
  const kept = consoleOf(format, value);
  return kept === null ? null : normalizeConsole(kept);
}

function escapeLike(value: string) {
  return value.replaceAll(/[\\%_]/g, String.raw`\$&`);
}

export function createCopiesService(db: Database) {
  const findById = (userId: number, id: number): CopyItem | null => {
    const row = db.prepare(`${SELECT_COPIES} WHERE c.id = ? AND c.user_id = ?`).get(id, userId) as
      CopyRow | undefined;
    return row ? toCopyItem(row) : null;
  };

  const findOrCreateWork = (userId: number, work: CreateCopyInput['work']): number => {
    const series = work.series ?? null;
    const volumeNumber = work.volumeNumber ?? null;
    const existing = db
      .prepare(
        'SELECT id FROM works WHERE user_id = ? AND title = ? AND series IS ? AND volume_number IS ?',
      )
      .get(userId, work.title, series, volumeNumber) as { id: number } | undefined;
    if (existing) {
      return existing.id;
    }
    const result = db
      .prepare(
        `INSERT INTO works (user_id, title, series, volume_number, creators, year)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(userId, work.title, series, volumeNumber, work.creators ?? null, work.year ?? null);
    return Number(result.lastInsertRowid);
  };

  const findOrCreateEdition = (userId: number, input: CreateCopyInput): number => {
    const barcode = input.edition.barcode ? normalizeBarcode(input.edition.barcode) : null;
    if (barcode) {
      const existing = db
        .prepare('SELECT id FROM editions WHERE user_id = ? AND barcode = ?')
        .get(userId, barcode) as { id: number } | undefined;
      if (existing) {
        return existing.id;
      }
    }
    const result = db
      .prepare(
        `INSERT INTO editions (user_id, work_id, format, barcode, publisher, release_year, language, console)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        findOrCreateWork(userId, input.work),
        input.edition.format,
        barcode,
        input.edition.publisher ?? null,
        input.edition.releaseYear ?? null,
        input.edition.language ?? null,
        consoleFor(input.edition.format, input.edition.console),
      );
    return Number(result.lastInsertRowid);
  };

  const create = db.transaction((userId: number, input: CreateCopyInput): CopyItem => {
    const result = db
      .prepare(
        `INSERT INTO copies (user_id, edition_id, condition, condition_note, location)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        findOrCreateEdition(userId, input),
        input.condition,
        input.conditionNote ?? null,
        input.location ?? null,
      );
    return findById(userId, Number(result.lastInsertRowid)) as CopyItem;
  });

  return {
    create,
    findById,

    /** Consoles des jeux de la collection du compte, sans doublon (casse ignorée), triées. */
    consoles(userId: number): string[] {
      const rows = db
        .prepare(
          `SELECT MIN(console) AS console FROM editions
           WHERE user_id = ? AND format = 'game' AND console IS NOT NULL
           GROUP BY console COLLATE NOCASE
           ORDER BY console COLLATE NOCASE`,
        )
        .all(userId) as { console: string }[];
      return rows.map((row) => row.console);
    },

    list(userId: number, query: ListCopiesQuery): CopyListResponse {
      const clauses = ['c.user_id = ?'];
      const params: (string | number)[] = [userId];

      if (query.q) {
        const like = `%${escapeLike(query.q)}%`;
        clauses.push(
          String.raw`(w.title LIKE ? ESCAPE '\' OR w.series LIKE ? ESCAPE '\' OR w.creators LIKE ? ESCAPE '\' OR e.barcode LIKE ? ESCAPE '\' OR e.console LIKE ? ESCAPE '\')`,
        );
        params.push(like, like, like, like, like);
      }
      if (query.format) {
        clauses.push('e.format = ?');
        params.push(query.format);
      }
      if (query.console) {
        clauses.push('e.console = ? COLLATE NOCASE');
        params.push(query.console);
      }
      if (query.status) {
        clauses.push('cs.status = ?');
        params.push(query.status);
      }

      const where = ` WHERE ${clauses.join(' AND ')}`;
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

    /**
     * Modifie l'exemplaire ; `console` modifie son édition, donc tous ses exemplaires, et n'a
     * d'effet que sur un jeu vidéo (ignorée pour les autres formats, comme à la création).
     */
    update: db.transaction(
      (userId: number, id: number, input: UpdateCopyInput): CopyItem | null => {
        const copy = findById(userId, id);
        if (!copy) {
          return null;
        }
        if (input.console !== undefined && isGameFormat(copy.edition.format)) {
          db.prepare('UPDATE editions SET console = ? WHERE id = ? AND user_id = ?').run(
            consoleFor(copy.edition.format, input.console),
            copy.edition.id,
            userId,
          );
        }
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
        if (fields.length > 0) {
          db.prepare(`UPDATE copies SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(
            ...params,
            id,
            userId,
          );
        }
        return findById(userId, id);
      },
    ),

    /**
     * Supprime l'exemplaire (et ses prêts et ventes, en cascade), puis l'édition et l'œuvre
     * qui n'ont plus d'exemplaire : sinon un code-barres resterait « connu » sans rien posséder.
     * Renvoie les fichiers d'image devenus orphelins, ou `null` si l'exemplaire n'existe pas.
     */
    remove: db.transaction((userId: number, id: number): RemovedFiles | null => {
      const row = db
        .prepare(
          `SELECT c.edition_id, c.photo_path, e.cover_path
           FROM copies c JOIN editions e ON e.id = c.edition_id
           WHERE c.id = ? AND c.user_id = ?`,
        )
        .get(id, userId) as
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
