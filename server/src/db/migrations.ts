import {
  type Migration,
  runMigrations as runSharedMigrations,
} from '@jerem-gt/ctrl-shared/server/migrations';
import type { Database } from 'better-sqlite3';

/**
 * Évolutions du schéma après la création initiale (`schema.ts`, idempotente), appliquées dans
 * l'ordre : la version de la base (`PRAGMA user_version`) est le nombre de migrations passées.
 * Ne jamais modifier une migration déjà livrée : en ajouter une.
 */
const MIGRATIONS: readonly Migration[] = [
  // 1 — plateformes de vente du compte (réglages).
  `
  CREATE TABLE platforms
  (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      -- Adresse de dépôt d'annonce d'une plateforme personnalisée ; NULL pour une plateforme
      -- connue du client, dont l'adresse n'est pas figée en base.
      publish_url TEXT,
      is_default  INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1))
  );
  -- Au plus une plateforme par défaut.
  CREATE UNIQUE INDEX idx_platforms_default ON platforms (is_default) WHERE is_default = 1;
  `,
  // 2 — comptes en base (admin = rôle, e-mail, mot de passe oublié) et données par compte.
  migrateToAccounts,
];

/** Tables de données rattachées à un compte par la migration 2. */
const DATA_TABLES = [
  'works',
  'editions',
  'copies',
  'borrowers',
  'loans',
  'sales',
  'platforms',
] as const;

/**
 * Chaque table de données reçoit `user_id` (les lignes existantes vont au compte existant) et ses
 * unicités deviennent propres au compte. SQLite ne sait ni ajouter une colonne `REFERENCES … NOT
 * NULL` ni retirer un `UNIQUE` : les tables sont reconstruites (clés étrangères désactivées par
 * `runMigrations`, sans quoi supprimer `editions` effacerait les exemplaires en cascade).
 */
function migrateToAccounts(db: Database) {
  db.exec(`
    ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1));
    ALTER TABLE users ADD COLUMN email TEXT;
    -- Le compte unique, jusqu'ici piloté par ADMIN_USER / ADMIN_PASSWORD, devient admin.
    UPDATE users SET is_admin = 1;
    CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE email IS NOT NULL;

    -- Liens « mot de passe oublié » : seule l'empreinte SHA-256 du jeton est stockée.
    CREATE TABLE password_reset_tokens
    (
        token_hash TEXT PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
    );
  `);

  const owner = db.prepare('SELECT MIN(id) AS id FROM users').get() as { id: number | null };
  const hasData = DATA_TABLES.some((table) => db.prepare(`SELECT 1 FROM ${table}`).get());
  if (hasData && owner.id === null) {
    throw new Error('Migration 2 : la base contient des données mais aucun compte.');
  }
  const userId = owner.id ?? 0;

  const USER = 'user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE';
  const rebuild = (table: string, definition: string, columns: string) => {
    db.exec(`
      CREATE TABLE ${table}_new (${definition});
      INSERT INTO ${table}_new (${columns}, user_id) SELECT ${columns}, ${userId} FROM ${table};
      DROP TABLE ${table};
      ALTER TABLE ${table}_new RENAME TO ${table};
    `);
  };

  // La vue référence copies, loans et sales : recréée après la reconstruction.
  db.exec('DROP VIEW copy_status;');
  rebuild(
    'works',
    `id            INTEGER PRIMARY KEY AUTOINCREMENT,
     ${USER},
     title         TEXT    NOT NULL,
     series        TEXT,
     volume_number INTEGER,
     creators      TEXT,
     year          INTEGER`,
    'id, title, series, volume_number, creators, year',
  );
  rebuild(
    'editions',
    `id           INTEGER PRIMARY KEY AUTOINCREMENT,
     ${USER},
     work_id      INTEGER NOT NULL REFERENCES works (id) ON DELETE CASCADE,
     format       TEXT    NOT NULL CHECK (format IN ('book', 'dvd', 'bluray', 'uhd4k')),
     barcode      TEXT,
     publisher    TEXT,
     release_year INTEGER,
     language     TEXT,
     cover_path   TEXT`,
    'id, work_id, format, barcode, publisher, release_year, language, cover_path',
  );
  rebuild(
    'copies',
    `id             INTEGER PRIMARY KEY AUTOINCREMENT,
     ${USER},
     edition_id     INTEGER NOT NULL REFERENCES editions (id) ON DELETE CASCADE,
     condition      TEXT    NOT NULL DEFAULT 'good'
                    CHECK (condition IN ('new', 'very_good', 'good', 'acceptable', 'poor')),
     condition_note TEXT,
     photo_path     TEXT,
     location       TEXT,
     created_at     TEXT    NOT NULL DEFAULT (datetime('now'))`,
    'id, edition_id, condition, condition_note, photo_path, location, created_at',
  );
  rebuild(
    'borrowers',
    `id   INTEGER PRIMARY KEY AUTOINCREMENT,
     ${USER},
     name TEXT NOT NULL,
     UNIQUE (user_id, name)`,
    'id, name',
  );
  rebuild(
    'loans',
    `id          INTEGER PRIMARY KEY AUTOINCREMENT,
     ${USER},
     copy_id     INTEGER NOT NULL REFERENCES copies (id) ON DELETE CASCADE,
     borrower_id INTEGER NOT NULL REFERENCES borrowers (id),
     loaned_at   TEXT    NOT NULL DEFAULT (date('now')),
     returned_at TEXT`,
    'id, copy_id, borrower_id, loaned_at, returned_at',
  );
  rebuild(
    'sales',
    `id          INTEGER PRIMARY KEY AUTOINCREMENT,
     ${USER},
     copy_id     INTEGER NOT NULL REFERENCES copies (id) ON DELETE CASCADE,
     platform    TEXT,
     price_cents INTEGER,
     listed_at   TEXT,
     sold_at     TEXT`,
    'id, copy_id, platform, price_cents, listed_at, sold_at',
  );
  rebuild(
    'platforms',
    `id          INTEGER PRIMARY KEY AUTOINCREMENT,
     ${USER},
     name        TEXT    NOT NULL COLLATE NOCASE,
     publish_url TEXT,
     is_default  INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
     UNIQUE (user_id, name)`,
    'id, name, publish_url, is_default',
  );

  db.exec(`
    CREATE INDEX idx_works_user ON works (user_id);
    CREATE INDEX idx_editions_work ON editions (work_id);
    -- Un code-barres n'est connu qu'une fois par compte.
    CREATE UNIQUE INDEX idx_editions_barcode ON editions (user_id, barcode);
    CREATE INDEX idx_copies_edition ON copies (edition_id);
    CREATE INDEX idx_copies_user ON copies (user_id);
    -- Fichiers servis par /covers et /photos : leur propriétaire est vérifié à chaque requête.
    CREATE INDEX idx_editions_cover ON editions (cover_path);
    CREATE INDEX idx_copies_photo ON copies (photo_path);
    CREATE INDEX idx_loans_copy ON loans (copy_id);
    CREATE INDEX idx_loans_user ON loans (user_id);
    -- Un exemplaire ne peut avoir qu'un seul prêt en cours.
    CREATE UNIQUE INDEX idx_loans_open ON loans (copy_id) WHERE returned_at IS NULL;
    -- Une seule ligne par exemplaire : la ligne seule vaut « en vente », avec sold_at « vendu ».
    CREATE UNIQUE INDEX idx_sales_copy_unique ON sales (copy_id);
    CREATE INDEX idx_sales_user ON sales (user_id);
    -- Au plus une plateforme par défaut par compte.
    CREATE UNIQUE INDEX idx_platforms_default ON platforms (user_id) WHERE is_default = 1;

    CREATE VIEW copy_status AS
    SELECT c.id AS copy_id,
           CASE
               WHEN EXISTS (SELECT 1 FROM sales s WHERE s.copy_id = c.id AND s.sold_at IS NOT NULL) THEN 'sold'
               WHEN EXISTS (SELECT 1 FROM loans l WHERE l.copy_id = c.id AND l.returned_at IS NULL) THEN 'loaned'
               WHEN EXISTS (SELECT 1 FROM sales s WHERE s.copy_id = c.id AND s.listed_at IS NOT NULL) THEN 'listed'
               ELSE 'owned'
           END AS status
    FROM copies c;
  `);
}

/**
 * Une transaction par migration, clés étrangères coupées (les reconstructions de tables ne
 * déclenchent pas les cascades) puis contrôlées avant validation : runner de ctrl-shared.
 */
export function runMigrations(db: Database) {
  runSharedMigrations(db, MIGRATIONS);
}
