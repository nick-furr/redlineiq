/**
 * RedlineIQ Data Models
 * 
 * Formalized from prompt iteration in Anthropic Console Workbench.
 * Schema fields: id, markup_text, markup_type, drawing_reference,
 * location_on_drawing, related_to (cloud-to-text linking), confidence, ambiguous
 */

// ─── Markup Types ──────────────────────────────────────────────
// These map to the kinds of redline annotations a drafter sees on plan sets.
export const MARKUP_TYPES = {
  ADD: 'add',           // New element to be added
  DELETE: 'delete',     // Element to be removed
  MOVE: 'move',         // Element to be relocated
  MODIFY: 'modify',     // Change to existing element (resize, reshape, etc.)
  DIMENSION: 'dimension', // Dimension change or correction
  NOTE: 'note',         // General note or instruction
  CLARIFY: 'clarify',   // Request for clarification / ambiguous intent
  DETAIL: 'detail',     // Reference to a detail or section
};

// ─── Confidence Levels ─────────────────────────────────────────
export const CONFIDENCE = {
  HIGH: 'high',       // Clearly legible, unambiguous markup
  MEDIUM: 'medium',   // Mostly legible, reasonable interpretation
  LOW: 'low',         // Partially illegible, best-guess interpretation
};

// ─── Checklist Item Status ─────────────────────────────────────
// These are the drafter-facing statuses in the checklist UI.
export const STATUS = {
  PENDING: 'pending',       // Not yet addressed
  IN_PROGRESS: 'in_progress', // Drafter is working on it
  DONE: 'done',             // Completed in CAD
  FLAGGED: 'flagged',       // Flagged for clarification with engineer
  SKIPPED: 'skipped',       // Intentionally skipped (with reason)
};

// ─── Core Data Structures ──────────────────────────────────────

/**
 * A single extracted markup annotation from a redlined drawing.
 * This is what the Claude API returns for each annotation it finds.
 * 
 * @typedef {Object} ExtractedMarkup
 * @property {string} id - Unique identifier (e.g., "MK-001")
 * @property {string} markup_text - The text content of the markup. 
 *   Uses "[illegible]" for unreadable handwriting, 
 *   "[partially illegible]" with best guess for partial reads.
 * @property {string} markup_type - One of MARKUP_TYPES values
 * @property {string} drawing_reference - Sheet/drawing identifier (e.g., "A-201", "C-3.1")
 * @property {string} location_on_drawing - Spatial description (e.g., "upper-left quadrant", "near grid line B-4")
 * @property {string|null} related_to - ID of related markup for cloud-to-text linking.
 *   When a revision cloud circles an area and a separate text note explains the change,
 *   this field links them together.
 * @property {string} confidence - One of CONFIDENCE values
 * @property {boolean} ambiguous - Whether the markup intent is unclear,
 *   even if the text is legible. E.g., "verify" with no context.
 * @property {string} [raw_interpretation] - For low-confidence items, 
 *   the literal characters/marks as seen, before interpretation.
 */

/**
 * Example of what Claude returns for a single page:
 * {
 *   "page_number": 1,
 *   "drawing_reference": "A-201",
 *   "drawing_title": "Interior Elevations - Kitchen",
 *   "total_markups_found": 8,
 *   "markups": [
 *     {
 *       "id": "MK-001",
 *       "markup_text": "Move outlet 6\" to the left",
 *       "markup_type": "move",
 *       "drawing_reference": "A-201",
 *       "location_on_drawing": "center-right, near kitchen island elevation",
 *       "related_to": null,
 *       "confidence": "high",
 *       "ambiguous": false
 *     },
 *     {
 *       "id": "MK-002",
 *       "markup_text": "[partially illegible] ...add blocking at 48\" AFF",
 *       "markup_type": "add",
 *       "drawing_reference": "A-201",
 *       "location_on_drawing": "upper-left, wall section",
 *       "related_to": "MK-003",
 *       "confidence": "low",
 *       "ambiguous": true,
 *       "raw_interpretation": "ad blckg @ 48 AFF"
 *     }
 *   ]
 * }
 */

/**
 * A checklist item wraps an extracted markup with drafter workflow state.
 * This is the frontend-facing object stored in the database.
 * 
 * @typedef {Object} ChecklistItem
 * @property {string} id - Same as ExtractedMarkup.id
 * @property {ExtractedMarkup} markup - The extracted annotation data
 * @property {string} status - One of STATUS values
 * @property {string|null} drafter_notes - Free-text notes from the drafter
 * @property {string|null} clarification_request - Message to engineer if flagged
 * @property {string|null} clarification_response - Engineer's reply (v2)
 * @property {string} created_at - ISO timestamp
 * @property {string} updated_at - ISO timestamp
 */

/**
 * A project represents a single plan set being processed.
 * 
 * @typedef {Object} Project
 * @property {string} id - UUID
 * @property {string} name - User-given project name
 * @property {string} pdf_filename - Original uploaded filename
 * @property {string} pdf_path - Server path to stored PDF
 * @property {number} total_pages - Number of pages in the PDF
 * @property {number} pages_processed - How many pages have been extracted
 * @property {ChecklistItem[]} checklist - All extracted markup items
 * @property {Object} summary - Computed progress stats
 * @property {number} summary.total - Total items
 * @property {number} summary.done - Completed items
 * @property {number} summary.flagged - Flagged for clarification
 * @property {number} summary.pending - Not yet addressed
 * @property {string} created_at - ISO timestamp
 * @property {string} updated_at - ISO timestamp
 */

/**
 * The JSON schema sent to Claude in the extraction prompt
 * to enforce structured output.
 */
export const EXTRACTION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    page_number: { type: 'integer' },
    drawing_reference: { type: 'string' },
    drawing_title: { type: 'string' },
    total_markups_found: { type: 'integer' },
    markups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          markup_text: { type: 'string' },
          markup_type: {
            type: 'string',
            enum: Object.values(MARKUP_TYPES),
          },
          drawing_reference: { type: 'string' },
          location_on_drawing: { type: 'string' },
          related_to: { type: ['string', 'null'] },
          confidence: {
            type: 'string',
            enum: Object.values(CONFIDENCE),
          },
          ambiguous: { type: 'boolean' },
          raw_interpretation: { type: 'string' },
        },
        required: [
          'id', 'markup_text', 'markup_type', 'drawing_reference',
          'location_on_drawing', 'related_to', 'confidence', 'ambiguous',
        ],
      },
    },
  },
  required: ['page_number', 'drawing_reference', 'drawing_title', 'total_markups_found', 'markups'],
};

/**
 * Helper: Create a new ChecklistItem from an extracted markup
 */
export function createChecklistItem(extractedMarkup) {
  const now = new Date().toISOString();
  return {
    id: extractedMarkup.id,
    markup: extractedMarkup,
    status: extractedMarkup.ambiguous ? STATUS.FLAGGED : STATUS.PENDING,
    drafter_notes: null,
    clarification_request: extractedMarkup.ambiguous
      ? `Auto-flagged: markup intent is unclear. Confidence: ${extractedMarkup.confidence}`
      : null,
    clarification_response: null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Helper: Compute project summary stats from checklist items
 */
export function computeSummary(checklistItems) {
  const summary = {
    total: checklistItems.length,
    done: 0,
    flagged: 0,
    pending: 0,
    in_progress: 0,
    skipped: 0,
    high_confidence: 0,
    low_confidence: 0,
    ambiguous: 0,
  };

  for (const item of checklistItems) {
    // Status counts
    if (item.status === STATUS.DONE) summary.done++;
    else if (item.status === STATUS.FLAGGED) summary.flagged++;
    else if (item.status === STATUS.PENDING) summary.pending++;
    else if (item.status === STATUS.IN_PROGRESS) summary.in_progress++;
    else if (item.status === STATUS.SKIPPED) summary.skipped++;

    // Confidence & ambiguity counts
    if (item.markup.confidence === CONFIDENCE.HIGH) summary.high_confidence++;
    if (item.markup.confidence === CONFIDENCE.LOW) summary.low_confidence++;
    if (item.markup.ambiguous) summary.ambiguous++;
  }

  summary.percent_complete = summary.total > 0
    ? Math.round((summary.done / summary.total) * 100)
    : 0;

  return summary;
}
