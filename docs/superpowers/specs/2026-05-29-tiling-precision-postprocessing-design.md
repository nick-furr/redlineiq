# Design: Post-processing precision fixes for tiled extraction

**Date:** 2026-05-29
**Status:** Approved (pending implementation)
**Related:** Notion "Investigate case_012 false positives (precision 0.38)" (`36f1ec96-c149-81cd-b1e5-fd15bc33f086`); memory `project_dpi_upstream_hypothesis`; ADR 0003.

## Context

Tiling shipped to production (`2297f00`) and fixed confabulation — case_012 recall went 0 → 0.846. The cost was precision: the live tiled run on case_012 extracts **29 markups, 11 matched → precision 0.379**. The 18 false positives break down by mechanism (observed in `evals/runs/2026-05-29_current_tile_only.json`):

- **~11 — location-only marker descriptions.** The model narrates that a red mark exists and roughly where, with no reviewer comment. Examples: `"Red cloud around pier diameter note"`, `"Red cloud markup"`, `"Red zigzag line along upper edge"`, `"Red cloud marking empty area"`. These are either redundant restatements of a comment already captured elsewhere, or confabulated tile-edge noise.
- **~7 — substrate-text transcription.** The model transcribes the drawing's *own* printed text as if it were a redline: `"HATCHED AREAS (TYP.)"`, `"C8x11.5 @ 2'-0\" O.C."`, `"PLYWOOD OVER 1 1/2\" METAL ROOF DECK..."`. **Out of scope here** — this is the phase-2 prompt-rule fix.
- **1 — cross-tile duplicate.** `"Floor access opening framing not shown — verify per 1/S301"` and `"access opening not shown — per 1/S301"` are the same real markup (m5) reworded across an overlapping tile. The current exact-normalized-text dedup missed it.

This spec covers only the **post-processing** levers (location-only suppression + fuzzier dedup). They are pure merge-step logic — no prompt change, no model call, validated by the existing eval — so they carry no recall-regression risk on other cases and ship fast. The substrate-text prompt rule and content-aware tile routing are tracked separately.

## Decision: suppress on content, never on "is it a cloud"

A cloud is arbitrary or meaningful depending on the individual markup, so no category-level rule (drop all clouds / keep all clouds) is correct. The discriminator is the model's own output:

- When a cloud carries meaning, the model extracts a **comment** for it — and we keep that comment.
- When the model can only say "a red mark is here," it found no meaning beyond location → drop as a checklist item.
- When meaning lives in the cloud's **extent** (scope) with no text, the vision path physically cannot represent it (it emits vague or fabricated prose, never geometry). That signal is a **pdfjs-path requirement** — exact annotation coordinates — not something this path can honor. Logged on the pdfjs ticket.

Dropping is safe because: (1) the eval is the guardrail — no expected label is a comment-less cloud, so any recall cost surfaces immediately; (2) it is reversible/additive — a "flagged areas" surface can be layered on later if real usage wants it; (3) the detection rule is conservative — it errs toward keeping.

## Components

New pure-function module **`src/services/markup-postprocess.js`**, called from the merge step in `src/services/tiled-extraction-service.js`. Extracting the merge logic from the service makes it unit-testable (currently inline and untested) without touching the extraction path.

### 1. `dropLocationOnlyMarkers(markups) → markups`

Drop a markup only if **both** hold:

- **(a) Pure marker description.** Normalized text leads with / is essentially `red (cloud|zigzag|circle|arrow|line)…`, or is `red cloud markup`, or `…marking <generic> area`.
- **(b) No actionable content.** No em-dash comment clause **and** none of the instruction-keyword set: `verify, confirm, check, add, provide, revise, not shown, not defined, not called out, not dimensioned, missing`.

Both conditions required → conservative. `"…recess extents not dimensioned — add limits"` survives (has instruction); `"Red cloud marking empty area"` drops. Bare descriptive nouns (e.g. `detail`, `area`) are **not** in the actionable set, so they do not rescue a marker-only item.

### 2. `dedupeMarkups(markups) → markups`

Replace exact-normalized-text matching with **token-overlap (Jaccard) similarity** on normalized word tokens. Two markups are duplicates when Jaccard ≥ **0.6**; keep the higher-confidence copy (existing `confidenceRank` logic). Retain an exact-match fast path.

- Jaccard chosen over edit-distance/trigram: order-insensitive and robust to reworded restatements, which is precisely how m5's duplicate slipped through.
- Scope: **global** across all tiles (simpler than restricting to adjacent/overlap regions; the eval catches any over-merge). Revisit only if a clean case regresses.

### 3. Unique IDs

Ensure merged output has globally unique IDs even on the single-page path the eval exercises (currently `MK-001` repeats ~12× because the renumber in `extractAllPagesTiled` isn't reached). Fold the renumber so any merge consumer gets unique IDs.

**Order:** drop markers → dedupe → renumber.

## Validation (TDD)

1. **Unit test first**, fixture = the real 29-markup case_012 output (`evals/runs/2026-05-29_current_tile_only.json`):
   - location-only items are dropped;
   - the m5 duplicate is merged to one;
   - **all 11 real (matched) markups survive**;
   - output IDs are unique.
2. **Eval after:** re-run case_012 — precision must rise from 0.379 with **recall held at 0.846**; then the full set — no precision regression on clean cases (e.g. the synthetic civil sheet that tiling already hurt).

## Out of scope (tracked elsewhere)

- **Substrate-text prompt rule** (~7 FPs) — phase-2 prompt change, needs full eval + credits.
- **Content-aware tile routing** — detect dense vs. clean sheets; cost + clean-sheet-precision play. Deferred until extraction opens beyond the demo gate.
- **Cloud location/extent capture** — belongs to the pdfjs annotation-parsing path (exact coords); logged on that ticket.

## Knobs (defaults chosen; eval-tunable)

- Jaccard duplicate threshold: **0.6**.
- Dedup scope: **global**.
