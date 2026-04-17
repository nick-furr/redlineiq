/**
 * SQLite database connection and schema setup.
 *
 * Imported once at startup; subsequent imports get the cached module.
 * better-sqlite3 is synchronous — no async needed here.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';

const DB_PATH = config.database.path;

// Create the directory if it doesn't exist (e.g. ./data/ on first run)
fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true });

const db = new Database(DB_PATH);

// WAL mode gives much better write throughput without sacrificing safety
db.pragma('journal_mode = WAL');
// Enforce foreign key constraints (OFF by default in SQLite)
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    pdf_filename TEXT NOT NULL,
    pdf_path     TEXT NOT NULL,
    total_pages  INTEGER NOT NULL,
    pages_processed INTEGER NOT NULL DEFAULT 0,
    summary      TEXT NOT NULL DEFAULT '{}',
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS checklist_items (
    id                     TEXT NOT NULL,
    project_id             TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    markup                 TEXT NOT NULL,
    status                 TEXT NOT NULL DEFAULT 'pending',
    drafter_notes          TEXT,
    clarification_request  TEXT,
    clarification_response TEXT,
    created_at             TEXT NOT NULL,
    updated_at             TEXT NOT NULL,
    PRIMARY KEY (id, project_id)
  );
`);

export default db;
