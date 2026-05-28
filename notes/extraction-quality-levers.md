# Extraction quality — what actually moves scores

Captured 2026-05-28 after the DPI-fix investigation, model alias drift discovery, and viewer DPI fix. Consolidates lessons from a session that ran longer than it should have because the assumed hypothesis was wrong about which knob mattered.

## TL;DR

For RedlineIQ extraction quality on a given case, ceilings stack in this order:

1. **Source PDF resolution** is the lowest ceiling. A scanned page at 150 DPI source can never be improved by anything downstream.
2. **Model server-side resize cap** is the next ceiling. Sonnet 4.6 caps at **1568 px on the long edge**. Opus 4.7 caps at 2576 px. Sending images larger than the cap is wasted bytes plus a degrading double-resize (sharp's resize + Anthropic's resize).
3. **Sheet area vs the model's effective DPI**: a 36×24 arch sheet at Sonnet 4.6's 1568 px cap delivers ~43 effective DPI to the model. Handwriting is unreadable at that density. **Tiling is the only way past this** — no DPI knob, no prompt rule, no model parameter can manufacture pixels that the resize pipeline strips away.
4. **case_006 (real hand-drawn bath01)** has been flat at 0.538 recall since v0.8 across every prompt iteration. It's at the model's effective resolution ceiling for that sheet size. DPI is NOT its lever. It needs tiling, or Opus 4.7 (2576 px long edge → 64% more pixels per image), or a different schema/prompt that handles the genuine ambiguity differently.

## Anthropic vision size constants (Sonnet 4.6, current understanding)

- Max useful long-edge resolution: **1568 px**. Larger images are resized server-side, then padded to a multiple of 28 px.
- Token cost: approximately `width × height / 750`.
- API base64 payload limit: **5 MB**. Translates to a ~3.5 MB binary cap after the ~33% base64 inflation tax.
- Hard image dimension limit: 8000 × 8000 px (irrelevant once the 1568 px ceiling applies).
- Opus 4.7 supports 2576 px on the long edge — relevant if we ever bump the model tier to handle hand-drawn content better.
- Source: https://platform.claude.com/docs/en/build-with-claude/vision

## Tiling: the next-real-fix design sketch

The target: for a 36×24 arch sheet, deliver content to the model at high effective DPI without exceeding 1568 px long edge per image.

**Math.** A 36×24 sheet at 200 DPI native = 7200×4800 pixels. Split into a 3×3 grid → 9 tiles of 2400×1600 each. Each tile's long edge is 2400 → gets resized to 1568 by Anthropic → tile arrives at the model at ~65 effective DPI (vs ~43 if we just sent the whole sheet at 1568 long edge). To get 100 effective DPI we'd need a 5×5 = 25-tile grid. Trade-off scales linearly: 25× the Vision API cost per page, 25× the latency, plus dedup/merge work.

**Open design questions for the tiling ticket:**

- **Overlap percentage** between adjacent tiles (10%? 20%?) — affects dedup quality at tile boundaries
- **Per-tile prompt context** (current sheet name, neighbor tile labels, page number, grid position) to help the model not double-count markups that span tiles
- **Merge strategy**: union with text-similarity dedup, OR pick one tile's claim per spatial region, OR run a separate consolidation pass after per-tile extractions
- **Cost ceiling.** If 25 tiles per page is too expensive, fall back to fewer tiles and accept lower per-pixel DPI. Adaptive: scan a low-res first pass to detect markup density, tile densely only where markups exist.
- **Whether to tile synthetic-clean PDFs at all.** Small synthetic 8×8 cases (case_006 itself excluded since it's hand-drawn) might not benefit from tiling.

**Cost order of magnitude.** A 1-page synthetic Bluebeam-style PDF currently costs ~$0.005–$0.01 per extraction at Sonnet 4.6. 25 tiles would be ~$0.13–$0.25 per page. For a 10-page redline job, that's $1.30–$2.50. Not crazy for the workflow, but worth surfacing in any future pricing model.

## What does NOT move scores

A catalog of things tried or considered that turned out to be dead ends — so we don't re-walk them:

- **Raising `pdf2pic` `TARGET_DPI` from 200 to 300.** Wasted bytes past the model's 1568 px ceiling, plus the degrading double-resize. Tested 2026-05-28; regressed aggregate recall ~0.811 → ~0.649. Reverted in commit 8412c3a. Underlying reason was already documented by Anthropic in their vision docs (and our diagnostic confirmed): images bigger than the cap get resized server-side regardless.
- **Removing `pdf2pic`'s `width: 2400, height: 3200` cap entirely.** Looks like the right move (it forces a 3:4 aspect on every PDF, distorting landscape sheets). But `pdf2pic` falls back to a 768×512 default when width/height are unset, completely ignoring `density`. Re-imposing computed bounds based on PDF native inches × DPI also regressed scores at the higher DPIs that approach allowed.
- **Bumping image dimensions to the 4000–8000 px range.** Strictly worse than 2400×3200 because of the double-resize tax. The aspect distortion in the old config is cosmetically wrong but empirically scored better than the "fixed" version.
- **The case_006 "real hand-drawn cracks open with DPI" hypothesis.** case_006 is a small 8×8 in PDF that was already rendering at the model's effective max (300 DPI effective in the old config because the 2400 px cap on an 8 in sheet = 300 DPI). Its 0.538 floor is a different problem — genuine source ambiguity, or model capability ceiling on hand-drawn content.

## Things that DO move scores

- **Model tier change.** v0.7 → v0.8 was `claude-sonnet-4-20250514` → `claude-sonnet-4-6`, +0.103 aggregate recall. Pure model lift, no prompt change. Documented in `prompts/CHANGELOG.md` v0.8 entry.
- **Two-pass extraction with explicit bare-mark sweep.** v0.8 → v0.9, +0.204 on the targeted bare-mark sub-metric. Documented in v0.9 entry.
- **Pinning `temperature=0`** for deterministic eval. Doesn't move *quality* per se but removes a major source of variance that was masking which other changes actually moved scores. Committed 02b756c.
- **Tiling for hand-drawn / low-source-resolution content (VALIDATED 2026-05-28 on case_006).** The eval-only tiling prototype lifted case_006 from recall 0.231 → 0.538 + precision 0.273 → 0.636 with no other change. This is the biggest single-case recall gain in the project to date. Caveat: indiscriminate tiling tanks precision on clean synthetic sheets (extracted counts triple, dedup doesn't catch all overlap dupes). The lever is real but needs either conditional application (only tile scanned sources) or tighter dedup before it goes to production. See `prompts/CHANGELOG.md` "Experiment: v0.9 + tiling" entry and commits `24e8783` / `de38aa6`.
- **(Future, untested) Model bump to Opus 4.7.** 2576 px long edge gives 64% more pixels per image. Hand-drawn-content quality improvements likely come along too (Anthropic's vision-heavy benchmark improvements have historically been on Opus first). Less urgent now that tiling is validated for the hand-drawn case.

## The temperature=1.0 silent default story

`src/services/extraction-service.js` never set `temperature` in `client.messages.create()` until commit 02b756c on 2026-05-28. Anthropic's API defaults to 1.0 when the parameter is omitted, meaning every extraction since v0.6 was fully stochastic. Per-case recall could swing by 0.1–0.4 between runs of identical code.

**Implication for prior eval comparisons.** The "σ ≈ 0.02 on aggregate" variance baseline noted in the CHANGELOG was either a lucky run or measured on per-case differences that happened to cancel out in aggregate. The actual per-case noise floor was much wider. Re-reading prior CHANGELOG entries with this knowledge:

- v0.7 → v0.8 aggregate recall +0.103 — **real** (well outside even the wider noise band)
- v0.8 → v0.9 aggregate recall +0.021 — **noise-level** (well inside per-case noise)
- v0.9 bare-mark sub-metric +0.204 — **real**

Pinning temperature was overdue. Future eval comparisons can now be trusted at lower deltas.

## The 5/24 → 5/28 score gap (investigated and partially explained)

Identical code + identical prompt + identical eval set scored aggregate recall 0.811 on 5/24 and 0.654 on 5/28 across three separate runs at three file states. Initial hypothesis was alias drift on `claude-sonnet-4-6`. Investigation via Anthropic's `models/model-ids-and-versions` docs revealed that **starting with the 4.6 generation, the dateless model form IS the pinned snapshot** — there's no separate dated equivalent because the naming convention changed. So alias drift can't fully account for the gap if Anthropic's pinning guarantee is accurate.

Refined understanding of what likely caused the drift:

- **Judge variance at `temperature: 1.0`** (`evals/lib/llm-judge.js` defaulted to API's 1.0 temp; the 3x majority vote was a band-aid for this, not a clean fix). Per-pair noise even with 3x voting → aggregate noise of ~0.05+.
- **Extraction variance at `temperature: 1.0`** (`src/services/extraction-service.js` likewise — fixed in commit `02b756c`). Different sampling could produce more diverse markup lists that hit more expected concepts, inflating recall.
- **Possibly minor residual Anthropic-side non-determinism** even at temp=0 (KV cache state, prompt cache turnover, infrastructure-level variance). Anthropic doesn't formally guarantee bit-perfect determinism at temp=0.

The fix is in **ADR 0003** (revised 2026-05-28 from the alias-drift framing to the more accurate "pin all temperatures + follow per-generation pinning convention" story). Both extraction and judge now run at `temperature: 0`, the judge's 3x vote was dropped (redundant when deterministic), and `claude-sonnet-4-6` stays as the model ID since it's pinned per Anthropic's 4.6+ convention.

The **2026-05-24 v0.9 aggregate of 0.811 is still invalidated** as a baseline — it was measured against the non-deterministic stack. A new baseline at the fully-deterministic config replaces it in the CHANGELOG.

## The viewer DPI / canvas backing-store calibration

`client/src/components/PdfViewer.jsx` now passes `devicePixelRatio={Math.max(2, Math.min(6, 4000 / pageWidth))}` to react-pdf's `<Page>`. This targets a constant ~4000 px canvas backing store regardless of in-app zoom level, which:

- Keeps the backing canvas under Chrome's ~16 megapixel silent-downsample cap at high in-app zoom (the prior `devicePixelRatio = constant × zoom` formula hit 39 MP at 300% zoom and quietly degraded)
- Avoids the "in-app zoom looks softer than browser zoom" failure mode that the prior formula caused
- Caps the multiplier at 6 to keep the at-100%-zoom case sane (pageWidth = 800 → DPR = 5 → backing = 4000)

**Source bottleneck.** Even with a perfect 4000 px canvas backing, the source PDF's embedded raster resolution is the ceiling. For scanned handwritten content at ~200 DPI source, no canvas-side trick can interpolate detail that wasn't scanned. Closing the remaining perceptual gap to Chrome's native PDF viewer would require either:

- (a) Embedding Chrome's PDF viewer via `<iframe>` — loses our markup overlay capability
- (b) Server-side re-rasterization of source PDFs at higher fidelity using sharp/sharpen filters — architecture change
- (c) Higher-quality source scans — out of our control, but worth flagging to users uploading low-DPI scans

Likely not worth chasing tonight or in the near term; current state is "readable, sharp enough for verification" which is the functional bar.

## References

- 2026-05-26 dogfood session (raw friction notes): `dogfood/2026-05-26.md`
- 2026-05-28 commits: `8412c3a` revert(pdf-converter), `6b23747` fix(client/PdfViewer), `02b756c` fix(extraction): pin temp=0, `b487c1c` docs(dogfood)
- Anthropic vision docs: https://platform.claude.com/docs/en/build-with-claude/vision
- react-pdf devicePixelRatio FAQ: https://github.com/wojtekmaj/react-pdf/wiki/Frequently-Asked-Questions
- Memory (~/.claude): `project_dpi_upstream_hypothesis.md` (final state captures the full arc)
- Notion ticket (Done): "Raise PDF rasterization DPI in extraction + viewer pipeline"
- Notion ticket (Next): "Pin claude-sonnet-4-6 to a dated snapshot; re-baseline eval at temp=0"
- ADR: `docs/decisions/0003-pin-model-versions.md`
