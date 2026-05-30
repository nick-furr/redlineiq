/**
 * Markup post-processing — precision fixes for tiled extraction.
 *
 * Pure functions, no I/O, no model calls. Applied to the merged per-tile
 * markup list to remove false positives the tiling fix introduced. See
 * docs/superpowers/specs/2026-05-29-tiling-precision-postprocessing-design.md
 */

// A markup whose whole point is "a red mark exists here" — no reviewer comment.
const MARKER_LEAD = /^red\s+(cloud|zigzag|circle|arrow|line|mark)/;

// Instruction / observation signal — if present, the markup carries meaning
// and must be kept regardless of any marker wording.
const ACTIONABLE =
  /\b(verify|confirm|check|add|provide|revise|missing|not\s+(shown|defined|called|dimensioned|located|detailed))\b/;

export function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\[partially illegible\]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function confidenceRank(conf) {
  return { high: 3, medium: 2, low: 1 }[conf] || 0;
}

/**
 * True only when a markup is BOTH a pure marker description AND has no
 * actionable content. Conservative by design — errs toward keeping.
 */
export function isLocationOnlyMarker(markup) {
  const raw = (markup?.markup_text || '').toLowerCase().trim();
  if (!raw) return false; // empty text isn't our concern here
  return MARKER_LEAD.test(raw) && !ACTIONABLE.test(raw);
}

export function dropLocationOnlyMarkers(markups) {
  return markups.filter((m) => !isLocationOnlyMarker(m));
}

/** Token-overlap similarity on normalized words. Order-insensitive. */
export function jaccardSimilarity(a, b) {
  const ta = new Set(normalizeText(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const token of ta) if (tb.has(token)) intersection++;
  const union = ta.size + tb.size - intersection;
  return intersection / union;
}

/**
 * Merge near-duplicate markups (e.g. the same real markup reworded across an
 * overlapping tile). Keeps the higher-confidence copy. Processes in input
 * order, so callers should pass markups in a deterministic (tile) order.
 */
export function dedupeMarkups(markups, { threshold = 0.6 } = {}) {
  const kept = [];
  for (const markup of markups) {
    const text = markup.markup_text || '';
    let dupIndex = -1;
    // Match against the first similar kept item only. At tens of markups per
    // sheet this is sufficient; flattening triple-rewordings would need a 2nd pass.
    for (let i = 0; i < kept.length; i++) {
      if (jaccardSimilarity(text, kept[i].markup_text || '') >= threshold) {
        dupIndex = i;
        break;
      }
    }
    if (dupIndex === -1) {
      kept.push(markup);
    } else if (confidenceRank(markup.confidence) > confidenceRank(kept[dupIndex].confidence)) {
      kept[dupIndex] = markup; // replace with the higher-confidence duplicate
    }
  }
  return kept;
}
