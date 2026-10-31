import type { AuthModuleOptions, AuthRuntimeOptions } from '@jerem-gt/ctrl-shared/server/auth';
import type { ShelfLang, UserStats } from '@shelfctrl/types';
import type { Database } from 'better-sqlite3';

import { HttpError } from '../../lib/errors.js';
import { MAIL_TEXTS } from '../../lib/mailTexts.js';
import type { AccountImages } from '../images/index.js';

/** Nom propre à l'appli : cookies et noms d'hôte sont partagés avec cash-ctrl sur le NAS. */
export const SESSION_COOKIE = 'shelfctrl.sid';

/** Langues de l'interface : français seul pour l'instant (une langue ajoutée l'est aussi au client). */
export const LANGUAGES = ['fr'] as const satisfies readonly ShelfLang[];

export interface ShelfAuthOptions extends AuthRuntimeOptions {
  /** Efface les fichiers d'image d'un compte supprimé (absent : pas de stockage d'images). */
  removeAccountImages?: (files: AccountImages) => Promise<void>;
}

/** Options du module d'auth de ctrl-shared propres à ShelfCtrl. */
export function shelfAuthOptions(
  db: Database,
  options: ShelfAuthOptions,
): AuthModuleOptions<ShelfLang, UserStats> {
  const { removeAccountImages, ...auth } = options;
  const statsStmt = db.prepare<[number], { copy_count: number; last_copy_at: string | null }>(
    'SELECT COUNT(*) AS copy_count, MAX(created_at) AS last_copy_at FROM copies WHERE user_id = ?',
  );
  const coversStmt = db.prepare<[number], { name: string }>(
    'SELECT cover_path AS name FROM editions WHERE user_id = ? AND cover_path IS NOT NULL',
  );
  const photosStmt = db.prepare<[number], { name: string }>(
    'SELECT photo_path AS name FROM copies WHERE user_id = ? AND photo_path IS NOT NULL',
  );

  return {
    appName: 'ShelfCtrl',
    HttpError,
    sessionCookie: SESSION_COOKIE,
    deviceCookie: 'shelfctrl_device',
    languages: LANGUAGES,
    mailTexts: MAIL_TEXTS,
    userStats: (userId) => {
      const row = statsStmt.get(userId);
      return { copyCount: row?.copy_count ?? 0, lastCopyAt: row?.last_copy_at ?? null };
    },
    // Les fichiers d'image sont relevés avant la suppression (cascade), effacés après.
    onUserDeleted: (userId) => {
      if (!removeAccountImages) {
        return undefined;
      }
      const files: AccountImages = {
        covers: coversStmt.all(userId).map((row) => row.name),
        photos: photosStmt.all(userId).map((row) => row.name),
      };
      return () => removeAccountImages(files);
    },
    ...auth,
  };
}
