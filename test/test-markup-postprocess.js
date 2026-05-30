/**
 * Test: Markup post-processing (precision fixes for tiled extraction)
 * Pure functions, no API calls. Run: node test/test-markup-postprocess.js
 */
import {
  isLocationOnlyMarker,
  dropLocationOnlyMarkers,
  jaccardSimilarity,
  dedupeMarkups,
  assignSequentialIds,
  postprocessMergedMarkups,
} from '../src/services/markup-postprocess.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${message}`);
  }
}

const mk = (markup_text, extra = {}) => ({
  id: 'MK-000', markup_text, markup_type: 'clarify', confidence: 'high',
  related_to: null, ...extra,
});

console.log('\n🧪 markup-postprocess: dropLocationOnlyMarkers\n');

// DROP: pure marker descriptions with no comment
assert(isLocationOnlyMarker(mk('Red cloud around pier diameter note')), 'drops "Red cloud around pier diameter note"');
assert(isLocationOnlyMarker(mk('Red cloud markup')), 'drops "Red cloud markup"');
assert(isLocationOnlyMarker(mk('Red zigzag line along upper edge')), 'drops "Red zigzag line along upper edge"');
assert(isLocationOnlyMarker(mk('Red cloud marking empty area')), 'drops "Red cloud marking empty area"');
assert(isLocationOnlyMarker(mk('Red cloud around C8x11.5 @ 2\'-0" O.C. beam specification')), 'drops cloud-around-beam-spec (location only)');

// KEEP: has actionable content (even if it mentions a cloud)
assert(!isLocationOnlyMarker(mk('Red cloud around recess slab — fire-brick extents not dimensioned, add limits')), 'keeps cloud WITH actionable clause');
assert(!isLocationOnlyMarker(mk('Fire-brick recess extents not dimensioned — add limits')), 'keeps real markup "…not dimensioned — add limits"');
assert(!isLocationOnlyMarker(mk('Beam marks S1-S3 not defined — add member schedule')), 'keeps "…not defined — add member schedule"');
assert(!isLocationOnlyMarker(mk('SOG reinf not verified for fire-apparatus floor loading — confirm')), 'keeps "…not verified — confirm"');
assert(!isLocationOnlyMarker(mk('access opening not shown — per 1/S301')), 'keeps "access opening not shown" (no red-marker lead)');

// OUT OF SCOPE: substrate text survives (handled by the phase-2 prompt rule, not here)
assert(!isLocationOnlyMarker(mk('C8x11.5 @ 2\'-0" O.C.')), 'substrate text survives (out of scope)');
assert(!isLocationOnlyMarker(mk('HATCHED AREAS (TYP.)')), 'substrate text survives (out of scope)');

// Filter over a list keeps the right count
const list = [
  mk('Red cloud markup'),
  mk('Fire-brick recess extents not dimensioned — add limits'),
  mk('Red zigzag line along upper edge'),
  mk('Beam marks S1-S3 not defined — add member schedule'),
];
const kept = dropLocationOnlyMarkers(list);
assert(kept.length === 2, 'dropLocationOnlyMarkers keeps 2 of 4');
assert(kept.every(m => m.markup_text.includes('not')), 'survivors are the actionable ones');

console.log('\n🧪 markup-postprocess: dedupeMarkups\n');

// Jaccard sanity
assert(jaccardSimilarity('access opening not shown', 'access opening not shown') === 1, 'identical text → 1.0');
assert(jaccardSimilarity('', 'anything') === 0, 'empty text → 0');

// The real m5 cross-tile dup (different wording, same markup) must merge
const m5pair = [
  mk('Floor access opening framing not shown — verify per 1/S301', { confidence: 'high' }),
  mk('access opening not shown — per 1/S301', { confidence: 'medium' }),
];
const m5merged = dedupeMarkups(m5pair, { threshold: 0.6 });
assert(m5merged.length === 1, 'm5 reworded dup merges to 1');
assert(m5merged[0].confidence === 'high', 'merge keeps higher-confidence copy');

// Distinct markups that share a few tokens must NOT merge
const distinct = [
  mk('Beam marks S1-S3 not defined — add member schedule'),
  mk('Pier sizes not called out per location — add pier schedule'),
];
assert(dedupeMarkups(distinct, { threshold: 0.6 }).length === 2, 'distinct markups are not over-merged');

// Equal confidence → the first-seen copy is kept (strict > on confidence rank)
const tiePair = [
  mk('access opening not shown — verify per S301', { confidence: 'high' }),
  mk('Floor access opening not shown — verify per 1/S301', { confidence: 'high' }),
];
const tied = dedupeMarkups(tiePair, { threshold: 0.6 });
assert(tied.length === 1 && tied[0] === tiePair[0], 'equal confidence → first-seen survives');

console.log('\n🧪 markup-postprocess: assignSequentialIds + pipeline\n');

// Renumber to unique sequential IDs and remap related_to
const dupIds = [
  mk('first', { id: 'MK-001', related_to: null }),
  mk('second', { id: 'MK-001', related_to: 'MK-002' }), // collides + dangling-looking ref
  mk('third', { id: 'MK-002', related_to: null }),
];
const renumbered = assignSequentialIds(dupIds);
const ids = renumbered.map(m => m.id);
assert(new Set(ids).size === 3, 'all IDs unique after renumber');
assert(ids.join(',') === 'MK-001,MK-002,MK-003', 'IDs are sequential MK-001..MK-003');
assert(renumbered[1].related_to === 'MK-003', 'related_to remapped to the markup formerly MK-002');

// Full pipeline on a mixed batch: drop → dedupe → renumber
const batch = [
  mk('Red cloud markup', { id: 'MK-001' }),                                            // dropped
  mk('Floor access opening framing not shown — verify per 1/S301', { id: 'MK-002', confidence: 'high' }),
  mk('access opening not shown — per 1/S301', { id: 'MK-003', confidence: 'medium' }), // merged into MK-002
  mk('Beam marks S1-S3 not defined — add member schedule', { id: 'MK-004' }),
];
const out = postprocessMergedMarkups(batch);
assert(out.length === 2, 'pipeline: 4 → 2 (1 dropped, 1 merged)');
assert(out.map(m => m.id).join(',') === 'MK-001,MK-002', 'pipeline reassigns clean sequential IDs');
assert(out.some(m => m.markup_text.startsWith('Floor access')), 'merged survivor is the higher-confidence m5 copy');

console.log('\n✅ All markup-postprocess tests complete\n');
