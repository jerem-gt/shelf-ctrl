import fs from 'node:fs';
import path from 'node:path';

import Database, { type Database as DatabaseType } from 'better-sqlite3';

import { initSchema } from './schema.js';

export const DATA_DIR = process.env.DATA_DIR ?? path.join(import.meta.dirname, '../../data');

export function createDb(filePath?: string) {
  const isMemory = filePath === ':memory:';
  const dbPath = filePath ?? path.join(DATA_DIR, 'shelfctrl.db');

  if (!isMemory) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  return db;
}

export function initDatabase(db: DatabaseType) {
  initSchema(db);
}
