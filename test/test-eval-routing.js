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
