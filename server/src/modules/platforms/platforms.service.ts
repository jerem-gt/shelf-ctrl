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
  const findById = (id: number): PlatformItem | undefined => {
    const row = db.prepare(`SELECT ${COLUMNS} FROM platforms WHERE id = ?`).get(id) as
      PlatformRow | undefined;
    return row ? toItem(row) : undefined;
  };

  return {
    list(): PlatformItem[] {
      const rows = db
        .prepare(`SELECT ${COLUMNS} FROM platforms ORDER BY name COLLATE NOCASE`)
        .all() as PlatformRow[];
      return rows.map(toItem);
    },

    /** La première plateforme ajoutée devient la plateforme par défaut. */
    create: db.transaction((input: CreatePlatformInput): PlatformResult => {
      const exists = db.prepare('SELECT 1 FROM platforms WHERE name = ?').get(input.name);
      if (exists) {
        return { ok: false, reason: 'duplicate' };
      }
      const hasDefault = db.prepare('SELECT 1 FROM platforms WHERE is_default = 1').get();
      const result = db
        .prepare('INSERT INTO platforms (name, publish_url, is_default) VALUES (?, ?, ?)')
        .run(input.name, input.publishUrl ?? null, hasDefault ? 0 : 1);
      return { ok: true, platform: findById(Number(result.lastInsertRowid)) as PlatformItem };
    }),

    update(id: number, input: UpdatePlatformInput): PlatformResult {
      const changed = db
        .prepare('UPDATE platforms SET publish_url = ? WHERE id = ?')
        .run(input.publishUrl, id);
      const platform = changed.changes > 0 ? findById(id) : undefined;
      return platform ? { ok: true, platform } : { ok: false, reason: 'not_found' };
    },

    /** Retirer la plateforme par défaut ne désigne pas de remplaçante. */
    remove(id: number): boolean {
      return db.prepare('DELETE FROM platforms WHERE id = ?').run(id).changes > 0;
    },

    /** `null` : plus de plateforme par défaut. `false` : plateforme inconnue. */
    setDefault: db.transaction((id: number | null): boolean => {
      if (id !== null && !findById(id)) {
        return false;
      }
      db.prepare('UPDATE platforms SET is_default = 0 WHERE is_default = 1').run();
      if (id !== null) {
        db.prepare('UPDATE platforms SET is_default = 1 WHERE id = ?').run(id);
      }
      return true;
    }),
  };
}
