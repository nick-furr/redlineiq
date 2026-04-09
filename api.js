/**
 * API Routes
 * 
 * POST /api/projects              — Create project + upload PDF
 * GET  /api/projects               — List all projects
 * GET  /api/projects/:id           — Get project with checklist
 * POST /api/projects/:id/extract   — Run extraction on uploaded PDF
 * PATCH /api/projects/:id/items/:itemId — Update checklist item status
 * POST /api/projects/:id/items/:itemId/flag — Flag item for clarification
 * GET  /api/projects/:id/summary   — Get progress summary
 * DELETE /api/projects/:id         — Delete project
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { config } from '../config/index.js';
import { pdfToImages, getPdfPageCount } from '../utils/pdf-converter.js';
import { extractAllPages } from '../services/extraction-service.js';
import {
  createProject,
  addExtractionResults,
  updateItemStatus,
  flagForClarification,
  getProject,
  listProjects,
  deleteProject,
} from '../services/project-service.js';

const router = Router();

// ─── File Upload Config ────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.upload.uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSizeMB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are accepted'));
    }
    cb(null, true);
  },
});

// ─── Routes ────────────────────────────────────────────────────

/**
 * POST /api/projects
 * Upload a PDF and create a new project
 */
router.post('/projects', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const projectName = req.body.name || req.file.originalname.replace('.pdf', '');
    const pdfPath = path.resolve(req.file.path);

    // Get page count
    const totalPages = await getPdfPageCount(pdfPath);

    if (totalPages > config.upload.maxPages) {
      return res.status(400).json({
        error: `PDF has ${totalPages} pages. Maximum is ${config.upload.maxPages}.`,
      });
    }

    const project = await createProject(projectName, req.file.originalname, pdfPath, totalPages);

    res.status(201).json({
      project,
      message: `Project created with ${totalPages} pages. POST to /api/projects/${project.id}/extract to run extraction.`,
    });
  } catch (err) {
    console.error('Project creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/projects
 * List all projects
 */
router.get('/projects', (req, res) => {
  const projects = listProjects();
  res.json({ projects });
});

/**
 * GET /api/projects/:id
 * Get a single project with full checklist
 */
router.get('/projects/:id', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({ project });
});

/**
 * POST /api/projects/:id/extract
 * Run AI extraction on the project's PDF
 * 
 * Query params:
 *   pages — comma-separated page numbers to extract (e.g., "1,3,5")
 *            Defaults to all pages.
 */
router.post('/projects/:id/extract', async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  try {
    // Determine which pages to process
    let pagesToProcess;
    if (req.query.pages) {
      pagesToProcess = req.query.pages.split(',').map(Number).filter(n => !isNaN(n));
    }

    console.log(`Starting extraction for "${project.name}" (${project.total_pages} pages)`);

    // Step 1: Convert PDF pages to images
    const pageImages = await pdfToImages(project.pdf_path, {
      pages: pagesToProcess,
    });

    console.log(`Converted ${pageImages.length} pages to images`);

    // Step 2: Send each page to Claude for extraction
    const extractionResult = await extractAllPages(
      pageImages,
      { projectName: project.name },
      (pageNum, total, result) => {
        const status = result.error ? '✗' : '✓';
        const count = result.markups ? result.markups.length : 0;
        console.log(`  ${status} Page ${pageNum}/${total}: ${count} markups found`);
      }
    );

    // Step 3: Add results to the project
    const updatedProject = await addExtractionResults(project.id, extractionResult);

    res.json({
      project: updatedProject,
      extraction: {
        stats: extractionResult.stats,
        message: `Extracted ${extractionResult.totalMarkups} markups from ${extractionResult.stats.pagesProcessed} pages`,
      },
    });
  } catch (err) {
    console.error('Extraction error:', err);
    res.status(500).json({ error: `Extraction failed: ${err.message}` });
  }
});

/**
 * PATCH /api/projects/:id/items/:itemId
 * Update a checklist item's status
 * 
 * Body: { status: "done"|"pending"|"in_progress"|"skipped", notes: "optional" }
 */
router.patch('/projects/:id/items/:itemId', async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const item = await updateItemStatus(req.params.id, req.params.itemId, status, notes);
    const project = getProject(req.params.id);

    res.json({ item, summary: project.summary });
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

/**
 * POST /api/projects/:id/items/:itemId/flag
 * Flag an item for clarification
 * 
 * Body: { message: "Question for the engineer" }
 */
router.post('/projects/:id/items/:itemId/flag', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Clarification message is required' });

    const item = await flagForClarification(req.params.id, req.params.itemId, message);
    res.json({ item });
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

/**
 * GET /api/projects/:id/summary
 * Get progress summary for a project
 */
router.get('/projects/:id/summary', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  res.json({
    project_name: project.name,
    summary: project.summary,
    total_pages: project.total_pages,
    pages_processed: project.pages_processed,
  });
});

/**
 * DELETE /api/projects/:id
 */
router.delete('/projects/:id', async (req, res) => {
  const deleted = await deleteProject(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Project not found' });
  res.json({ message: 'Project deleted' });
});

export default router;
