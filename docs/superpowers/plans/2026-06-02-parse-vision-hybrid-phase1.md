# Parse/Vision Hybrid — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route digital, un-flattened PDFs through a lossless annotation-layer parser instead of vision — near-100% extraction, cheaply — while leaving the existing tiled-vision path untouched for everything else.

**Architecture:** A probe in `runJob()` counts markup annotations in the PDF. If any exist, a new parse service reads text + coordinates directly from the annotation layer and a cheap text-only Claude call assigns the semantic labels (type / related_to / confidence) that aren't in the file. The parse service returns the **same `ExtractionResult` shape** the vision path returns, so the job runner, persistence, SSE events, and UI need no other changes. No annotations → existing tiled vision, unchanged.

**Tech Stack:** Node ESM, `pdfjs-dist` (legacy Node build) for parsing, `@anthropic-ai/sdk` for labeling, plain-`node` assert test scripts (no framework), `better-sqlite3` persistence (untouched).

**Spec:** `docs/superpowers/specs/2026-06-02-parse-vision-hybrid-extraction-design.md`

---

## File Structure

- **Create** `src/utils/pdf-annotation-probe.js` — opens a PDF with pdfjs, counts markup-subtype annotations, returns the routing verdict. One responsibility: classify source type.
- **Create** `src/services/parse-extraction-service.js` — annotation-layer extraction + text-only labeling + `ExtractionResult` assembly. Mirrors `tiled-extraction-service.js`'s public contract.
- **Modify** `src/services/job-service.js` — add the router branch in `runJob()`.
- **Modify** `src/models/markup.js` — document the new optional `coordinates` field.
- **Modify** `package.json` — add `pdfjs-dist` dependency; register new test files.
- **Modify** `client/package.json` — revert the stray `redlineiq-backend: file:..` line.
- **Create** `test/test-annotation-probe.js`, `test/test-parse-extraction.js` — offline tests against real eval PDFs and pure functions.

Test fixtures (already in repo, no API needed):
- `evals/pdfs/case_012_sanmarcos_s201_framing.pdf` — 24 annotations (12 FreeText w/ text + 12 Polygon). → 12 text markups.
- `evals/pdfs/case_011_walpole_c401_grading.pdf` — 20 annotations (10 FreeText + 8 Polygon + 2 Line). → 10 text markups.
- `evals/pdfs/case_001_c301_site_layout.pdf` — 0 annotations (rasterized). → routes to vision.

---

## Task 1: Add pdfjs-dist to the backend

**Why a new dep:** the backend currently has no PDF *parser* — `pdf2pic`/`pdf-lib` only rasterize/manipulate. `pdfjs-dist` is the library that exposes `getAnnotations()` / `getTextContent()`. It's already a transitive dep in `client/`; we add it to the backend explicitly. Use the **legacy** build (`pdfjs-dist/legacy/build/pdf.mjs`) — the only one that runs under Node without a DOM.

**Files:**
- Modify: `package.json` (dependencies)
- Test: `test/test-annotation-probe.js` (import smoke check, expanded in Task 3)

- [ ] **Step 1: Install the dependency**

Run:
```bash
npm install pdfjs-dist@^5.4.296
```
Expected: `package.json` gains `"pdfjs-dist": "^5.4.296"` under dependencies; `package-lock.json` updates; exit 0.

- [ ] **Step 2: Verify the legacy build imports under Node**

Run:
```bash
node -e "import('pdfjs-dist/legacy/build/pdf.mjs').then(m => console.log('OK', typeof m.getDocument))"
```
Expected: `OK function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add pdfjs-dist for backend annotation parsing"
```

---

## Task 2: Annotation probe (the router's classifier)

**Files:**
- Create: `src/utils/pdf-annotation-probe.js`
- Test: `test/test-annotation-probe.js`

- [ ] **Step 1: Write the failing test**

Create `test/test-annotation-probe.js`:
```js
/**
 * Test: PDF annotation probe (source-type router).
 * Uses real eval PDFs, no API. Run: node test/test-annotation-probe.js
 */
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { probeAnnotations, MARKUP_SUBTYPES } from '../src/utils/pdf-annotation-probe.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const pdf = (name) => resolve(HERE, '../evals/pdfs', name);

let failed = false;
function assert(cond, msg) {
  if (!cond) { console.error(`  ✗ FAIL: ${msg}`); failed = true; process.exitCode = 1; }
  else { console.log(`  ✓ ${msg}`); }
}

console.log('\n🧪 pdf-annotation-probe\n');

const digital = await probeAnnotations(pdf('case_012_sanmarcos_s201_framing.pdf'));
assert(digital.sourceType === 'digital_annotation', 'case_012 → digital_annotation');
assert(digital.markupCount === 24, `case_012 markupCount is 24 (got ${digital.markupCount})`);
assert(Array.isArray(digital.perPageCounts) && digital.perPageCounts[0] === 24, 'case_012 perPageCounts[0] === 24');

const raster = await probeAnnotations(pdf('case_001_c301_site_layout.pdf'));
assert(raster.sourceType === 'raster', 'case_001 (rasterized) → raster');
assert(raster.markupCount === 0, 'case_001 markupCount is 0');

assert(MARKUP_SUBTYPES.has('FreeText') && !MARKUP_SUBTYPES.has('Link'), 'subtype set includes FreeText, excludes Link');

if (!failed) console.log('\n✅ all probe tests passed\n');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/test-annotation-probe.js`
Expected: FAIL — `Cannot find module '../src/utils/pdf-annotation-probe.js'`

- [ ] **Step 3: Implement the probe**

Create `src/utils/pdf-annotation-probe.js`:
```js
/**
 * PDF Annotation Probe
 *
 * Classifies an uploaded PDF by source type so the job runner can route it:
 * digital files with a live annotation layer are parsed losslessly; everything
 * else falls through to tiled vision. Runs before any rasterization, so digital
 * files skip image conversion entirely.
 *
 * Phase 1 routes two ways: annotations present → 'digital_annotation', else
 * → 'raster'. (The 'digital_flattened' regime is Phase 2.)
 */

import { readFile } from 'fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// pdfjs markup subtypes. Link/Popup/Widget are structural chrome present in many
// plain PDFs, so they must NOT count toward "this file has markup".
export const MARKUP_SUBTYPES = new Set([
  'FreeText', 'Square', 'Circle', 'Polygon', 'PolyLine', 'Line',
  'Ink', 'Highlight', 'StrikeOut', 'Underline', 'Squiggly', 'Text', 'Stamp',
]);

/**
 * @param {string} pdfPath - Absolute or cwd-relative path to the PDF.
 * @returns {Promise<{sourceType: 'digital_annotation'|'raster', markupCount: number, perPageCounts: number[]}>}
 */
export async function probeAnnotations(pdfPath) {
  const data = new Uint8Array(await readFile(pdfPath));
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;

  const perPageCounts = [];
  let markupCount = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const annots = await page.getAnnotations({ intent: 'display' });
    const pageCount = annots.filter(a => MARKUP_SUBTYPES.has(a.subtype)).length;
    perPageCounts.push(pageCount);
    markupCount += pageCount;
  }

  await doc.destroy();

  return {
    sourceType: markupCount > 0 ? 'digital_annotation' : 'raster',
    markupCount,
    perPageCounts,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test-annotation-probe.js`
Expected: PASS — all probe assertions ✓

- [ ] **Step 5: Commit**

```bash
git add src/utils/pdf-annotation-probe.js test/test-annotation-probe.js
git commit -m "feat(probe): annotation-count source-type router"
```

---

## Task 3: Parse the annotation layer (text + coordinates)

Extracts one raw markup per annotation that carries text. Clouds/shapes with no
text are location indicators only — their paired note carries the content — so
they are skipped, mirroring the existing `dropLocationOnlyMarkers` philosophy.

**Files:**
- Create: `src/services/parse-extraction-service.js`
- Test: `test/test-parse-extraction.js`

- [ ] **Step 1: Write the failing test**

Create `test/test-parse-extraction.js`:
```js
/**
 * Test: parse-extraction-service. Annotation-layer parsing + pure assembly
 * helpers are offline (real eval PDFs, no API). Run: node test/test-parse-extraction.js
 */
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import {
  parseAnnotationLayer,
  parseLabelResponse,
  applyLabels,
  assembleResult,
} from '../src/services/parse-extraction-service.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const pdf = (name) => resolve(HERE, '../evals/pdfs', name);

let failed = false;
function assert(cond, msg) {
  if (!cond) { console.error(`  ✗ FAIL: ${msg}`); failed = true; process.exitCode = 1; }
  else { console.log(`  ✓ ${msg}`); }
}

console.log('\n🧪 parse-extraction: parseAnnotationLayer\n');

const pages = await parseAnnotationLayer(pdf('case_012_sanmarcos_s201_framing.pdf'));
const all = pages.flatMap(p => p.markups);
assert(pages.length === 1, 'case_012 → 1 page');
assert(all.length === 12, `case_012 → 12 text markups (got ${all.length})`);
assert(all.every(m => typeof m.markup_text === 'string' && m.markup_text.length > 0), 'every markup has non-empty text');
assert(all.every(m => Array.isArray(m.coordinates.rect) && m.coordinates.rect.length === 4), 'every markup has a 4-tuple rect');
assert(all.every(m => m.coordinates.page === 1), 'coordinates.page is set');

console.log('\n🧪 parse-extraction: pure label helpers\n');

const raw = [{ id: 'MK-001', markup_text: 'Delete this wall' }, { id: 'MK-002', markup_text: 'verify?' }];
const labels = parseLabelResponse('```json\n[{"id":"MK-001","markup_type":"delete","related_to":null,"confidence":"high","ambiguous":false},{"id":"MK-002","markup_type":"clarify","related_to":null,"confidence":"high","ambiguous":true}]\n```');
assert(labels.length === 2, 'parseLabelResponse strips fences and parses 2 labels');

const merged = applyLabels(raw, labels);
assert(merged[0].markup_type === 'delete' && merged[1].ambiguous === true, 'applyLabels merges type/ambiguous by id');
assert(merged[1].markup_type === 'clarify', 'applyLabels keeps second item type');

console.log('\n🧪 parse-extraction: assembleResult\n');

const result = assembleResult([{ page_number: 1, drawing_reference: 'S-201', drawing_title: 'Framing', markups: merged }]);
assert(result.totalMarkups === 2, 'assembleResult totalMarkups === 2');
assert(result.allMarkups[0].id === 'MK-001' && result.allMarkups[1].id === 'MK-002', 'assembleResult renumbers IDs sequentially');
assert(result.stats.byType.delete === 1 && result.stats.byType.clarify === 1, 'assembleResult stats.byType counts');
assert(result.stats.ambiguousCount === 1, 'assembleResult ambiguousCount === 1');

if (!failed) console.log('\n✅ all parse-extraction tests passed\n');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/test-parse-extraction.js`
Expected: FAIL — `Cannot find module '../src/services/parse-extraction-service.js'`

- [ ] **Step 3: Implement parsing + pure helpers (no Claude call yet)**

Create `src/services/parse-extraction-service.js`:
```js
/**
 * Parse Extraction Service
 *
 * Lossless extraction for digital, un-flattened PDFs: read markup text and exact
 * coordinates straight from the annotation layer, then a cheap text-only Claude
 * call assigns the semantic labels (markup_type / related_to / confidence /
 * ambiguous) that don't live in the file.
 *
 * Returns the SAME ExtractionResult shape as extractAllPagesTiled
 * ({ pages, allMarkups, totalMarkups, stats }) so job-service.js, persistence,
 * and the UI are unchanged.
 */

import { readFile } from 'fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import { MARKUP_TYPES, CONFIDENCE } from '../models/markup.js';
import { MARKUP_SUBTYPES } from '../utils/pdf-annotation-probe.js';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

/**
 * Read text-bearing markup annotations + coordinates from every page.
 * @returns {Promise<Array<{page_number:number, drawing_reference:string, drawing_title:string, markups:Array}>>}
 */
export async function parseAnnotationLayer(pdfPath) {
  const data = new Uint8Array(await readFile(pdfPath));
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const pages = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const annots = await page.getAnnotations({ intent: 'display' });
    const markups = [];

    for (const a of annots) {
      if (!MARKUP_SUBTYPES.has(a.subtype)) continue;
      const text = (a.contents || '').trim();
      if (!text) continue; // shapes w/o text are location indicators; their note carries content

      markups.push({
        id: `MK-${String(markups.length + 1).padStart(3, '0')}`, // per-page; renumbered in assembleResult
        markup_text: text,
        drawing_reference: 'Unknown',
        location_on_drawing: '',
        coordinates: { page: p, rect: Array.from(a.rect || []), subtype: a.subtype },
      });
    }

    pages.push({ page_number: p, drawing_reference: 'Unknown', drawing_title: '', markups });
  }

  await doc.destroy();
  return pages;
}

// ─── Text-only labeling (the cheap hybrid pass) ────────────────────────────

const LABEL_SYSTEM = `You classify construction redline markup notes. The TEXT is already extracted verbatim and correct — do NOT rewrite it. For each item assign:
- markup_type: one of ${Object.values(MARKUP_TYPES).join(', ')}
- related_to: the id of another item this one references, or null
- confidence: ${Object.values(CONFIDENCE).join(', ')} (default "high" — the text is exact)
- ambiguous: true if the intent is unclear even though the text is legible (e.g. "verify?" with no object)
Respond with ONLY a JSON array of {id, markup_type, related_to, confidence, ambiguous}. No prose, no markdown fences.`;

export function buildLabelUserMessage(markups) {
  const items = markups.map(m => ({ id: m.id, markup_text: m.markup_text }));
  return `Classify these ${items.length} markups:\n${JSON.stringify(items, null, 2)}`;
}

export function parseLabelResponse(text) {
  const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(clean);
}

const VALID_TYPES = new Set(Object.values(MARKUP_TYPES));
const VALID_CONF = new Set(Object.values(CONFIDENCE));

export function applyLabels(markups, labels) {
  const byId = new Map(labels.map(l => [l.id, l]));
  return markups.map(m => {
    const l = byId.get(m.id) || {};
    return {
      ...m,
      markup_type: VALID_TYPES.has(l.markup_type) ? l.markup_type : MARKUP_TYPES.NOTE,
      related_to: typeof l.related_to === 'string' ? l.related_to : null,
      confidence: VALID_CONF.has(l.confidence) ? l.confidence : CONFIDENCE.HIGH,
      ambiguous: Boolean(l.ambiguous),
    };
  });
}

/** One Claude call per page to label that page's markups. Empty pages skip the call. */
export async function labelMarkups(markups) {
  if (markups.length === 0) return [];
  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 4096,
    system: LABEL_SYSTEM,
    messages: [{ role: 'user', content: buildLabelUserMessage(markups) }],
  });
  const block = response.content.find(b => b.type === 'text');
  if (!block) throw new Error('No text response from labeling call');
  return applyLabels(markups, parseLabelResponse(block.text));
}

// ─── Assembly (same ExtractionResult shape as extractAllPagesTiled) ─────────

/** @param {Array<{page_number, drawing_reference, drawing_title, markups}>} labeledPages */
export function assembleResult(labeledPages) {
  const pages = [];
  const allMarkups = [];
  let counter = 1;

  for (const page of labeledPages) {
    const idMap = new Map();
    for (const m of page.markups) {
      const oldId = m.id;
      m.id = `MK-${String(counter).padStart(3, '0')}`;
      idMap.set(oldId, m.id);
      counter++;
    }
    for (const m of page.markups) {
      if (m.related_to && idMap.has(m.related_to)) m.related_to = idMap.get(m.related_to);
    }
    page.total_markups_found = page.markups.length;
    pages.push(page);
    allMarkups.push(...page.markups);
  }

  const stats = {
    totalPages: pages.length,
    pagesProcessed: pages.length,
    pagesFailed: 0,
    totalMarkups: allMarkups.length,
    byType: {},
    byConfidence: { high: 0, medium: 0, low: 0 },
    ambiguousCount: 0,
  };
  for (const m of allMarkups) {
    stats.byType[m.markup_type] = (stats.byType[m.markup_type] || 0) + 1;
    if (m.confidence in stats.byConfidence) stats.byConfidence[m.confidence]++;
    if (m.ambiguous) stats.ambiguousCount++;
  }

  return { pages, allMarkups, totalMarkups: allMarkups.length, stats };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test-parse-extraction.js`
Expected: PASS — all parse-extraction assertions ✓

- [ ] **Step 5: Commit**

```bash
git add src/services/parse-extraction-service.js test/test-parse-extraction.js
git commit -m "feat(parse): annotation-layer extraction + text-only labeling helpers"
```

---

## Task 4: Top-level parse entrypoint (mirrors extractAllPagesTiled contract)

Wires parse → label → assemble into one function with the same
`(input, context, onProgress) → ExtractionResult` contract the job runner uses.

**Files:**
- Modify: `src/services/parse-extraction-service.js`
- Test: `test/test-parse-extraction.js` (add a contract-shape check using a stub)

- [ ] **Step 1: Add the failing test (append before the final summary line)**

In `test/test-parse-extraction.js`, add after the `assembleResult` block:
```js
console.log('\n🧪 parse-extraction: extractAllPagesParsed contract\n');

const { extractAllPagesParsed } = await import('../src/services/parse-extraction-service.js');
assert(typeof extractAllPagesParsed === 'function', 'extractAllPagesParsed is exported');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/test-parse-extraction.js`
Expected: FAIL — `extractAllPagesParsed is exported` assertion fails (undefined).

- [ ] **Step 3: Implement the entrypoint**

Append to `src/services/parse-extraction-service.js`:
```js
/**
 * Parse + label every page of a digital PDF. Same contract as
 * extractAllPagesTiled: returns { pages, allMarkups, totalMarkups, stats } and
 * calls onProgress(pageNum, totalPages, pageResult) after each page.
 *
 * @param {string} pdfPath
 * @param {Object} [context] - reserved for parity with the vision path
 * @param {Function} [onProgress] - (pageNum, totalPages, result)
 */
export async function extractAllPagesParsed(pdfPath, context = {}, onProgress = null) {
  const rawPages = await parseAnnotationLayer(pdfPath);
  const labeledPages = [];

  for (let i = 0; i < rawPages.length; i++) {
    const page = rawPages[i];
    try {
      const labeled = await labelMarkups(page.markups);
      const labeledPage = { ...page, markups: labeled };
      labeledPages.push(labeledPage);
      if (onProgress) onProgress(page.page_number, rawPages.length, { markups: labeled });
    } catch (err) {
      console.error(`Error labeling page ${page.page_number} (parse):`, err.message);
      labeledPages.push({ ...page, markups: [], error: err.message });
      if (onProgress) onProgress(page.page_number, rawPages.length, { error: err.message });
    }
  }

  return assembleResult(labeledPages);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test-parse-extraction.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/parse-extraction-service.js test/test-parse-extraction.js
git commit -m "feat(parse): extractAllPagesParsed entrypoint matching vision contract"
```

---

## Task 5: Route in the job runner

**Files:**
- Modify: `src/services/job-service.js`
- Test: `test/test-annotation-probe.js` (add a pure router-decision check)

- [ ] **Step 1: Write the failing test (append to test/test-annotation-probe.js before summary)**

```js
console.log('\n🧪 job-service: chooseExtractionPath\n');
const { chooseExtractionPath } = await import('../src/services/job-service.js');
assert(chooseExtractionPath({ sourceType: 'digital_annotation' }) === 'parse', 'digital_annotation → parse');
assert(chooseExtractionPath({ sourceType: 'raster' }) === 'vision', 'raster → vision');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/test-annotation-probe.js`
Expected: FAIL — `chooseExtractionPath` is undefined.

- [ ] **Step 3: Implement the router in job-service.js**

In `src/services/job-service.js`, add imports near the top (after line 15):
```js
import { probeAnnotations } from '../utils/pdf-annotation-probe.js';
import { extractAllPagesParsed } from './parse-extraction-service.js';
```

Add this exported pure helper after `getJob` (after line 79):
```js
/**
 * Decide which extraction regime to use from a probe result.
 * Phase 1: annotations present → parse; otherwise → vision.
 */
export function chooseExtractionPath(probeResult) {
  return probeResult.sourceType === 'digital_annotation' ? 'parse' : 'vision';
}
```

Replace the body of `runJob` from the `// Step 1` block through the end of the
`extractAllPagesTiled(...)` call (current lines 91–140) with:
```js
  // Step 1: Probe source type BEFORE any rasterization — digital files skip it.
  job.status = JOB_STATUS.CONVERTING;
  emitter.emit('job_started', {
    jobId: job.id,
    projectName: project.name,
    totalPages: project.total_pages,
  });

  const probe = await probeAnnotations(project.pdf_path);
  const path = chooseExtractionPath(probe);
  console.log(`[Job ${job.id}] Source: ${probe.sourceType} (${probe.markupCount} annotations) → ${path}`);

  const onPage = (pageNum, total, result) => {
    const success = !result.error;
    const count = result.markups ? result.markups.length : 0;
    if (success) job.progress.pagesComplete++; else job.progress.pagesFailed++;
    job.progress.currentPage = pageNum;
    job.progress.totalPages = total;
    console.log(`[Job ${job.id}] Page ${pageNum}/${total}: ${success ? count + ' markups' : 'FAILED'}`);
    emitter.emit('page_complete', {
      jobId: job.id, pageNumber: pageNum, totalPages: total,
      success, markupsFound: count, error: result.error || null,
    });
  };

  job.status = JOB_STATUS.EXTRACTING;
  let extractionResult;

  if (path === 'parse') {
    extractionResult = await extractAllPagesParsed(
      project.pdf_path, { projectName: project.name }, onPage
    );
    job.progress.totalPages = extractionResult.stats.totalPages;
    emitter.emit('conversion_complete', { jobId: job.id, totalPages: extractionResult.stats.totalPages });
  } else {
    console.log(`[Job ${job.id}] Converting PDF to tiles...`);
    const tiles = await pdfToTiledImages(project.pdf_path);
    const totalPages = new Set(tiles.map(t => t.pageNumber)).size;
    job.progress.totalPages = totalPages;
    emitter.emit('conversion_complete', { jobId: job.id, totalPages });
    extractionResult = await extractAllPagesTiled(tiles, { projectName: project.name }, onPage);
  }
```

The remaining `// Step 3: Save results` block (current lines 142+) is unchanged
— it already consumes `extractionResult`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test-annotation-probe.js`
Expected: PASS — both `chooseExtractionPath` assertions ✓

- [ ] **Step 5: Verify the full test suite still passes**

Run: `node test/test-annotation-probe.js && node test/test-parse-extraction.js`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/job-service.js test/test-annotation-probe.js
git commit -m "feat(jobs): route digital PDFs to parse, raster to vision"
```

---

## Task 6: Document the optional coordinates field

The parse path attaches `coordinates` to each markup; persistence stores the
markup object verbatim, so no schema migration is needed — but the model doc
must describe it so consumers know it exists and is parse-only for now.

**Files:**
- Modify: `src/models/markup.js`

- [ ] **Step 1: Add the field to the ExtractedMarkup typedef**

In `src/models/markup.js`, inside the `@typedef {Object} ExtractedMarkup` block
(after the `raw_interpretation` line, ~line 60), add:
```js
 * @property {Object} [coordinates] - Parse-path only. Exact annotation geometry
 *   from the PDF. { page:number, rect:[x1,y1,x2,y2] (PDF points, bottom-left
 *   origin), subtype:string }. Absent on vision-extracted markups. Captured now;
 *   on-drawing highlighting (deferred) will consume it.
```

- [ ] **Step 2: Verify nothing references it as required**

Run:
```bash
node -e "import('./src/models/markup.js').then(m => console.log('schema required:', m.EXTRACTION_RESPONSE_SCHEMA.properties.markups.items.required.includes('coordinates') ? 'BAD' : 'OK (optional)'))"
```
Expected: `schema required: OK (optional)` — `coordinates` is not in the vision schema's `required` list.

- [ ] **Step 3: Commit**

```bash
git add src/models/markup.js
git commit -m "docs(model): document parse-only coordinates field"
```

---

## Task 7: Eval — segment metrics by source type + router accuracy

Make the harness route each case through the probe and report recall/precision
**broken down by regime**, plus whether each case was routed correctly. This is
how we prove the parse path without blending its numbers into the vision average.

**Files:**
- Modify: `evals/run-eval.js` (lines 59–84 load loop; 125–135 aggregation)
- Modify: `evals/labels/case_011_walpole_c401_grading.json`, `evals/labels/case_012_sanmarcos_s201_framing.json` (add `source_type`)
- Test: `test/test-eval-routing.js` (pure aggregation helper)

- [ ] **Step 1: Tag the two digital labels**

In `evals/labels/case_012_sanmarcos_s201_framing.json` and
`evals/labels/case_011_walpole_c401_grading.json`, add a top-level field:
```json
"source_type": "digital_annotation",
```
(Leave existing rasterized synthetic cases untagged; they default to `raster` in Step 2.)

- [ ] **Step 2: Write the failing test for the aggregation helper**

Create `test/test-eval-routing.js`:
```js
/**
 * Test: eval per-regime aggregation + router-accuracy. Pure function, no API.
 * Run: node test/test-eval-routing.js
 */
import { summarizeByRegime } from '../evals/lib/regime-summary.js';

let failed = false;
function assert(cond, msg) {
  if (!cond) { console.error(`  ✗ FAIL: ${msg}`); failed = true; process.exitCode = 1; }
  else { console.log(`  ✓ ${msg}`); }
}

console.log('\n🧪 eval: summarizeByRegime\n');

const rows = [
  { case_id: 'a', expected_source: 'digital_annotation', routed: 'parse',  scores: { recall: 1.0, precision: 1.0 } },
  { case_id: 'b', expected_source: 'raster',             routed: 'vision', scores: { recall: 0.5, precision: 0.4 } },
  { case_id: 'c', expected_source: 'digital_annotation', routed: 'vision', scores: { recall: 0.8, precision: 0.8 } }, // mis-route
];
const s = summarizeByRegime(rows);

assert(Math.abs(s.byRegime.digital_annotation.recall - 0.9) < 1e-9, 'digital recall avg = 0.9');
assert(Math.abs(s.byRegime.raster.recall - 0.5) < 1e-9, 'raster recall avg = 0.5');
assert(Math.abs(s.overall.recall - (2.3 / 3)) < 1e-9, 'overall recall avg across all rows');
assert(s.routerAccuracy === 2 / 3, 'router accuracy = 2/3 (one mis-route)');

if (!failed) console.log('\n✅ all eval-routing tests passed\n');
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node test/test-eval-routing.js`
Expected: FAIL — `Cannot find module '../evals/lib/regime-summary.js'`

- [ ] **Step 4: Implement the aggregation helper**

Create `evals/lib/regime-summary.js`:
```js
/**
 * Aggregate eval rows by source-type regime + compute router accuracy.
 * Keeps recall/precision definitions identical to the overall harness — this
 * only adds a breakdown dimension so digital and raster numbers don't blend.
 *
 * Expected route per regime (Phase 1): digital_annotation → parse, else → vision.
 */
const expectedRoute = (sourceType) => (sourceType === 'digital_annotation' ? 'parse' : 'vision');

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function summarizeByRegime(rows) {
  const byRegime = {};
  for (const r of rows) {
    const k = r.expected_source || 'raster';
    (byRegime[k] ||= []).push(r);
  }
  const reduce = (rs) => ({
    count: rs.length,
    recall: avg(rs.map(r => r.scores.recall)),
    precision: avg(rs.map(r => r.scores.precision)),
  });
  const out = { byRegime: {}, overall: reduce(rows) };
  for (const [k, rs] of Object.entries(byRegime)) out.byRegime[k] = reduce(rs);

  const correct = rows.filter(r => r.routed === expectedRoute(r.expected_source || 'raster')).length;
  out.routerAccuracy = rows.length ? correct / rows.length : 0;
  return out;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node test/test-eval-routing.js`
Expected: PASS — all 4 assertions ✓

- [ ] **Step 6: Wire the probe + summary into run-eval.js**

In `evals/run-eval.js`:

(a) Add imports near the other imports (top of file):
```js
import { probeAnnotations } from '../src/utils/pdf-annotation-probe.js';
import { chooseExtractionPath } from '../src/services/job-service.js';
import { summarizeByRegime } from './lib/regime-summary.js';
```

(b) Inside the per-PDF loop (after `const label = ...` is loaded, before scoring),
record the probe + route for each case:
```js
    const probe = await probeAnnotations(join(PDFS_DIR, pdfFile));
    const routed = chooseExtractionPath(probe);
```

(c) Where each result is pushed (current line ~125), add the routing fields:
```js
    results.push({
      case_id: caseId, discipline: label.discipline, sheet: label.sheet,
      expected_source: label.source_type || 'raster', routed,
      scores, match_results: matchResults,
      extracted_count: allExtracted.length, extracted_markups: allExtracted,
    });
```

(d) After the existing aggregate block (current lines ~129–135), add and log:
```js
  const regime = summarizeByRegime(results);
  console.log('\nBy regime:');
  for (const [k, v] of Object.entries(regime.byRegime)) {
    console.log(`  ${k.padEnd(20)} n=${v.count}  recall=${v.recall.toFixed(3)}  precision=${v.precision.toFixed(3)}`);
  }
  console.log(`  router accuracy: ${(regime.routerAccuracy * 100).toFixed(0)}%`);
```

- [ ] **Step 7: Verify the eval runs end to end (no API needed for routing log)**

Run: `node evals/run-eval.js --only=case_012,case_001 --working-set` *(requires `ANTHROPIC_API_KEY`; if unavailable, instead confirm the routing log lines appear before the API call by reading the console output up to "By regime")*
Expected: output includes a `By regime:` block and a `router accuracy:` line; `case_012` shows `routed=parse`, `case_001` shows `routed=vision`.

- [ ] **Step 8: Commit**

```bash
git add evals/run-eval.js evals/lib/regime-summary.js evals/labels/case_011_walpole_c401_grading.json evals/labels/case_012_sanmarcos_s201_framing.json test/test-eval-routing.js
git commit -m "eval: segment recall/precision by source regime + router accuracy"
```

---

## Task 8: Register tests + revert leftover cruft

**Files:**
- Modify: `package.json` (test script)
- Modify: `client/package.json` (remove stray dep)

- [ ] **Step 1: Add the new test files to the test script**

In `package.json`, change the `test` script to:
```json
"test": "node test/test-extraction.js && node test/test-markup-postprocess.js && node test/test-annotation-probe.js && node test/test-parse-extraction.js && node test/test-eval-routing.js",
```

- [ ] **Step 2: Revert the stray client dependency**

In `client/package.json`, delete the line:
```json
    "redlineiq-backend": "file:..",
```

- [ ] **Step 3: Run the full backend test suite**

Run: `npm test`
Expected: all suites pass (the three new ones included). Note: `test-extraction.js` may require `ANTHROPIC_API_KEY`; if it does and the key is absent, run the offline subset instead: `node test/test-annotation-probe.js && node test/test-parse-extraction.js && node test/test-eval-routing.js` — all PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json client/package.json
git commit -m "chore: register parse tests, revert stray client backend dep"
```

---

## Task 9: Live end-to-end smoke test (manual, requires API key)

Confirms the whole digital path works against a real annotated PDF.

- [ ] **Step 1: Run the CLI extractor on the un-flattened San Marcos sheet**

Run: `node src/scripts/extract-cli.js evals/pdfs/case_012_sanmarcos_s201_framing.pdf`
*(If the CLI only accepts uploaded projects, instead start the server with `npm run dev`, POST the PDF to `/api/projects`, then POST `/api/projects/:id/extract` and watch the SSE log.)*
Expected: console shows `Source: digital_annotation (24 annotations) → parse`, then ~12 markups with sensible `markup_type` labels; no rasterization step runs.

- [ ] **Step 2: Sanity-check the output**

Confirm each extracted markup has: non-empty `markup_text`, a valid `markup_type`, and a `coordinates.rect`. Spot-check 2–3 texts against the sheet.

- [ ] **Step 3 (optional): Compare against the eval label**

Run: `node evals/run-eval.js --only=case_012`
Expected: `case_012` recall is high (≈1.0 on the 12 text notes) and `routed=parse`.

---

## Self-Review Notes

- **Spec coverage:** backend service ✓ (Tasks 2–5), text-only labeling ✓ (Task 3), coords captured/deferred ✓ (Tasks 3,6), eval regime-segmentation + router accuracy ✓ (Task 7), vision path untouched ✓ (Task 5 keeps the `else` branch identical), revert `file:..` ✓ (Task 8), `pdfjs-dist` added ✓ (Task 1).
- **Out of scope (per spec):** flattened-vector color parse (Phase 2), on-drawing highlight UI, per-page mixed routing, clean (un-watermarked) flattened eval fixtures.
- **Known assumption to watch in execution:** `parseAnnotationLayer` emits a markup only for annotations whose `contents` is non-empty (so case_012's 12 FreeText → 12 markups, the 12 Polygon clouds are skipped). If `getAnnotations` returns text on a subtype we didn't expect, the count test in Task 3 will catch it.
- **Env requirement for tests:** the new test files import modules that load `src/config/index.js`, which **throws at import if `ANTHROPIC_API_KEY` is unset** — even though the assertions are offline and make no API call. Ensure `.env` has the key (any non-empty value satisfies the import; only Task 9's live smoke test needs a *real* key). On PowerShell, a throwaway for a single run: `$env:ANTHROPIC_API_KEY='dummy'; node test/test-parse-extraction.js`.
- **Probe coordinate origin:** `rect` is in PDF points, bottom-left origin — the deferred highlight UI must flip Y against page height when mapping to the top-left-origin viewer.
