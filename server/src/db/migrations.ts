import type { Database } from 'better-sqlite3';

/**
 * Évolutions du schéma après la création initiale (`schema.ts`, idempotente), appliquées dans
 * l'ordre : la version de la base (`PRAGMA user_version`) est le nombre de migrations passées.
 * Ne jamais modifier une migration déjà livrée : en ajouter une.
 */
const MIGRATIONS: readonly string[] = [
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
];

export function runMigrations(db: Database) {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[version]);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}
