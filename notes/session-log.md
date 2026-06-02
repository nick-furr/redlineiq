# Session log — factual record of build sessions

The engineering record of what shipped each session: what happened, the specific numbers, the dead ends, the concrete commits. Captured while sessions are fresh so future-you can reconstruct decisions without replaying commits + memory.

This file is **facts only** — no post framing, hooks, or voice notes. Build-in-public drafting lives in the Claude chat project (which has repo access and reads this log for source material). Keep entries self-contained and sourced.

---

## 2026-06-02 — parse/vision hybrid Phase 1 shipped (annotation-layer parse path)

**Summary:** Built the parse path the 5/29 "wrong-tool" realization pointed to: digital, un-flattened PDFs now route through a lossless `pdfjs-dist` annotation-layer parser instead of vision. Markup text + exact coordinates are read straight from the PDF; one cheap **text-only** Claude call assigns the semantic labels (type / related_to / confidence / ambiguous) that aren't stored in the file. The tiled-vision path is untouched — PDFs with no annotation layer route to vision exactly as before. Opened as PR #2 (not yet merged). TDD throughout; 39 offline assertions across 5 suites.

**What happened:**
1. **Router-first architecture:** a probe (`pdf-annotation-probe.js`) counts markup-subtype annotations *before any rasterization* and classifies the source as `digital_annotation` vs `raster`. `chooseExtractionPath()` in `job-service.js` routes: annotations → parse, else → vision. Digital files skip image conversion entirely.
2. **Same output contract:** `parse-extraction-service.js` (parse → text-only label → assemble) returns the identical `ExtractionResult` shape as `extractAllPagesTiled`, so the job runner, persistence, SSE events, and UI needed no other changes.
3. **Dead end / field gotcha (the one real bug):** the implementation plan read annotation text from `a.contents` — which is `undefined` in pdfjs 5.x. Parsing returned **0 markups**. The note text actually lives in `a.contentsObj.str`. The committed diagnostic (`inspect-pdf.js`) had only counted annotations by *subtype*, never verified the text field, so the "12 FreeText w/ text" claim was inferred, not checked. Fixed by reading `a.contentsObj?.str` with a fallback to the flat `contents` string for older builds. (Confirms the project rule: verify against evidence, don't trust the inferred assumption.)
4. **Lossless result:** live smoke test on the un-flattened San Marcos S201 (case_012) extracted **12/12 text annotations, 0 malformed**, each with a valid `markup_type` and a 4-tuple coordinate rect; the genuinely ambiguous note ("?") was flagged correctly. The 12 Polygon clouds carry no text and were skipped (location indicators — their paired note carries the content), mirroring the existing `dropLocationOnlyMarkers` philosophy.
5. **Coordinates captured, highlighting deferred:** each parsed markup carries `{ page, rect, subtype }` (PDF points, bottom-left origin). Documented as a parse-only optional field on `ExtractedMarkup`; on-drawing highlighting will consume it later.
6. **Eval segmentation:** the harness now records the routed regime per case and reports recall/precision **broken down by source type** + router accuracy, so parse numbers don't blend into the vision average. Tagged case_011/case_012 labels with `source_type: digital_annotation`.

**Known limitations (follow-ups, not blockers):**
- The eval harness records `routed` and segments by regime but still **scores** every case via the vision path — `digital_annotation` recall is currently vision's number, not parse's. Router accuracy is real; in-harness parse-path scoring is the follow-up.
- `extract-cli.js` bypasses the router (calls `extractAllPages` directly); the new path was verified via a direct driver script. Wiring the CLI through the router is a small follow-up.
- Phase 2 (flattened color-filtered parse) deferred — `_flattened` fixtures are in the tree but unused here.

| Number | What it is | Source |
|---|---|---|
| **12 / 12** | text annotations extracted losslessly, 0 malformed | live smoke on case_012 (un-flattened) |
| **24 → 12** | probe counts 24 markup annotations (12 FreeText + 12 Polygon); 12 text markups emitted (textless clouds skipped) | `pdf-annotation-probe.js` / `parse-extraction-service.js` |
| **100%** | router accuracy on tagged cases (case_012→parse, case_001→vision) | `summarizeByRegime` standalone check |
| **`contentsObj.str`** | the pdfjs 5.x field carrying annotation text (`a.contents` is `undefined`) | `9dd23c0` |
| **39 / 5** | offline test assertions / suites passing (`npm test`) | probe, parse-extraction, eval-routing + existing extraction, postprocess |

**Commits (PR #2, branch `feat/parse-vision-hybrid`):**
- `a329633` — build: add pdfjs-dist for backend annotation parsing
- `44525f7` — feat(probe): annotation-count source-type router
- `9dd23c0` — feat(parse): annotation-layer extraction + text-only labeling helpers (incl. the `contentsObj.str` fix)
- `ddf6f7b` — feat(parse): extractAllPagesParsed entrypoint matching vision contract
- `0c51ee4` — feat(jobs): route digital PDFs to parse, raster to vision
- `4e5cd56` — docs(model): document parse-only coordinates field
- `9489077` — eval: segment recall/precision by source regime + router accuracy
- `3d68c87` — chore: register parse tests, revert stray client backend dep
- PR #2: https://github.com/nick-furr/redlineiq/pull/2 (open)

**Related docs:** spec `docs/superpowers/specs/2026-06-02-parse-vision-hybrid-extraction-design.md`, plan `docs/superpowers/plans/2026-06-02-parse-vision-hybrid-phase1.md`.

---

## 2026-05-30 — precision post-processing layer shipped

**Summary:** Shipped a deterministic post-processing layer between tile-merge and output that lifted case_012 precision **0.379 → 0.625 with recall held at 0.846**. Merged to main via PR #1, deployed. Fixed 2 of the 3 false-positive mechanisms; the largest (the model transcribing the drawing's own printed text as redlines) remains open — it's a prompt/parsing problem, not a code one.

**What happened:** Tiling made every tile legible, so the model extracted substrate text, redundant cross-tile copies of the same markup, and bare location-only marks ("red cloud around X") with no actual comment. 24 extracted, only 11 real → precision 0.379. New `markup-postprocess.js` runs three deterministic passes on the merged output:
- (a) **drop location-only marker markups** — a marker with no inferable comment isn't a checklist item;
- (b) **Jaccard cross-tile dedup** — token-overlap ≥0.6, keep the higher-confidence copy; caught a reworded duplicate that exact-string matching missed in the tile-overlap region;
- (c) **unique-ID renumber** with `related_to` remapping so downstream refs survive.

Locked with tests. Result: precision 0.379 → 0.625, recall unchanged at 0.846, clean-sheet case_001 no regression. This removed 5 of 13 FPs (1 cross-tile dup + 4 location-only clouds). The remaining 8 of 13 are the model transcribing the drawing's own black printed text as redlines — can't be deduped away. Fix is a prompt rule ("extract only the colored annotation layer, never the substrate") plus, for digital PDFs, parsing the annotation objects directly instead of OCR-ing pixels.

| Number | What it is | Source |
|---|---|---|
| precision **0.379 → 0.625** | case_012, the headline | `evals/runs/2026-05-30_current_tile_only.json` |
| recall **0.846** (held) | no recall traded for the precision gain | same run |
| **5 of 13** FPs removed | 1 cross-tile dup + 4 location-only clouds | post-process mechanism breakdown |
| **8 of 13** FPs remain | substrate-text transcription — the open problem | same |
| **≥0.6** | Jaccard token-overlap dedup threshold | `markup-postprocess.js` |

**Commits:**
- `32e9e0d` — feat(postprocess): drop location-only marker markups (precision)
- `5153949` — feat(postprocess): Jaccard cross-tile dedup, keep higher confidence
- `bce0a86` — test(postprocess): lock tie-confidence dedup; note first-match scope
- `0ed952b` — feat(postprocess): unique-ID renumber + full pipeline
- `b872f68` — refactor(tiled): route merge through markup-postprocess pipeline
- `e48ce35` — eval(postprocess): case_012 precision 0.379→0.625 (recall held)
- Merged to main: PR #1 (`2e87435`), Render deploy fired.

---

## 2026-05-29 (shipping session) — tiling shipped to production + wrong-tool realization

**Summary:** Took tiling from "validated in the eval harness" to "live in the deployed app" — wired it into the real upload→extract path, deployed, and swapped the public demo to the real San Marcos S201 sheet. Plus a stale-cache bug, and the realization that for digital-PDF inputs the markup is already structured data in the file (OCR-ing data that could be parsed = wrong tool).

**What happened:**
- Tiling now runs in the deployed app, not just the eval harness. Live home-page stat shows 11/13 markups on the demo sheet.
- **Wrong-tool realization:** Most RedlineIQ source PDFs (Bluebeam / PDF-XChange) carry **digital annotation objects** — structured text + type + exact coordinates, in the file. Vision+tiling was OCR-ing rasterized pixels of that data. The right architecture is two regimes: vision + tiling for scanned/hand-drawn/flattened sheets; parse the annotation layer (`pdfjs-dist`) directly for digital markups (→ ~100%, cheap, coords included, which also unlocks on-drawing highlighting). The parsing path is **not built yet** — it's the next build. Ilija Mirkovic flagged `pdfjs-dist` on the 5/23 launch post.
- **Stale-cache bug:** Swapped the demo PDF, deployed, and the live site still showed the old drawing — the PDF URL was identical across the swap and the route set `Cache-Control: max-age=86400`, so browsers served the cached old file next to the new checklist. Fix: version the URL (`?v=<filename>`) to bust the cache on swap.

| Number | What it is | Source |
|---|---|---|
| recall **0.846** (11/13) | case_012 in the *deployed app*, not just the eval | in-app job + `evals/runs/2026-05-29_current_tile_only.json` |
| precision **0.379** (11 of 24) | the cost: tiling read everything incl. substrate text | same run |
| **15 tiles** (3×5) | how the 36"×24" sheet was split | `[pdf-tiler]` log |
| **1568 px** | Sonnet 4.6 server-side image long-edge cap | Anthropic vision docs |
| **11 / 13** | markups shown on the live home-page stat | `client/src/pages/HomePage.jsx` |

**Commits:**
- `2297f00` — feat(app): route extraction through tiling pipeline
- `cf95a13` — feat(sample): swap hosted demo to curated case_012 (San Marcos S201)
- `9f00fdc` — fix(sample): cache-bust sample PDF URL so swaps don't serve stale cache
- Live: `redlineiq-app.onrender.com` (Render/Docker; `DEMO_MODE` on, public extraction gated)

---

## 2026-05-29 (discovery session) — confabulation + tiling confirmed on a new real case

**Summary:** Built a real civil/structural eval case by hand, watched the model invent markups when it couldn't read them, proved a prompt "don't fabricate" guard couldn't fix it, then proved tiling could — lifting the case from recall 0 → 0.85.

**What happened:**
1. Hand-marked a real public structural sheet (San Marcos fire-training center, S201) in PDF-XChange as a ground-truth eval case — 13 redline comments, known answers.
2. Extraction scored 0/13 but returned 12 markups at high confidence, all fabricated ("BEAM NEEDS TO BE INSTALLED BEFORE CEILING JOISTS" ×4 — text nowhere on the sheet).
3. Added an explicit prompt guard ("never fabricate, flag illegible instead"). Re-ran — still confabulated at high confidence, just different invented text. A prose prohibition can't overcome physically unreadable input.
4. **Root cause:** the Claude API downsamples every image to 1568 px on the long edge; on a dense 4-plan sheet the callouts shrank below readable (~43 effective DPI), so the model filled the gap with plausible notes.
5. **Fix:** split the sheet into 15 overlapping tiles, each under 1568 px, extract per tile, merge. Same sheet, same prompt: **recall 0 → 0.846.** Confabulation gone.
6. **Catch:** indiscriminate tiling tripled extracted counts on sheets that didn't need it and tanked precision (0.78 → 0.28 on a clean civil sheet). Real product move is **conditional tiling** — detect dense/illegible sheets and tile only those. Tiling the whole eval set in one batch also burned through the API credit balance mid-run.

**Taxonomy change:** while labeling, found one "case" wasn't comment-markup — the reviewer had *redrawn* the casework geometry in red (a geometric diff, not OCR). Added a third eval taxonomy axis (`markup_modality`: annotation / design_overlay / mixed) and pulled those cases out of the headline metric.

---

## 2026-05-27 → 2026-05-28 — DPI investigation arc + tiling breakthrough

**Summary:** Long diagnostic stretch on why hand-drawn redlines were failing. The obvious hypothesis (DPI) was wrong twice; the actual lever was tiling. Also found and fixed a silent `temperature=1.0` default that had been contaminating every eval comparison for weeks.

**What happened:**
1. **Symptom:** case_006 (a real hand-drawn bath01 elevation) stuck at recall ≤0.538 for two weeks across every prompt iteration; extraction missed readable markups and hallucinated cloud locations.
2. **Wrong hypothesis #1 — DPI too low:** found `pdf2pic` forcing a fixed 2400×3200 output that distorted aspect ratios; fixed it to compute target dims from native PDF inches × DPI. Eval recall regressed 0.811 → 0.649. Reverted.
3. **Actual ceiling:** Sonnet 4.6 server-side resizes all input images to **1568 px on the long edge** (Opus 4.7: 2576 px). Sending bigger images is wasted bytes plus a degrading double-resize. Verified via Anthropic vision docs.
4. **Wrong hypothesis #2 — model alias drift:** hypothesized `claude-sonnet-4-6` was an alias bumped between baseline (5/24) and now (5/28). For the 4.6+ generation the dateless form **is** the pinned snapshot per Anthropic docs. No drift.
5. **Silent bug:** the API was defaulting to `temperature: 1.0` on every extraction call since project start (judge too), because nobody set it. Every cross-day score comparison was contaminated with sampling variance; the "Week 2 σ ≈ 0.02 noise floor" was a lucky aggregate over much higher per-case noise. Pinned `temperature: 0` on both calls, dropped the judge's 3x majority vote. New deterministic v0.9 baseline: recall 0.665 (vs the contaminated 0.811). Aggregate σ now ≈ 0.003.
6. **The lever (payoff):** tiling prototype — split into ≤1568 px-long-edge tiles, extract per tile, dedup-merge. **case_006 lifted 0.231 → 0.538**, biggest single-case recall gain in the project. Caveat: indiscriminate tiling tanks precision on synthetic sheets; not shipped. Conditional tiling (tile only detected hand-drawn sources) is next.

| Number | What it is | Source |
|---|---|---|
| recall **0.231 → 0.538** | case_006 lift, tiling experiment | `evals/runs/2026-05-28_v0.9_tile.json`, `de38aa6` |
| recall **0.811 → 0.665** | "regression" that was actually variance + judge ensembling | pinned baseline, `c3b0b3a` |
| **1568 px** | Sonnet 4.6 server-side image long-edge cap | Anthropic vision docs |
| **2576 px** | Opus 4.7 equivalent cap | same |
| **σ ≈ 0.003** | aggregate determinism at pinned config | two back-to-back runs at temp=0 |

**Commits:**
- `8412c3a` — revert(pdf-converter): restore prior config after DPI attempt regressed
- `6b23747` — fix(client/PdfViewer): bump backing-store DPI for legible scan rendering
- `02b756c` — fix(extraction): pin temperature=0 for deterministic eval
- `a69469b` — fix(judge): pin temperature=0; drop redundant 3x majority vote
- `9a4c170` — docs: pivot ADR 0003 + rebaseline v0.9 CHANGELOG
- `24e8783` — feat(eval): tiling prototype
- `de38aa6` — eval(v0.9-tile): case_006 cracked

**Related docs:** ADR 0003 (`docs/decisions/0003-pin-model-versions.md`), `notes/extraction-quality-levers.md`, `prompts/CHANGELOG.md`.

---

## Template for future session captures

Append a new dated section with:

1. **Summary** — one paragraph: what shipped / what was learned.
2. **What happened** — the factual narrative: steps taken, dead ends, root causes, the fix.
3. **Numbers** — table of concrete metrics with sources (commits, files, runs).
4. **Commits** — short list with one-line descriptions.

Keep it factual and self-contained. Post framing/voice is not captured here — it's done in the Claude chat project, which reads this log for source material.
