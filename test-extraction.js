/**
 * Test: Extraction Pipeline
 * 
 * Tests the data model, helpers, and extraction flow
 * without making real API calls.
 */

import {
  MARKUP_TYPES,
  CONFIDENCE,
  STATUS,
  createChecklistItem,
  computeSummary,
} from '../src/models/markup.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${message}`);
  }
}

console.log('\n🧪 RedlineIQ Tests\n');

// ─── Test: Markup Types ────────────────────────────────────────
console.log('Markup Types:');
assert(Object.keys(MARKUP_TYPES).length === 8, 'Should have 8 markup types');
assert(MARKUP_TYPES.ADD === 'add', 'ADD type is "add"');
assert(MARKUP_TYPES.MOVE === 'move', 'MOVE type is "move"');
assert(MARKUP_TYPES.CLARIFY === 'clarify', 'CLARIFY type is "clarify"');

// ─── Test: createChecklistItem ─────────────────────────────────
console.log('\nChecklist Item Creation:');

const normalMarkup = {
  id: 'MK-001',
  markup_text: 'Move outlet 6" to the left',
  markup_type: 'move',
  drawing_reference: 'A-201',
  location_on_drawing: 'center-right, near kitchen island',
  related_to: null,
  confidence: 'high',
  ambiguous: false,
};

const item1 = createChecklistItem(normalMarkup);
assert(item1.status === STATUS.PENDING, 'Non-ambiguous item starts as PENDING');
assert(item1.clarification_request === null, 'Non-ambiguous item has no clarification request');
assert(item1.markup === normalMarkup, 'Markup data is preserved');

const ambiguousMarkup = {
  id: 'MK-002',
  markup_text: '[partially illegible] ...add blocking at 48" AFF',
  markup_type: 'add',
  drawing_reference: 'A-201',
  location_on_drawing: 'upper-left, wall section',
  related_to: 'MK-003',
  confidence: 'low',
  ambiguous: true,
  raw_interpretation: 'ad blckg @ 48 AFF',
};

const item2 = createChecklistItem(ambiguousMarkup);
assert(item2.status === STATUS.FLAGGED, 'Ambiguous item auto-flags');
assert(item2.clarification_request !== null, 'Ambiguous item has clarification request');
assert(item2.clarification_request.includes('low'), 'Clarification mentions confidence level');

// ─── Test: computeSummary ──────────────────────────────────────
console.log('\nSummary Computation:');

const items = [
  { ...item1, status: STATUS.DONE, markup: { confidence: 'high', ambiguous: false } },
  { ...item2, status: STATUS.FLAGGED, markup: { confidence: 'low', ambiguous: true } },
  { ...createChecklistItem({ ...normalMarkup, id: 'MK-003', confidence: 'medium', ambiguous: false }), status: STATUS.PENDING },
  { ...createChecklistItem({ ...normalMarkup, id: 'MK-004', confidence: 'high', ambiguous: false }), status: STATUS.IN_PROGRESS },
];

const summary = computeSummary(items);
assert(summary.total === 4, 'Total is 4');
assert(summary.done === 1, 'Done is 1');
assert(summary.flagged === 1, 'Flagged is 1');
assert(summary.pending === 1, 'Pending is 1');
assert(summary.in_progress === 1, 'In progress is 1');
assert(summary.high_confidence === 2, 'High confidence count correct');
assert(summary.low_confidence === 1, 'Low confidence count correct');
assert(summary.ambiguous === 1, 'Ambiguous count correct');
assert(summary.percent_complete === 25, 'Percent complete is 25%');

// ─── Test: Empty summary ───────────────────────────────────────
console.log('\nEdge Cases:');
const emptySummary = computeSummary([]);
assert(emptySummary.total === 0, 'Empty checklist total is 0');
assert(emptySummary.percent_complete === 0, 'Empty checklist percent is 0');

// ─── Test: Extraction response schema ──────────────────────────
console.log('\nExtraction Schema:');
import { EXTRACTION_RESPONSE_SCHEMA } from '../src/models/markup.js';
assert(EXTRACTION_RESPONSE_SCHEMA.type === 'object', 'Schema is an object');
assert(EXTRACTION_RESPONSE_SCHEMA.properties.markups.type === 'array', 'Markups field is array');
assert(
  EXTRACTION_RESPONSE_SCHEMA.properties.markups.items.properties.markup_type.enum.length === 8,
  'Schema has all 8 markup type enums'
);

console.log('\n✅ All tests complete\n');
