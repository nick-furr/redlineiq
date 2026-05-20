/**
 * One-off script: extract markups from the sample PDF and write
 * two seed files used at runtime:
 *   - samples/demo-extraction.json  (server: full ChecklistItem shape)
 *   - client/src/sampleData.js      (client: flattened SAMPLE_ITEMS)
 *
 * Both seeds come from a single extraction run so server JSON and client
 * UI never disagree.
 *
 * Usage: node scripts/generate-sample.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import { pdfToImages, getPdfPageCount } from '../src/utils/pdf-converter.js';
import { extractAllPages } from '../src/services/extraction-service.js';
import { createChecklistItem, computeSummary } from '../src/models/markup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const PDF_FILENAME = 's1-framing.pdf';
const PDF_PATH = path.join(REPO_ROOT, 'samples', PDF_FILENAME);
const SERVER_OUTPUT_PATH = path.join(REPO_ROOT, 'samples', 'demo-extraction.json');
const CLIENT_OUTPUT_PATH = path.join(REPO_ROOT, 'client', 'src', 'sampleData.js');

const PROJECT_ID = 'sample-demo-001';
const PROJECT_NAME = 'Sample: Structural Framing (S1)';

async function main() {
  console.log('RedlineIQ — Demo Sample Generator');
  console.log('==================================');
  console.log(`PDF:    ${PDF_PATH}`);
  console.log(`Server: ${SERVER_OUTPUT_PATH}`);
  console.log(`Client: ${CLIENT_OUTPUT_PATH}`);
  console.log('');

  // Step 1: Page count
  console.log('Counting pages...');
  const totalPages = await getPdfPageCount(PDF_PATH);
  console.log(`Total pages: ${totalPages}`);

  // Step 2: Convert PDF to images
  console.log('\nConverting PDF to images...');
  const pageImages = await pdfToImages(PDF_PATH);
  const convertedCount = pageImages.filter(p => p.base64).length;
  console.log(`Converted: ${convertedCount}/${totalPages} pages`);

  // Step 3: Extract markups via Claude Vision
  console.log('\nRunning extraction (this will call the Claude API)...');
  // Rate-limit retries are handled internally by extraction-service and logged to console automatically.
  const extractionResult = await extractAllPages(
    pageImages,
    { projectName: PROJECT_NAME },
    (pageNum, total, result) => {
      if (result.error) {
        console.warn(`  Page ${pageNum}/${total}: FAILED — ${result.error}`);
      } else {
        const count = result.markups?.length ?? 0;
        console.log(`  Page ${pageNum}/${total}: ${count} markups found`);
      }
    }
  );

  // Step 4: Build checklist items (mirrors addExtractionResults in project-service.js)
  const now = new Date().toISOString();
  const checklist = [];

  for (const page of extractionResult.pages) {
    for (const markup of page.markups) {
      checklist.push(createChecklistItem({ ...markup, page_number: page.page_number }));
    }
  }

  const summary = computeSummary(checklist);

  // Step 5: Assemble the project object
  const project = {
    id: PROJECT_ID,
    name: PROJECT_NAME,
    pdf_filename: PDF_FILENAME,
    pdf_path: PDF_PATH,
    total_pages: totalPages,
    pages_processed: extractionResult.stats.pagesProcessed,
    checklist,
    summary,
    created_at: now,
    updated_at: now,
  };

  // Step 6: Write server JSON
  await fs.writeFile(SERVER_OUTPUT_PATH, JSON.stringify(project, null, 2), 'utf-8');

  // Step 7: Emit client sampleData.js — flat shape the React UI expects
  await fs.writeFile(CLIENT_OUTPUT_PATH, renderClientSampleData(project), 'utf-8');

  // Step 7: Report
  const { stats } = extractionResult;
  console.log('\n==================================');
  console.log('Extraction complete');
  console.log(`  Total markups:  ${stats.totalMarkups}`);
  console.log(`  Pages OK/fail:  ${stats.pagesProcessed}/${stats.pagesFailed}`);
  console.log(`  Ambiguous:      ${stats.ambiguousCount}`);

  if (Object.keys(stats.byType).length > 0) {
    const dist = Object.entries(stats.byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
    console.log(`  By type:        ${dist}`);
  }

  const confDist = Object.entries(stats.byConfidence)
    .filter(([, n]) => n > 0)
    .map(([level, count]) => `${level}: ${count}`)
    .join(', ');
  if (confDist) console.log(`  By confidence:  ${confDist}`);

  if (stats.pagesFailed > 0) {
    console.warn(`\n  WARNING: ${stats.pagesFailed} page(s) failed to extract`);
  }

  console.log(`\nWrote: ${SERVER_OUTPUT_PATH}`);
  console.log(`Wrote: ${CLIENT_OUTPUT_PATH}`);
  console.log('Note: Claude Vision output is non-deterministic — re-running will produce different markup content.');
}

function flattenForClient(item) {
  return {
    id: item.id,
    markup_text: item.markup.markup_text,
    markup_type: item.markup.markup_type,
    drawing_reference: item.markup.drawing_reference,
    location_on_drawing: item.markup.location_on_drawing,
    related_to: item.markup.related_to,
    confidence: item.markup.confidence,
    ambiguous: item.markup.ambiguous,
    page_number: item.markup.page_number,
    status: item.status,
    flagged: item.status === 'flagged',
    clarification_request: item.clarification_request,
  };
}

function renderClientSampleData(project) {
  const sampleProject = {
    id: project.id,
    name: project.name,
    pdf_filename: project.pdf_filename,
    total_pages: project.total_pages,
    created_at: project.created_at,
    summary: {
      total: project.summary.total,
      done: project.summary.done,
      flagged: project.summary.flagged,
      pending: project.summary.pending,
      in_progress: project.summary.in_progress,
    },
  };
  const items = project.checklist.map(flattenForClient);

  const header = '// AUTO-GENERATED by scripts/generate-sample.js — do not edit by hand.\n';
  return (
    header +
    `export const SAMPLE_PROJECT = ${JSON.stringify(sampleProject, null, 2)}\n\n` +
    `export const SAMPLE_ITEMS = ${JSON.stringify(items, null, 2)}\n`
  );
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
