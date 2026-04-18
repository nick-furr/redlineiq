/**
 * API Routes
 *
 * POST /api/projects              — Create project + upload PDF
 * GET  /api/projects               — List all projects
 * GET  /api/projects/:id           — Get project with checklist
 * POST /api/projects/:id/extract   — Kick off async extraction job
 * GET  /api/jobs/:jobId/status     — SSE stream for job progress
 * GET  /api/jobs/:jobId            — Poll job status (non-SSE fallback)
 * PATCH /api/projects/:id/items/:itemId — Update checklist item status
 * POST /api/projects/:id/items/:itemId/flag — Flag item for clarification
 * GET  /api/projects/:id/summary   — Get progress summary
 * DELETE /api/projects/:id         — Delete project
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { createReadStream, readFileSync } from 'fs';
import { stat } from 'fs/promises';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { getPdfPageCount } from '../utils/pdf-converter.js';
import {
  createProject,
  updateItemStatus,
  flagForClarification,
  getProject,
  listProjects,
  deleteProject,
} from '../services/project-service.js';
import { createJob, getJob } from '../services/job-service.js';
import { SAMPLE_ID, isSampleProject, rejectSampleWrite } from '../constants/sample.js';

// ─── Sample Project ────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_JSON_PATH = path.join(__dirname, '../../samples/demo-extraction.json');
const SAMPLE_PDF_PATH = path.join(__dirname, '../../samples/demo-plan.pdf');

let sampleProject = null;
try {
  sampleProject = JSON.parse(readFileSync(SAMPLE_JSON_PATH, 'utf-8'));
  console.log('Sample project loaded from demo-extraction.json');
} catch {
  console.log('No sample project found (samples/demo-extraction.json missing — run scripts/generate-sample.js to create it)');
}

const router = Router();

// ─── Extraction Rate Limiter ───────────────────────────────────
// Extraction is the expensive operation — each page calls the Claude API.
// 3 per hour per IP keeps accidental or malicious usage from running up the bill.
const extractionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Extraction limit reached (3 per hour). Please try again later.',
    });
  },
});

// ─── Demo Key Gate ─────────────────────────────────────────────
// Controlled by DEMO_MODE env var. When enabled, POST /extract requires
// the X-Demo-Key header to match DEMO_KEY. GET routes stay public.
function requireDemoKey(req, res, next) {
  if (!config.demo.enabled) return next();

  const key = req.headers['x-demo-key'];
  if (!key || key !== config.demo.key) {
    return res.status(401).json({
      error: 'Live extraction requires a demo key. Contact the maintainer or view the pre-extracted sample projects.',
    });
  }
  next();
}

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
 * GET /api/samples/demo
 * Returns the pre-extracted sample project for demo/portfolio use.
 */
router.get('/samples/demo', (req, res) => {
  if (!sampleProject) {
    return res.status(404).json({ error: 'Sample not available. Run scripts/generate-sample.js first.' });
  }
  res.json({ project: sampleProject });
});

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

    const totalPages = await getPdfPageCount(pdfPath);

    if (totalPages > config.upload.maxPages) {
      return res.status(400).json({
        error: `PDF has ${totalPages} pages. Maximum allowed is ${config.upload.maxPages}.`,
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
 * List all projects — sample project is always prepended if available
 */
router.get('/projects', (req, res) => {
  const projects = listProjects();
  const all = sampleProject ? [sampleProject, ...projects] : projects;
  res.json({ projects: all });
});

/**
 * GET /api/projects/:id
 * Get a single project with full checklist
 */
router.get('/projects/:id', (req, res) => {
  if (isSampleProject(req.params.id)) {
    if (!sampleProject) return res.status(404).json({ error: 'Sample not available' });
    return res.json({ project: sampleProject });
  }
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({ project });
});

/**
 * POST /api/projects/:id/extract
 * Kick off an async extraction job. Returns a jobId immediately.
 * Client should connect to GET /api/jobs/:jobId/status for SSE updates.
 *
 * Protected by:
 *   - requireDemoKey  (when DEMO_MODE=true)
 *   - extractionLimiter  (3 per hour per IP)
 *   - page count guard  (blocks before any Claude API calls)
 */
router.post('/projects/:id/extract', rejectSampleWrite, requireDemoKey, extractionLimiter, async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Belt-and-suspenders page check right before the expensive AI step
  if (project.total_pages > config.upload.maxPages) {
    return res.status(400).json({
      error: `This PDF has ${project.total_pages} pages. Extraction is limited to ${config.upload.maxPages} pages to control API costs.`,
    });
  }

  try {
    const { jobId } = createJob(project.id);

    console.log(`Extraction job ${jobId} created for "${project.name}"`);

    res.status(202).json({
      jobId,
      message: `Extraction started. Stream progress at GET /api/jobs/${jobId}/status`,
      project: {
        id: project.id,
        name: project.name,
        total_pages: project.total_pages,
      },
    });
  } catch (err) {
    console.error('Job creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/jobs/:jobId/status
 * SSE endpoint — streams extraction progress events to the client.
 *
 * Events:
 *   job_started        — extraction has begun
 *   conversion_complete — PDF pages converted to images
 *   page_complete      — one page extracted (includes markup count)
 *   job_complete       — all pages done, results saved
 *   job_failed         — something went wrong
 */
router.get('/jobs/:jobId/status', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  if (job.status === 'complete') {
    return res.json({ jobId: job.id, status: job.status, result: job.result });
  }
  if (job.status === 'failed') {
    return res.json({ jobId: job.id, status: job.status, error: job.error });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering if behind a proxy
  });

  sendSSE(res, 'connected', { jobId: job.id, status: job.status, progress: job.progress });

  const { emitter } = job;
  const events = ['job_started', 'conversion_complete', 'page_complete', 'job_complete', 'job_failed'];
  const listeners = {};

  for (const eventName of events) {
    const listener = (data) => {
      sendSSE(res, eventName, data);
      if (eventName === 'job_complete' || eventName === 'job_failed') {
        cleanup();
        res.end();
      }
    };
    listeners[eventName] = listener;
    emitter.on(eventName, listener);
  }

  const cleanup = () => {
    for (const [eventName, listener] of Object.entries(listeners)) {
      emitter.removeListener(eventName, listener);
    }
  };

  req.on('close', cleanup);
});

/**
 * GET /api/jobs/:jobId
 * Non-SSE fallback — poll for job status
 */
router.get('/jobs/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    result: job.result,
    error: job.error,
  });
});

/**
 * PATCH /api/projects/:id/items/:itemId
 * Update a checklist item's status
 *
 * Body: { status: "done"|"pending"|"in_progress"|"skipped", notes: "optional" }
 */
router.patch('/projects/:id/items/:itemId', rejectSampleWrite, async (req, res) => {
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
router.post('/projects/:id/items/:itemId/flag', rejectSampleWrite, async (req, res) => {
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
  if (isSampleProject(req.params.id)) {
    if (!sampleProject) return res.status(404).json({ error: 'Sample not available' });
    return res.json({
      project_name: sampleProject.name,
      summary: sampleProject.summary,
      total_pages: sampleProject.total_pages,
      pages_processed: sampleProject.pages_processed,
    });
  }

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
 * GET /api/projects/:id/pdf
 * Stream the original uploaded PDF back to the client
 */
router.get('/projects/:id/pdf', async (req, res) => {
  if (isSampleProject(req.params.id)) {
    try {
      await stat(SAMPLE_PDF_PATH);
    } catch {
      return res.status(404).json({ error: 'Sample PDF not found on disk' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="demo-plan.pdf"');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return createReadStream(SAMPLE_PDF_PATH).pipe(res);
  }

  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  try {
    await stat(project.pdf_path);
  } catch {
    return res.status(404).json({ error: 'PDF file not found on disk' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${project.pdf_filename}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  createReadStream(project.pdf_path).pipe(res);
});

/**
 * DELETE /api/projects/:id
 */
router.delete('/projects/:id', rejectSampleWrite, async (req, res) => {
  const deleted = await deleteProject(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Project not found' });
  res.json({ message: 'Project deleted' });
});

// ─── SSE Helper ────────────────────────────────────────────────

function sendSSE(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export default router;
