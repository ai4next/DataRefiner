import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database;

export function initDb(): Database.Database {
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'datarefiner.db');
  logger.info({ dbPath }, 'Initializing SQLite database');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations();
  return db;
}

function runMigrations(): void {
  const schemaDir = path.join(__dirname, 'schema');
  const files = fs.readdirSync(schemaDir).sort();
  for (const file of files) {
    if (file.endsWith('.sql')) {
      const sql = fs.readFileSync(path.join(schemaDir, file), 'utf-8');
      db.exec(sql);
      logger.info({ file }, 'Applied schema migration');
    }
  }
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}