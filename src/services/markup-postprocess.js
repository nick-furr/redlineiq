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
