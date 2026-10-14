import type { Database } from 'better-sqlite3';

/**
 * Titre (works) → édition (editions) → exemplaire physique (copies).
 * Le statut d'un exemplaire n'est jamais stocké : il dérive des prêts et des ventes (vue copy_status).
 */
export function initSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS works
    (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        title         TEXT    NOT NULL,
        series        TEXT,
        volume_number INTEGER,
        creators      TEXT,
        year          INTEGER
    );

    CREATE TABLE IF NOT EXISTS editions
    (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        work_id      INTEGER NOT NULL REFERENCES works (id) ON DELETE CASCADE,
        format       TEXT    NOT NULL CHECK (format IN ('book', 'dvd', 'bluray', 'uhd4k')),
        barcode      TEXT    UNIQUE,
        publisher    TEXT,
        release_year INTEGER,
        language     TEXT,
        cover_path   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_editions_work ON editions (work_id);

    CREATE TABLE IF NOT EXISTS copies
    (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        edition_id     INTEGER NOT NULL REFERENCES editions (id) ON DELETE CASCADE,
        condition      TEXT    NOT NULL DEFAULT 'good'
                       CHECK (condition IN ('new', 'very_good', 'good', 'acceptable', 'poor')),
        condition_note TEXT,
        photo_path     TEXT,
        location       TEXT,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_copies_edition ON copies (edition_id);

    CREATE TABLE IF NOT EXISTS borrowers
    (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS loans
    (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        copy_id     INTEGER NOT NULL REFERENCES copies (id) ON DELETE CASCADE,
        borrower_id INTEGER NOT NULL REFERENCES borrowers (id),
        loaned_at   TEXT    NOT NULL DEFAULT (date('now')),
        returned_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_loans_copy ON loans (copy_id);
    -- Un exemplaire ne peut avoir qu'un seul prêt en cours.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_open ON loans (copy_id) WHERE returned_at IS NULL;

    CREATE TABLE IF NOT EXISTS sales
    (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        copy_id     INTEGER NOT NULL REFERENCES copies (id) ON DELETE CASCADE,
        platform    TEXT,
        price_cents INTEGER,
        listed_at   TEXT,
        sold_at     TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sales_copy ON sales (copy_id);
    -- Une seule ligne par exemplaire : la ligne seule vaut « en vente », avec sold_at « vendu » ; la supprimer retire l'annonce.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_copy_unique ON sales (copy_id);

    -- Compte unique, synchronisé avec ADMIN_USER / ADMIN_PASSWORD au démarrage.
    CREATE TABLE IF NOT EXISTS users
    (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Sessions express-session (voir session-store.ts).
    CREATE TABLE IF NOT EXISTS sessions
    (
        sid        TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        expires_at INTEGER NOT NULL
    );

    -- Échecs de connexion par adresse IP (limitation du brute-force).
    CREATE TABLE IF NOT EXISTS login_attempts
    (
        key      TEXT PRIMARY KEY,
        count    INTEGER NOT NULL,
        reset_at INTEGER NOT NULL
    );

    CREATE VIEW IF NOT EXISTS copy_status AS
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
