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
import { config } from './config/index.js';
import apiRoutes from './routes/api.js';
import { initProjectStore } from './services/project-service.js';

const app = express();

// ─── Middleware ─────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'redlineiq-backend' });
});

// ─── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: `File too large. Maximum size is ${config.upload.maxFileSizeMB}MB.`,
    });
  }

  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ─────────────────────────────────────────────────────
async function start() {
  // Initialize project storage
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
