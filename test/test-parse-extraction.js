/**
 * Test: parse-extraction-service. Annotation-layer parsing + pure assembly
 * helpers are offline (real eval PDFs, no API). Run: node test/test-parse-extraction.js
 */
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import {
  parseAnnotationLayer,
  parseLabelResponse,
  applyLabels,
  assembleResult,
} from '../src/services/parse-extraction-service.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const pdf = (name) => resolve(HERE, '../evals/pdfs', name);

let failed = false;
function assert(cond, msg) {
  if (!cond) { console.error(`  ✗ FAIL: ${msg}`); failed = true; process.exitCode = 1; }
  else { console.log(`  ✓ ${msg}`); }
}

console.log('\n🧪 parse-extraction: parseAnnotationLayer\n');

const pages = await parseAnnotationLayer(pdf('case_012_sanmarcos_s201_framing.pdf'));
const all = pages.flatMap(p => p.markups);
assert(pages.length === 1, 'case_012 → 1 page');
assert(all.length === 12, `case_012 → 12 text markups (got ${all.length})`);
assert(all.every(m => typeof m.markup_text === 'string' && m.markup_text.length > 0), 'every markup has non-empty text');
assert(all.every(m => Array.isArray(m.coordinates.rect) && m.coordinates.rect.length === 4), 'every markup has a 4-tuple rect');
assert(all.every(m => m.coordinates.page === 1), 'coordinates.page is set');

console.log('\n🧪 parse-extraction: pure label helpers\n');

const raw = [{ id: 'MK-001', markup_text: 'Delete this wall' }, { id: 'MK-002', markup_text: 'verify?' }];
const labels = parseLabelResponse('```json\n[{"id":"MK-001","markup_type":"delete","related_to":null,"confidence":"high","ambiguous":false},{"id":"MK-002","markup_type":"clarify","related_to":null,"confidence":"high","ambiguous":true}]\n```');
assert(labels.length === 2, 'parseLabelResponse strips fences and parses 2 labels');

const merged = applyLabels(raw, labels);
assert(merged[0].markup_type === 'delete' && merged[1].ambiguous === true, 'applyLabels merges type/ambiguous by id');
assert(merged[1].markup_type === 'clarify', 'applyLabels keeps second item type');

console.log('\n🧪 parse-extraction: assembleResult\n');

const result = assembleResult([{ page_number: 1, drawing_reference: 'S-201', drawing_title: 'Framing', markups: merged }]);
assert(result.totalMarkups === 2, 'assembleResult totalMarkups === 2');
assert(result.allMarkups[0].id === 'MK-001' && result.allMarkups[1].id === 'MK-002', 'assembleResult renumbers IDs sequentially');
assert(result.stats.byType.delete === 1 && result.stats.byType.clarify === 1, 'assembleResult stats.byType counts');
assert(result.stats.ambiguousCount === 1, 'assembleResult ambiguousCount === 1');

if (!failed) console.log('\n✅ all parse-extraction tests passed\n');
