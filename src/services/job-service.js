/**
 * Job Service
 * 
 * Manages async extraction jobs. Each job tracks per-page progress
 * and emits events that the SSE endpoint streams to the client.
 * 
 * Jobs live in memory — they don't need to survive a server restart.
 * A drafter uploads a PDF, watches extraction happen, then works 
 * from the saved project data. The job itself is ephemeral.
 */

import { EventEmitter } from 'events';
import { pdfToImages } from '../utils/pdf-converter.js';
import { extractAllPages } from './extraction-service.js';
import { addExtractionResults, getProject } from './project-service.js';

// ─── Job Store ─────────────────────────────────────────────────

const jobs = new Map();

// ─── Job Statuses ──────────────────────────────────────────────

export const JOB_STATUS = {
  PENDING: 'pending',
  CONVERTING: 'converting',
  EXTRACTING: 'extracting',
  SAVING: 'saving',
  COMPLETE: 'complete',
  FAILED: 'failed',
};

// ─── Create & Run ──────────────────────────────────────────────

/**
 * Create a new extraction job and start it in the background.
 * Returns the jobId immediately — caller doesn't await extraction.
 * 
 * @param {string} projectId - Project to extract from
 * @returns {{ jobId: string, emitter: EventEmitter }}
 */
export function createJob(projectId) {
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emitter = new EventEmitter();

  const job = {
    id: jobId,
    projectId,
    status: JOB_STATUS.PENDING,
    emitter,
    createdAt: new Date().toISOString(),
    progress: {
      currentPage: 0,
      totalPages: 0,
      pagesComplete: 0,
      pagesFailed: 0,
    },
    result: null,
    error: null,
  };

  jobs.set(jobId, job);

  // Fire and forget — don't await
  runJob(job).catch(err => {
    console.error(`Job ${jobId} crashed:`, err);
    job.status = JOB_STATUS.FAILED;
    job.error = err.message;
    emitter.emit('job_failed', { jobId, error: err.message });
  });

  return { jobId, emitter };
}

/**
 * Get a job by ID.
 */
export function getJob(jobId) {
  return jobs.get(jobId) || null;
}

// ─── Job Runner ────────────────────────────────────────────────

async function runJob(job) {
  const { emitter, projectId } = job;
  const project = getProject(projectId);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Step 1: Convert PDF to images
  job.status = JOB_STATUS.CONVERTING;
  emitter.emit('job_started', {
    jobId: job.id,
    projectName: project.name,
    totalPages: project.total_pages,
  });

  console.log(`[Job ${job.id}] Converting PDF to images...`);
  const pageImages = await pdfToImages(project.pdf_path);

  job.progress.totalPages = pageImages.length;

  emitter.emit('conversion_complete', {
    jobId: job.id,
    totalPages: pageImages.length,
  });

  // Step 2: Extract markups page by page
  job.status = JOB_STATUS.EXTRACTING;

  const extractionResult = await extractAllPages(
    pageImages,
    { projectName: project.name },
    (pageNum, total, result) => {
      const success = !result.error;
      const count = result.markups ? result.markups.length : 0;

      if (success) {
        job.progress.pagesComplete++;
      } else {
        job.progress.pagesFailed++;
      }
      job.progress.currentPage = pageNum;

      console.log(`[Job ${job.id}] Page ${pageNum}/${total}: ${success ? count + ' markups' : 'FAILED'}`);

      emitter.emit('page_complete', {
        jobId: job.id,
        pageNumber: pageNum,
        totalPages: total,
        success,
        markupsFound: count,
        error: result.error || null,
      });
    }
  );

  // Step 3: Save results to project
  job.status = JOB_STATUS.SAVING;

  const updatedProject = await addExtractionResults(projectId, extractionResult);

  // Done
  job.status = JOB_STATUS.COMPLETE;
  job.result = {
    totalMarkups: extractionResult.totalMarkups,
    stats: extractionResult.stats,
  };

  emitter.emit('job_complete', {
    jobId: job.id,
    totalMarkups: extractionResult.totalMarkups,
    stats: extractionResult.stats,
    summary: updatedProject.summary,
  });

  console.log(`[Job ${job.id}] Complete — ${extractionResult.totalMarkups} markups extracted`);

  // Clean up the job after 10 minutes (no need to hold it forever)
  setTimeout(() => {
    jobs.delete(job.id);
  }, 10 * 60 * 1000);
}
