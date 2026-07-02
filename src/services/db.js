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

  -- Full-text index over extracted markups, powering POST /projects/:id/ask
  -- (ADR 0004). Fed by triggers rather than application code so the index can
  -- never drift from checklist_items regardless of which service writes items.
  -- No update trigger: the markup JSON is immutable after insert — status
  -- updates touch other columns.
  CREATE VIRTUAL TABLE IF NOT EXISTS markup_fts USING fts5(
    markup_text,
    location,
    markup_type,
    drawing_reference,
    item_id UNINDEXED,
    project_id UNINDEXED,
    page_number UNINDEXED
  );

  CREATE TRIGGER IF NOT EXISTS checklist_items_fts_insert
  AFTER INSERT ON checklist_items BEGIN
    INSERT INTO markup_fts (markup_text, location, markup_type, drawing_reference, item_id, project_id, page_number)
    VALUES (
      json_extract(new.markup, '$.markup_text'),
      json_extract(new.markup, '$.location_on_drawing'),
      json_extract(new.markup, '$.markup_type'),
      json_extract(new.markup, '$.drawing_reference'),
      new.id,
      new.project_id,
      json_extract(new.markup, '$.page_number')
    );
  END;

  CREATE TRIGGER IF NOT EXISTS checklist_items_fts_delete
  AFTER DELETE ON checklist_items BEGIN
    DELETE FROM markup_fts WHERE item_id = old.id AND project_id = old.project_id;
  END;
`);

// Backfill the FTS index for databases created before it existed (the triggers
// only cover writes made after this schema shipped). Runs once: a non-empty
// index means the backfill or the triggers already populated it.
const ftsRowCount = db.prepare('SELECT COUNT(*) AS c FROM markup_fts').get().c;
if (ftsRowCount === 0) {
  db.exec(`
    INSERT INTO markup_fts (markup_text, location, markup_type, drawing_reference, item_id, project_id, page_number)
    SELECT
      json_extract(markup, '$.markup_text'),
      json_extract(markup, '$.location_on_drawing'),
      json_extract(markup, '$.markup_type'),
      json_extract(markup, '$.drawing_reference'),
      id,
      project_id,
      json_extract(markup, '$.page_number')
    FROM checklist_items;
  `);
}

export default db;
