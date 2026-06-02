/**
 * Test: PDF annotation probe (source-type router).
 * Uses real eval PDFs, no API. Run: node test/test-annotation-probe.js
 */
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { probeAnnotations, MARKUP_SUBTYPES } from '../src/utils/pdf-annotation-probe.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const pdf = (name) => resolve(HERE, '../evals/pdfs', name);

let failed = false;
function assert(cond, msg) {
  if (!cond) { console.error(`  ✗ FAIL: ${msg}`); failed = true; process.exitCode = 1; }
  else { console.log(`  ✓ ${msg}`); }
}

console.log('\n🧪 pdf-annotation-probe\n');

const digital = await probeAnnotations(pdf('case_012_sanmarcos_s201_framing.pdf'));
assert(digital.sourceType === 'digital_annotation', 'case_012 → digital_annotation');
assert(digital.markupCount === 24, `case_012 markupCount is 24 (got ${digital.markupCount})`);
assert(Array.isArray(digital.perPageCounts) && digital.perPageCounts[0] === 24, 'case_012 perPageCounts[0] === 24');

const raster = await probeAnnotations(pdf('case_001_c301_site_layout.pdf'));
assert(raster.sourceType === 'raster', 'case_001 (rasterized) → raster');
assert(raster.markupCount === 0, 'case_001 markupCount is 0');

assert(MARKUP_SUBTYPES.has('FreeText') && !MARKUP_SUBTYPES.has('Link'), 'subtype set includes FreeText, excludes Link');

console.log('\n🧪 job-service: chooseExtractionPath\n');
const { chooseExtractionPath } = await import('../src/services/job-service.js');
assert(chooseExtractionPath({ sourceType: 'digital_annotation' }) === 'parse', 'digital_annotation → parse');
assert(chooseExtractionPath({ sourceType: 'raster' }) === 'vision', 'raster → vision');

if (!failed) console.log('\n✅ all probe tests passed\n');
