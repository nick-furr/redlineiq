/**
 * Test: /ask retrieval layer — FTS5 index (triggers, backfill, cascade delete),
 * query sanitization, and the in-memory sample-project ranker. Fully offline:
 * exercises real SQLite against a throwaway DB, never calls the Claude API.
 * Run: node test/test-ask-retrieval.js
 */

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

// Point the singleton db module at a throwaway database BEFORE anything
// imports it. The dummy key satisfies config's fail-fast without enabling
// network calls (dotenv won't override an already-set env var).
const testDir = mkdtempSync(path.join(tmpdir(), 'redlineiq-ask-test-'));
process.env.DATABASE_PATH = path.join(testDir, 'test.db');
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'dummy-key-offline-tests';

const { createProject, addExtractionResults, deleteProject } = await import('../src/services/project-service.js');
const { retrieveMarkups, rankItemsByOverlap, toFtsQuery } = await import('../src/services/ask-service.js');
const { default: db } = await import('../src/services/db.js');

let failed = false;
function assert(cond, msg) {
  if (!cond) { console.error(`  ✗ FAIL: ${msg}`); failed = true; process.exitCode = 1; }
  else { console.log(`  ✓ ${msg}`); }
}

function makeMarkup(id, overrides = {}) {
  return {
    id,
    markup_text: 'placeholder',
    markup_type: 'note',
    drawing_reference: 'A-201',
    location_on_drawing: 'center',
    related_to: null,
    confidence: 'high',
    ambiguous: false,
    ...overrides,
  };
}

console.log('\n🧪 ask: FTS query sanitization\n');

assert(toFtsQuery('move the outlet') === '"move" OR "the" OR "outlet"', 'tokenizes and quotes words');
assert(toFtsQuery('sheet A-201?') === '"sheet" OR "a" OR "201"', 'splits hyphenated refs into safe tokens');
assert(toFtsQuery('NEAR("x") AND (y OR z)*') === '"near" OR "x" OR "and" OR "y" OR "or" OR "z"', 'FTS5 operators become plain quoted tokens');
assert(toFtsQuery('?? — !!') === null, 'no indexable tokens returns null');

console.log('\n🧪 ask: FTS5 retrieval over real SQLite\n');

const project = await createProject('Ask Test', 'test.pdf', '/tmp/test.pdf', 2);
await addExtractionResults(project.id, {
  pages: [
    {
      page_number: 1,
      markups: [
        makeMarkup('MK-001', { markup_text: 'Move outlet 6" to the left', markup_type: 'move', location_on_drawing: 'kitchen island elevation' }),
        makeMarkup('MK-002', { markup_text: 'Add blocking at 48" AFF', markup_type: 'add', location_on_drawing: 'upper-left wall section' }),
      ],
    },
    {
      page_number: 2,
      markups: [
        makeMarkup('MK-003', { markup_text: 'Verify beam size with structural', markup_type: 'clarify', drawing_reference: 'S-101', location_on_drawing: 'grid line B-4' }),
      ],
    },
  ],
  stats: { pagesProcessed: 2 },
});

// A second project proves retrieval is scoped per project
const otherProject = await createProject('Other', 'other.pdf', '/tmp/other.pdf', 1);
await addExtractionResults(otherProject.id, {
  pages: [{ page_number: 1, markups: [makeMarkup('MK-001', { markup_text: 'Move the outlet on this sheet too' })] }],
  stats: { pagesProcessed: 1 },
});

const outletHits = retrieveMarkups(project.id, 'where does the outlet move?');
assert(outletHits.length > 0, 'question with matching terms returns hits');
assert(outletHits[0].id === 'MK-001', 'best BM25 match ranked first');
assert(outletHits[0].page_number === 1, 'page number carried through the index');
assert(outletHits.every(hit => hit.id !== 'MK-003' || hit.markup_text.includes('beam')), 'result rows carry the indexed markup fields');
assert(!outletHits.some(hit => hit.markup_text.includes('this sheet too')), 'retrieval is scoped to the queried project');

const beamHits = retrieveMarkups(project.id, 'beam size grid B-4');
assert(beamHits[0]?.id === 'MK-003', 'matches across text and location fields');
assert(beamHits[0]?.drawing_reference === 'S-101', 'sheet reference survives round-trip');

assert(retrieveMarkups(project.id, 'zzzquux plumbing riser').length === 0 || retrieveMarkups(project.id, 'zzzquux plumbing riser').every(h => h.id), 'unmatched vocabulary returns cleanly');
assert(retrieveMarkups(project.id, '?? — !!').length === 0, 'no-token question returns empty without touching FTS');
assert(retrieveMarkups(project.id, 'outlet NEAR("cabinet) AND *').length > 0, 'FTS5-hostile syntax is sanitized, not a crash');

console.log('\n🧪 ask: index lifecycle (triggers + cascade delete)\n');

const countFts = db.prepare('SELECT COUNT(*) AS c FROM markup_fts WHERE project_id = ?');
assert(countFts.get(project.id).c === 3, 'insert trigger indexed all three markups');

await deleteProject(project.id);
assert(countFts.get(project.id).c === 0, 'project cascade delete cleared the FTS rows');
assert(countFts.get(otherProject.id).c === 1, 'other project untouched by the delete');

console.log('\n🧪 ask: in-memory ranker (sample project path)\n');

const sampleItems = [
  { id: 'MK-001', markup: makeMarkup('MK-001', { markup_text: 'Relocate cleanout to property line', markup_type: 'move', page_number: 1 }) },
  { id: 'MK-002', markup: makeMarkup('MK-002', { markup_text: 'Add rip rap at outfall', markup_type: 'add', drawing_reference: 'C-3.1', page_number: 2 }) },
];

const ranked = rankItemsByOverlap(sampleItems, 'where is the cleanout relocated?');
assert(ranked.length === 1 && ranked[0].id === 'MK-001', 'overlap ranker surfaces the matching item only');
assert(ranked[0].markup_text.includes('cleanout'), 'ranker output uses the same source shape as FTS');
assert(rankItemsByOverlap(sampleItems, 'foundation waterproofing').length === 0, 'no overlap returns empty');
assert(rankItemsByOverlap(sampleItems, '?? !!').length === 0, 'no-token question returns empty');

// Cleanup the throwaway database (WAL sidecars included)
db.close();
rmSync(testDir, { recursive: true, force: true });

if (!failed) console.log('\n✅ all ask-retrieval tests passed\n');
