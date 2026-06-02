/**
 * inspect-pdf.js — THROWAWAY DIAGNOSTIC (not part of the app)
 *
 * Answers one question: for a given PDF, is the markup recoverable by parsing,
 * or is vision the only option? Run it on an un-flattened file and a flattened
 * version of the same file to see which regime each falls into.
 *
 *   node inspect-pdf.js <file.pdf> [moreFiles.pdf ...]
 *
 * Regime read:
 *   - getAnnotations has markup objects        → un-flattened   → annotation parse
 *   - no annotations, but COLORED text present → flattened-vector → color-aware parse
 *   - no annotations, no/garbage text          → flattened-raster → vision only
 *
 * Imports pdfjs from the client's installed copy on purpose — this is a spike,
 * so we don't add a root dependency until the build is actually decided.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as pdfjs from './client/node_modules/pdfjs-dist/legacy/build/pdf.mjs';

// pdfjs markup annotation subtypes — everything else (Link, Popup, Widget) is
// structural chrome that exists in plenty of plain PDFs, so it doesn't count.
const MARKUP_SUBTYPES = new Set([
  'FreeText', 'Square', 'Circle', 'Polygon', 'PolyLine', 'Line',
  'Ink', 'Highlight', 'StrikeOut', 'Underline', 'Squiggly', 'Text', 'Stamp',
]);

const fmtColor = (rgb) =>
  Array.isArray(rgb) ? `rgb(${rgb.map((n) => Math.round(n)).join(',')})` : String(rgb);

// A color counts as "ink that isn't the drawing" when it's clearly not black and
// not a near-black gray — i.e. a plausible redline. Loose on purpose; we only
// need the signal "is there non-substrate-colored text here at all".
function isLikelyRedline([r, g, b]) {
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const isGrayish = maxChannel - minChannel < 20; // r≈g≈b → black/gray substrate
  return !(isGrayish && maxChannel < 60);
}

/**
 * Walk a page's operator list, tracking the active fill color, and bucket every
 * text-showing op by the color it was drawn in. This is the only way to tell
 * "red note baked into the page" apart from "black drawing text" once a file is
 * flattened — getTextContent alone gives you the strings but not their color.
 */
async function textColorBreakdown(page) {
  const opList = await page.getOperatorList();
  const { OPS } = pdfjs;
  let fill = [0, 0, 0];
  const byColor = new Map(); // "r,g,b" → count of text ops drawn in it

  // pdfjs 5.x passes RGB color as a hex string ("#rrggbb"), not [r,g,b].
  const hexToRgb = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (fn === OPS.setFillRGBColor) {
      fill = typeof args[0] === 'string' ? hexToRgb(args[0]) : args.slice(0, 3);
    } else if (fn === OPS.setFillGray) {
      const g = args[0] <= 1 ? args[0] * 255 : args[0];
      fill = [g, g, g];
    } else if (fn === OPS.setFillCMYKColor) {
      const [c, m, y, k] = args;
      fill = [255 * (1 - c) * (1 - k), 255 * (1 - m) * (1 - k), 255 * (1 - y) * (1 - k)];
    } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
      const key = fill.map((n) => Math.round(n)).join(',');
      byColor.set(key, (byColor.get(key) || 0) + 1);
    }
  }
  return byColor;
}

async function inspect(path) {
  console.log(`\n${'═'.repeat(70)}\n  ${path}\n${'═'.repeat(70)}`);

  let data;
  try {
    data = new Uint8Array(await readFile(path));
  } catch (err) {
    console.error(`  ✗ could not read file: ${err.message}`);
    return;
  }

  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  console.log(`  pages: ${doc.numPages}`);

  let totalMarkupAnnots = 0;
  let totalTextItems = 0;
  let totalRedlineText = 0;
  const annotSubtypes = new Map();
  const annotColors = new Map();
  const textColorTotals = new Map(); // "r,g,b" → total text ops across all pages

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);

    const annots = await page.getAnnotations({ intent: 'display' });
    for (const a of annots) {
      if (!MARKUP_SUBTYPES.has(a.subtype)) continue;
      totalMarkupAnnots++;
      annotSubtypes.set(a.subtype, (annotSubtypes.get(a.subtype) || 0) + 1);
      if (a.color) annotColors.set(fmtColor(Array.from(a.color)), true);
    }

    const text = await page.getTextContent();
    totalTextItems += text.items.length;

    const colors = await textColorBreakdown(page);
    for (const [key, count] of colors) {
      textColorTotals.set(key, (textColorTotals.get(key) || 0) + count);
      const rgb = key.split(',').map(Number);
      if (isLikelyRedline(rgb)) totalRedlineText += count;
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────
  console.log(`\n  ANNOTATIONS (markup subtypes only): ${totalMarkupAnnots}`);
  if (totalMarkupAnnots) {
    for (const [sub, n] of [...annotSubtypes].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${sub.padEnd(12)} ${n}`);
    }
    if (annotColors.size) console.log(`    colors: ${[...annotColors.keys()].join(', ')}`);
  }

  console.log(`\n  TEXT CONTENT: ${totalTextItems} text items`);
  console.log(`    text drawn in non-black/non-gray color (likely redline): ${totalRedlineText} ops`);

  // Color histogram of text ops — the real test of separability. If the redline
  // red is a small distinct cluster apart from the substrate's colors, color
  // filtering can isolate it; if red bleeds across the whole sheet, it can't.
  console.log(`\n  TEXT COLOR HISTOGRAM (top 12 by op count):`);
  const sorted = [...textColorTotals].sort((a, b) => b[1] - a[1]).slice(0, 12);
  for (const [key, count] of sorted) {
    const rgb = key.split(',').map(Number);
    const tag = key === '0,0,0' ? 'black (substrate)'
      : isLikelyRedline(rgb) ? (key === '255,0,0' ? '◀ PURE RED (redline?)' : 'colored') : 'gray';
    console.log(`    rgb(${key.padEnd(13)}) ${String(count).padStart(5)}  ${tag}`);
  }

  // ── Verdict ─────────────────────────────────────────────────────────────
  let regime, build;
  if (totalMarkupAnnots > 0) {
    regime = 'UN-FLATTENED (live annotation objects present)';
    build = 'annotation parse — the easy near-100% win';
  } else if (totalRedlineText > 0) {
    regime = 'FLATTENED-TO-VECTOR (no annotations, but colored text survives)';
    build = 'color-aware content-stream parse — the real field lever';
  } else if (totalTextItems > 0) {
    regime = 'FLATTENED, text present but all black/gray';
    build = 'ambiguous — redline text indistinguishable from substrate by color; likely vision';
  } else {
    regime = 'FLATTENED-TO-RASTER (no annotations, no text)';
    build = 'vision only — parsing cannot help';
  }
  console.log(`\n  → REGIME: ${regime}`);
  console.log(`  → BUILD:  ${build}\n`);
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node inspect-pdf.js <file.pdf> [more.pdf ...]');
  process.exit(1);
}

for (const f of files) {
  try {
    await inspect(f);
  } catch (err) {
    console.error(`\n  ✗ failed on ${f}: ${err.message}`);
  }
}
