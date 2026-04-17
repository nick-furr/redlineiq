/**
 * Project Service
 *
 * Manages project lifecycle: creation, checklist state,
 * status updates, and progress tracking.
 *
 * Persistence: SQLite via better-sqlite3 (synchronous).
 * All public methods keep their original async signatures so routes
 * don't need to change.
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createChecklistItem, computeSummary, STATUS } from '../models/markup.js';
import { config } from '../config/index.js';
import db from './db.js';

// Path to the old JSON file — used for one-time migration on first startup
const LEGACY_JSON_FILE = path.join(config.upload.outputDir, 'projects.json');

// ─── Prepared Statements ───────────────────────────────────────

const stmts = {
  insertProject: db.prepare(`
    INSERT INTO projects (id, name, pdf_filename, pdf_path, total_pages, pages_processed, summary, created_at, updated_at)
    VALUES (@id, @name, @pdf_filename, @pdf_path, @total_pages, @pages_processed, @summary, @created_at, @updated_at)
  `),
  getProject: db.prepare('SELECT * FROM projects WHERE id = ?'),
  listProjects: db.prepare('SELECT * FROM projects ORDER BY updated_at DESC'),
  deleteProject: db.prepare('DELETE FROM projects WHERE id = ?'),
  updateProjectStats: db.prepare(`
    UPDATE projects SET pages_processed = @pages_processed, summary = @summary, updated_at = @updated_at WHERE id = @id
  `),
  updateProjectSummary: db.prepare('UPDATE projects SET summary = ?, updated_at = ? WHERE id = ?'),
  insertItem: db.prepare(`
    INSERT INTO checklist_items (id, project_id, markup, status, drafter_notes, clarification_request, clarification_response, created_at, updated_at)
    VALUES (@id, @project_id, @markup, @status, @drafter_notes, @clarification_request, @clarification_response, @created_at, @updated_at)
  `),
  getItems: db.prepare('SELECT * FROM checklist_items WHERE project_id = ? ORDER BY rowid'),
  getItem: db.prepare('SELECT * FROM checklist_items WHERE id = ? AND project_id = ?'),
  updateItemStatus: db.prepare(`
    UPDATE checklist_items SET status = ?, drafter_notes = ?, updated_at = ? WHERE id = ? AND project_id = ?
  `),
  updateItemFlag: db.prepare(`
    UPDATE checklist_items SET status = ?, clarification_request = ?, updated_at = ? WHERE id = ? AND project_id = ?
  `),
};

// ─── Row Deserializers ─────────────────────────────────────────

function rowToItem(row) {
  return {
    id: row.id,
    markup: JSON.parse(row.markup),
    status: row.status,
    drafter_notes: row.drafter_notes,
    clarification_request: row.clarification_request,
    clarification_response: row.clarification_response,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToProject(row, itemRows = []) {
  return {
    id: row.id,
    name: row.name,
    pdf_filename: row.pdf_filename,
    pdf_path: row.pdf_path,
    total_pages: row.total_pages,
    pages_processed: row.pages_processed,
    checklist: itemRows.map(rowToItem),
    summary: JSON.parse(row.summary),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─── JSON Migration ────────────────────────────────────────────

async function maybeMigrateFromJson() {
  // Only migrate if the SQLite DB is empty — avoids re-running on every restart
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM projects').get();
  if (c > 0) return;

  try {
    const raw = await fs.readFile(LEGACY_JSON_FILE, 'utf-8');
    const projects = JSON.parse(raw);

    const migrate = db.transaction((projects) => {
      for (const project of projects) {
        const { checklist = [], summary, ...rest } = project;
        stmts.insertProject.run({
          ...rest,
          summary: JSON.stringify(summary ?? computeSummary(checklist)),
        });

        for (const item of checklist) {
          const { markup, ...itemRest } = item;
          stmts.insertItem.run({
            ...itemRest,
            project_id: project.id,
            markup: JSON.stringify(markup),
            drafter_notes: itemRest.drafter_notes ?? null,
            clarification_request: itemRest.clarification_request ?? null,
            clarification_response: itemRest.clarification_response ?? null,
          });
        }
      }
    });

    migrate(projects);

    // Rename the old file so it won't be re-imported on the next restart
    await fs.rename(LEGACY_JSON_FILE, `${LEGACY_JSON_FILE}.bak`);
    console.log(`Migrated ${projects.length} projects from JSON to SQLite`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // A real error during migration — log but don't crash the server
      console.error('JSON migration error (non-fatal):', err.message);
    }
    // ENOENT just means no legacy file exists, which is normal on a fresh install
  }
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Initialize the project store — run once at server startup.
 */
export async function initProjectStore() {
  await fs.mkdir(config.upload.uploadDir, { recursive: true });
  await maybeMigrateFromJson();
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM projects').get();
  console.log(`Project store ready (${c} projects in SQLite)`);
}

/**
 * Create a new project from an uploaded PDF.
 */
export async function createProject(name, pdfFilename, pdfPath, totalPages) {
  const now = new Date().toISOString();
  const id = uuidv4();
  const summary = computeSummary([]);

  stmts.insertProject.run({
    id,
    name,
    pdf_filename: pdfFilename,
    pdf_path: pdfPath,
    total_pages: totalPages,
    pages_processed: 0,
    summary: JSON.stringify(summary),
    created_at: now,
    updated_at: now,
  });

  return { id, name, pdf_filename: pdfFilename, pdf_path: pdfPath, total_pages: totalPages, pages_processed: 0, checklist: [], summary, created_at: now, updated_at: now };
}

/**
 * Add extraction results to a project's checklist.
 */
export async function addExtractionResults(projectId, extractionResult) {
  const now = new Date().toISOString();

  // Build checklist items from every markup on every page
  const newItems = [];
  for (const page of extractionResult.pages) {
    for (const markup of page.markups) {
      newItems.push(createChecklistItem({ ...markup, page_number: page.page_number }));
    }
  }

  const insertAll = db.transaction((items) => {
    for (const item of items) {
      stmts.insertItem.run({
        id: item.id,
        project_id: projectId,
        markup: JSON.stringify(item.markup),
        status: item.status,
        drafter_notes: item.drafter_notes ?? null,
        clarification_request: item.clarification_request ?? null,
        clarification_response: item.clarification_response ?? null,
        created_at: item.created_at,
        updated_at: item.updated_at,
      });
    }
  });

  insertAll(newItems);

  const allItems = stmts.getItems.all(projectId).map(rowToItem);
  const summary = computeSummary(allItems);

  stmts.updateProjectStats.run({
    id: projectId,
    pages_processed: extractionResult.stats.pagesProcessed,
    summary: JSON.stringify(summary),
    updated_at: now,
  });

  return getProject(projectId);
}

/**
 * Update a checklist item's status.
 */
export async function updateItemStatus(projectId, itemId, status, notes = null) {
  const projectRow = stmts.getProject.get(projectId);
  if (!projectRow) throw new Error(`Project not found: ${projectId}`);

  const itemRow = stmts.getItem.get(itemId, projectId);
  if (!itemRow) throw new Error(`Item not found: ${itemId}`);

  if (!Object.values(STATUS).includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const now = new Date().toISOString();
  // notes === null means "leave existing notes unchanged"
  const newNotes = notes !== null ? notes : itemRow.drafter_notes;
  stmts.updateItemStatus.run(status, newNotes, now, itemId, projectId);

  const allItems = stmts.getItems.all(projectId).map(rowToItem);
  stmts.updateProjectSummary.run(JSON.stringify(computeSummary(allItems)), now, projectId);

  return rowToItem(stmts.getItem.get(itemId, projectId));
}

/**
 * Flag an item for clarification.
 */
export async function flagForClarification(projectId, itemId, message) {
  const projectRow = stmts.getProject.get(projectId);
  if (!projectRow) throw new Error(`Project not found: ${projectId}`);

  const itemRow = stmts.getItem.get(itemId, projectId);
  if (!itemRow) throw new Error(`Item not found: ${itemId}`);

  const now = new Date().toISOString();
  stmts.updateItemFlag.run(STATUS.FLAGGED, message, now, itemId, projectId);

  const allItems = stmts.getItems.all(projectId).map(rowToItem);
  stmts.updateProjectSummary.run(JSON.stringify(computeSummary(allItems)), now, projectId);

  return rowToItem(stmts.getItem.get(itemId, projectId));
}

/**
 * Get a project by ID (includes full checklist).
 */
export function getProject(projectId) {
  const row = stmts.getProject.get(projectId);
  if (!row) return null;
  return rowToProject(row, stmts.getItems.all(projectId));
}

/**
 * Get all projects sorted by most recently updated (includes full checklist).
 */
export function listProjects() {
  return stmts.listProjects.all().map(row => rowToProject(row, stmts.getItems.all(row.id)));
}

/**
 * Delete a project and all its checklist items (cascade handled by SQLite FK).
 */
export async function deleteProject(projectId) {
  const info = stmts.deleteProject.run(projectId);
  return info.changes > 0;
}
