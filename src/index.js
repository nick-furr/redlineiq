/**
 * RedlineIQ Backend Server
 *
 * Express server that handles:
 * - PDF upload and storage
 * - AI-powered markup extraction via Claude Vision
 * - Checklist management (status updates, flagging)
 * - Progress tracking and summaries
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { existsSync } from 'fs';
import { config } from './config/index.js';
import apiRoutes from './routes/api.js';
import { initProjectStore } from './services/project-service.js';

const app = express();

// Trust the first proxy hop so rate limiting uses the real client IP on Render/Railway
app.set('trust proxy', 1);

// ─── Middleware ─────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Rate Limiting ──────────────────────────────────────────────
// Global guard for all /api routes — keeps general abuse in check
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please slow down and try again in a few minutes.',
    });
  },
});

// ─── Routes ────────────────────────────────────────────────────
app.use('/api', globalApiLimiter, apiRoutes);

// Health check (intentionally outside rate limiter for uptime monitors)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'redlineiq-backend' });
});

// ─── Static Frontend ───────────────────────────────────────────
// Serves the built React app in production (single-service deploy).
// In development the Vite dev server handles the frontend separately.
const clientDist = path.resolve('./client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // Catch-all: return index.html for any non-API route so React Router works
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ─── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: `File too large. Maximum size is ${config.upload.maxFileSizeMB}MB.`,
    });
  }

  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ─────────────────────────────────────────────────────
async function start() {
  await initProjectStore();

  app.listen(config.server.port, () => {
    console.log(`
┌─────────────────────────────────────────┐
│                                         │
│   RedlineIQ Backend                     │
│   Running on port ${config.server.port}                  │
│                                         │
│   Endpoints:                            │
│   POST /api/projects         (upload)   │
│   POST /api/projects/:id/extract        │
│   GET  /api/projects/:id     (detail)   │
│   PATCH /api/projects/:id/items/:id     │
│                                         │
└─────────────────────────────────────────┘
    `);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
