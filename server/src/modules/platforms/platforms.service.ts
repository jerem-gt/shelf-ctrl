import type { PlatformItem } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';

import type { CreatePlatformInput, UpdatePlatformInput } from './platforms.schema.js';

export type PlatformFailure = 'not_found' | 'duplicate';
export type PlatformResult =
  { ok: true; platform: PlatformItem } | { ok: false; reason: PlatformFailure };

interface PlatformRow {
  id: number;
  name: string;
  publish_url: string | null;
  is_default: number;
}

const COLUMNS = 'id, name, publish_url, is_default';

function toItem(row: PlatformRow): PlatformItem {
  return {
    id: row.id,
    name: row.name,
    publishUrl: row.publish_url,
    isDefault: row.is_default === 1,
  };
}

/**
 * Plateformes sur lesquelles le compte vend. Les ventes gardent le nom en clair : retirer une
 * plateforme ne touche pas à l'historique.
 */
export function createPlatformsService(db: Database) {
  const findById = (userId: number, id: number): PlatformItem | undefined => {
    const row = db
      .prepare(`SELECT ${COLUMNS} FROM platforms WHERE id = ? AND user_id = ?`)
      .get(id, userId) as PlatformRow | undefined;
    return row ? toItem(row) : undefined;
  };

  return {
    list(userId: number): PlatformItem[] {
      const rows = db
        .prepare(`SELECT ${COLUMNS} FROM platforms WHERE user_id = ? ORDER BY name COLLATE NOCASE`)
        .all(userId) as PlatformRow[];
      return rows.map(toItem);
    },

    /** La première plateforme ajoutée devient la plateforme par défaut. */
    create: db.transaction((userId: number, input: CreatePlatformInput): PlatformResult => {
      const exists = db
        .prepare('SELECT 1 FROM platforms WHERE user_id = ? AND name = ?')
        .get(userId, input.name);
      if (exists) {
        return { ok: false, reason: 'duplicate' };
      }
      const hasDefault = db
        .prepare('SELECT 1 FROM platforms WHERE user_id = ? AND is_default = 1')
        .get(userId);
      const result = db
        .prepare(
          'INSERT INTO platforms (user_id, name, publish_url, is_default) VALUES (?, ?, ?, ?)',
        )
        .run(userId, input.name, input.publishUrl ?? null, hasDefault ? 0 : 1);
      return {
        ok: true,
        platform: findById(userId, Number(result.lastInsertRowid)) as PlatformItem,
      };
    }),

    update(userId: number, id: number, input: UpdatePlatformInput): PlatformResult {
      const changed = db
        .prepare('UPDATE platforms SET publish_url = ? WHERE id = ? AND user_id = ?')
        .run(input.publishUrl, id, userId);
      const platform = changed.changes > 0 ? findById(userId, id) : undefined;
      return platform ? { ok: true, platform } : { ok: false, reason: 'not_found' };
    },

    /** Retirer la plateforme par défaut ne désigne pas de remplaçante. */
    remove(userId: number, id: number): boolean {
      return (
        db.prepare('DELETE FROM platforms WHERE id = ? AND user_id = ?').run(id, userId).changes > 0
      );
    },

    /** `null` : plus de plateforme par défaut. `false` : plateforme inconnue. */
    setDefault: db.transaction((userId: number, id: number | null): boolean => {
      if (id !== null && !findById(userId, id)) {
        return false;
      }
      db.prepare('UPDATE platforms SET is_default = 0 WHERE user_id = ? AND is_default = 1').run(
        userId,
      );
      if (id !== null) {
        db.prepare('UPDATE platforms SET is_default = 1 WHERE id = ?').run(id);
      }
      return true;
    }),
  };
}
