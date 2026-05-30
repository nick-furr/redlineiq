# Tiling Precision Post-Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise tiled-extraction precision on case_012 (currently 0.379) by dropping location-only marker false-positives and merging fuzzy cross-tile duplicates — without lowering recall (0.846).

**Architecture:** Add one pure-function module (`src/services/markup-postprocess.js`) that post-processes the merged per-tile markup list in three steps — drop location-only markers → fuzzy (Jaccard) dedup → reassign unique IDs. Wire it into the merge step of `src/services/tiled-extraction-service.js`, replacing the current inline exact-match dedup. No prompt change, no model call; validated by the existing eval harness.

**Tech Stack:** Node.js ESM, plain-`node` test scripts (no test framework — see `test/test-extraction.js`), existing eval runner (`evals/run-eval.js`).

**Spec:** `docs/superpowers/specs/2026-05-29-tiling-precision-postprocessing-design.md`

---

## File Structure

- **Create:** `src/services/markup-postprocess.js` — pure functions: `normalizeText`, `confidenceRank`, `isLocationOnlyMarker`, `dropLocationOnlyMarkers`, `jaccardSimilarity`, `dedupeMarkups`, `assignSequentialIds`, `postprocessMergedMarkups`.
- **Create:** `test/test-markup-postprocess.js` — standalone node test, same `assert` style as `test/test-extraction.js`.
- **Modify:** `src/services/tiled-extraction-service.js` — replace inline merge/dedup (lines ~71-104) and delete the now-duplicated `normalizeText`/`confidenceRank` helpers (lines ~123-135); import from the new module.
- **Modify:** `package.json` — chain the new test into `npm test`.

**Markup shape** (for reference, from `evals/runs/2026-05-29_current_tile_only.json`):
```js
{ id: 'MK-001', markup_text: '…', markup_type: 'clarify', drawing_reference: 'S201',
  location_on_drawing: '…', related_to: null, confidence: 'high', ambiguous: false, raw_interpretation: null }
```

---

## Task 1: `dropLocationOnlyMarkers` — drop marker-only items with no actionable content

**Files:**
- Create: `src/services/markup-postprocess.js`
- Test: `test/test-markup-postprocess.js`

- [ ] **Step 1: Write the failing test**

Create `test/test-markup-postprocess.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/test-markup-postprocess.js`
Expected: FAIL — `Cannot find module '.../markup-postprocess.js'` (module not created yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/services/markup-postprocess.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test-markup-postprocess.js`
Expected: PASS — all Task 1 assertions show `✓`, process exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/services/markup-postprocess.js test/test-markup-postprocess.js
git commit -m "feat(postprocess): drop location-only marker markups (precision)"
```

---

## Task 2: `dedupeMarkups` — fuzzy (Jaccard) cross-tile dedup

**Files:**
- Modify: `src/services/markup-postprocess.js`
- Test: `test/test-markup-postprocess.js`

- [ ] **Step 1: Write the failing test**

Append to `test/test-markup-postprocess.js` (add `jaccardSimilarity, dedupeMarkups` to the import at the top, then add this block before the final `console.log`):

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/test-markup-postprocess.js`
Expected: FAIL — `jaccardSimilarity is not a function` / `dedupeMarkups is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/services/markup-postprocess.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test-markup-postprocess.js`
Expected: PASS — Task 1 + Task 2 assertions all `✓`.

- [ ] **Step 5: Commit**

```bash
git add src/services/markup-postprocess.js test/test-markup-postprocess.js
git commit -m "feat(postprocess): Jaccard cross-tile dedup, keep higher confidence"
```

---

## Task 3: `assignSequentialIds` — unique IDs + related_to remap

**Files:**
- Modify: `src/services/markup-postprocess.js`
- Test: `test/test-markup-postprocess.js`

- [ ] **Step 1: Write the failing test**

Append to `test/test-markup-postprocess.js` (add `assignSequentialIds, postprocessMergedMarkups` to the import, then add before the final `console.log`):

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/test-markup-postprocess.js`
Expected: FAIL — `assignSequentialIds is not a function` / `postprocessMergedMarkups is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/services/markup-postprocess.js`:

```js
/**
 * Reassign sequential, unique IDs (MK-001, MK-002, …) and remap any
 * related_to references to the new IDs. Mutates and returns the array.
 */
export function assignSequentialIds(markups, { prefix = 'MK', start = 1 } = {}) {
  const idMap = new Map();
  let counter = start;
  for (const markup of markups) {
    const newId = `${prefix}-${String(counter).padStart(3, '0')}`;
    idMap.set(markup.id, newId);
    markup.id = newId;
    counter++;
  }
  for (const markup of markups) {
    if (markup.related_to && idMap.has(markup.related_to)) {
      markup.related_to = idMap.get(markup.related_to);
    }
  }
  return markups;
}

/** drop location-only markers → fuzzy dedup → reassign unique IDs. */
export function postprocessMergedMarkups(markups, options = {}) {
  const deduped = dedupeMarkups(dropLocationOnlyMarkers(markups), options);
  return assignSequentialIds(deduped, options);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test-markup-postprocess.js`
Expected: PASS — all three task blocks `✓`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/services/markup-postprocess.js test/test-markup-postprocess.js
git commit -m "feat(postprocess): unique-ID renumber + full pipeline"
```

---

## Task 4: Wire the pipeline into the tiled merge step

**Files:**
- Modify: `src/services/tiled-extraction-service.js`
- Modify: `package.json`

Replace the hand-rolled merge in `extractMarkupsFromTiledPage` with the new pipeline, and delete the now-duplicated helpers. **Read the current file first** — line numbers below are from the 2026-05-29 state and may drift.

- [ ] **Step 1: Add the import**

In `src/services/tiled-extraction-service.js`, just below the existing `import { extractMarkupsFromPage } from './extraction-service.js';` line, add:

```js
import { postprocessMergedMarkups } from './markup-postprocess.js';
```

- [ ] **Step 2: Replace the merge block**

Find the merge section that begins with `// Merge: collect all markups, dedup by normalized text` and ends just before `// Use first tile's page metadata…` (the `const allMarkups = []; const seen = new Map();` loop). Replace that entire block with:

```js
  // Collect every per-tile markup in deterministic (tile) order, then run the
  // precision pipeline: drop location-only markers → fuzzy dedup → unique IDs.
  // (perTileResults is already sorted by tile order above.)
  const collected = [];
  for (const { result } of perTileResults) {
    collected.push(...result.markups);
  }
  const allMarkups = postprocessMergedMarkups(collected);
```

- [ ] **Step 3: Delete the now-unused helpers**

At the bottom of `src/services/tiled-extraction-service.js`, delete the local `normalizeText(text)` and `confidenceRank(conf)` function definitions (they now live in `markup-postprocess.js` and nothing else in this file references them). Verify no other reference remains — use the Grep tool (or `node -e` below) rather than `rg`, which may not be on PATH on Windows:

Run: `node -e "const s=require('fs').readFileSync('src/services/tiled-extraction-service.js','utf8');console.log(/normalizeText|confidenceRank/.test(s)?'STILL REFERENCED':'clean')"`
Expected: prints `clean`.

- [ ] **Step 4: Update the merge log line (optional but keep it honest)**

The existing `console.log` reporting "per-tile markups → N after dedup" still works since `allMarkups.length` is the post-pipeline count. Leave it; it now reflects drop+dedup, not just dedup.

- [ ] **Step 5: Chain the new test into `npm test`**

In `package.json`, change the `test` script:

```json
"test": "node test/test-extraction.js && node test/test-markup-postprocess.js",
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS — both `test-extraction.js` and `test-markup-postprocess.js` complete with no `✗`.

- [ ] **Step 7: Smoke-check the service imports cleanly**

Run: `node -e "import('./src/services/tiled-extraction-service.js').then(() => console.log('OK')).catch(e => { console.error(e); process.exit(1); })"`
Expected: prints `OK` (module graph loads with the new import, no syntax/reference errors).

- [ ] **Step 8: Commit**

```bash
git add src/services/tiled-extraction-service.js package.json
git commit -m "refactor(tiled): route merge through markup-postprocess pipeline"
```

---

## Task 5: Validate against the eval harness

No code changes — confirm the precision lift is real and recall is held. **This makes real Claude API calls (tiled = ~15 calls/sheet), so it costs credits.** Scope it tightly with `--only`.

- [ ] **Step 1: Re-run case_012 tiled**

Run: `npm run eval -- --only=case_012 --tile`
This writes a fresh `evals/runs/<date>_<...>_tile_only.json`.

- [ ] **Step 2: Read the new scores**

Run:
```bash
node -e "const fs=require('fs');const f=fs.readdirSync('evals/runs').filter(x=>x.includes('tile')&&x.endsWith('.json')).sort().pop();const r=JSON.parse(fs.readFileSync('evals/runs/'+f));const c=r.results.find(x=>x.case_id.includes('case_012'));console.log(f);console.log(JSON.stringify(c.scores));"
```
Expected vs baseline (`recall 0.846, precision 0.379`):
- **recall ≥ 0.846** (must NOT drop — the real markups survive),
- **precision meaningfully > 0.379** (location-only + dup FPs removed),
- IDs in `c.extracted_markups` are now unique (no repeated `MK-001`).

If recall dropped, a real markup was caught by the drop/dedup rule — inspect which, tighten `MARKER_LEAD`/`ACTIONABLE` or raise the Jaccard threshold, re-run Task 1-3 tests, then re-run this.

- [ ] **Step 3: Regression spot-check on a clean sheet (recall is the risk)**

By construction the pipeline only ever *removes* markers/dups, so precision on a clean sheet can only rise or hold. The real risk is the opposite: a legit markup on a clean sheet that happens to match `MARKER_LEAD` with no actionable keyword would be wrongly dropped — a **recall** hit. So check recall, not precision:

Run: `npm run eval -- --only=case_001 --tile`
Then read its scores with the snippet from Step 2 (swap `case_012` → `case_001`).
Expected: **recall holds** (no real markup wrongly dropped). If recall fell, list case_001's dropped markups, confirm whether any was a real reviewer markup, and if so tighten `MARKER_LEAD`/widen `ACTIONABLE` and re-run Tasks 1-3 tests. Precision on this sheet should be ≥ its prior tiled value (FPs/dups removed).

- [ ] **Step 4: Record the outcome + commit the run**

Append a one-line result to `prompts/CHANGELOG.md` (match its existing entry format) noting case_012 precision before→after at recall held, and add the new run file:

```bash
git add evals/runs/ prompts/CHANGELOG.md
git commit -m "eval(postprocess): case_012 precision 0.379 → <new> at recall 0.846"
```

(Fill `<new>` with the measured precision from Step 2.)

---

## Done criteria

- `npm test` green (both suites).
- case_012 tiled: precision up from 0.379, recall ≥ 0.846, unique IDs.
- A clean case (case_001) shows no precision regression.
- All work committed; new eval run recorded in CHANGELOG.
