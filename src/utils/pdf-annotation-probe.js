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
