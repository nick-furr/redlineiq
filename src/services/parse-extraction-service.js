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
      // pdfjs 5.x carries the note text in contentsObj.str; older builds used the
      // flat `contents` string. Fall back so this survives a dependency bump.
      const text = (a.contentsObj?.str || a.contents || '').trim();
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
