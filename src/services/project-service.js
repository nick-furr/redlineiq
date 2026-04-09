/**
 * Project Service
 * 
 * Manages project lifecycle: creation, checklist state, 
 * status updates, and progress tracking.
 * 
 * For v1, uses in-memory + JSON file storage.
 * Swap to a real DB (SQLite/Postgres) when needed.
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createChecklistItem, computeSummary, STATUS } from '../models/markup.js';
import { config } from '../config/index.js';

// In-memory store — persisted to disk as JSON
let projects = new Map();
const DATA_FILE = path.join(config.upload.outputDir, 'projects.json');

/**
 * Initialize the project store — load from disk if exists
 */
export async function initProjectStore() {
  try {
    await fs.mkdir(config.upload.outputDir, { recursive: true });
    await fs.mkdir(config.upload.uploadDir, { recursive: true });
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    projects = new Map(parsed.map(p => [p.id, p]));
    console.log(`Loaded ${projects.size} projects from disk`);
  } catch {
    // No existing data, start fresh
    projects = new Map();
  }
}

/**
 * Save all projects to disk
 */
async function persist() {
  const data = JSON.stringify([...projects.values()], null, 2);
  await fs.writeFile(DATA_FILE, data, 'utf-8');
}

/**
 * Create a new project from an uploaded PDF
 */
export async function createProject(name, pdfFilename, pdfPath, totalPages) {
  const project = {
    id: uuidv4(),
    name,
    pdf_filename: pdfFilename,
    pdf_path: pdfPath,
    total_pages: totalPages,
    pages_processed: 0,
    checklist: [],
    summary: computeSummary([]),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  projects.set(project.id, project);
  await persist();
  return project;
}

/**
 * Add extraction results to a project's checklist
 */
export async function addExtractionResults(projectId, extractionResult) {
  const project = projects.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  // Convert extracted markups to checklist items, attaching page_number from the page context
  const newItems = []
  for (const page of extractionResult.pages) {
    for (const markup of page.markups) {
      newItems.push(createChecklistItem({ ...markup, page_number: page.page_number }))
    }
  };
  project.checklist.push(...newItems);

  // Update progress
  project.pages_processed = extractionResult.stats.pagesProcessed;
  project.summary = computeSummary(project.checklist);
  project.updated_at = new Date().toISOString();

  await persist();
  return project;
}

/**
 * Update a checklist item's status
 */
export async function updateItemStatus(projectId, itemId, status, notes = null) {
  const project = projects.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const item = project.checklist.find(i => i.id === itemId);
  if (!item) throw new Error(`Item not found: ${itemId}`);

  if (!Object.values(STATUS).includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  item.status = status;
  if (notes !== null) item.drafter_notes = notes;
  item.updated_at = new Date().toISOString();

  project.summary = computeSummary(project.checklist);
  project.updated_at = new Date().toISOString();

  await persist();
  return item;
}

/**
 * Flag an item for clarification
 */
export async function flagForClarification(projectId, itemId, message) {
  const project = projects.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const item = project.checklist.find(i => i.id === itemId);
  if (!item) throw new Error(`Item not found: ${itemId}`);

  item.status = STATUS.FLAGGED;
  item.clarification_request = message;
  item.updated_at = new Date().toISOString();

  project.summary = computeSummary(project.checklist);
  project.updated_at = new Date().toISOString();

  await persist();
  return item;
}

/**
 * Get a project by ID
 */
export function getProject(projectId) {
  return projects.get(projectId) || null;
}

/**
 * Get all projects (for the project list view)
 */
export function listProjects() {
  return [...projects.values()]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

/**
 * Delete a project
 */
export async function deleteProject(projectId) {
  const deleted = projects.delete(projectId);
  if (deleted) await persist();
  return deleted;
}
