/**
 * Test: Markup post-processing (precision fixes for tiled extraction)
 * Pure functions, no API calls. Run: node test/test-markup-postprocess.js
 */
import {
  isLocationOnlyMarker,
  dropLocationOnlyMarkers,
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

console.log('\n✅ Task 1 tests complete\n');
