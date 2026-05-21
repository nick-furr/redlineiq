# Prompt Changelog

Tracks what changed in the extraction prompt and eval harness between scored versions.
Prompt source files live alongside this changelog (`v0.X.md`). The runtime-loaded prompt is `active.md`. Run results are in `evals/runs/YYYY-MM-DD_<version>.json`.

---

## v0.7 — 2026-05-21

**Aggregate (9 cases, working set):** recall=0.687 · precision=0.730 · specificity=1.521

**Status: kept active.** Precision target (≥0.70) hit. Recall short of 0.80 target by 0.11.

### Changes shipped

- **`prompts/v0.7.md`** (now `prompts/active.md`): Merged v0.6's contradictory Rules 1 and 2 into a single unambiguous Rule 1 ("One item per markup. Clouds and circles are locators, not separate items."). The "no associated text" edge case is retained as an explicit exception clause. Subsequent rules renumbered 2–7. Total rules: 8 → 7.

### Hypothesis (going in)

Eliminating the Rule 1/2 contradiction should stop cloud-only duplicate emissions, which were the largest precision drag on C-401 (precision 0.389 in the original v0.6 scored run) and HOH-103/105. Target: precision rises by ≥10 absolute points.

### What we actually found

**The cloud-splitting bug isn't currently reproducing.** Diagnostic across all current v0.6 + v0.7 runs:

| Run | case_002 (C-401) splits | case_004 (HOH-103) splits |
|---|---|---|
| v0.6-var1 | 0 | 0 |
| v0.6-var2 | 0 | 0 |
| v0.6-var3 | 0 | 0 |
| v0.6-nojk | 0 | 0 |
| v0.7 | 0 | 0 |

The original `2026-05-20_v0.6.json` showed 7 cloud-splits each on C-401 and HOH-103. Today's runs show zero across both v0.6 and v0.7. The "precision killer" hypothesis was based on a state that doesn't currently exist — likely a non-deterministic bad run captured at a specific moment.

### Deltas vs v0.6-nojk

| Metric | v0.6-nojk | v0.7 | Δ | vs 1σ (0.018/0.023/0.032) | vs 2σ |
|---|---|---|---|---|---|
| Recall | 0.671 | 0.687 | +0.016 | ≈ | no |
| Precision | 0.683 | **0.730** | **+0.047** | yes | ≈ |
| Specificity | 1.572 | 1.521 | −0.051 | yes | no |

Precision moved ~5 points (right at the 2σ boundary), specificity dropped ~5 points the other direction, recall flat. The precision lift is probably real but modest. Cannot attribute it to fixing cloud-splitting — there was nothing to fix. The plausible alternative explanation: simplifying 8 rules to 7, removing internal contradiction, made the prompt easier for the model to follow even on the cases without the original bug. Cleaner instructions → slightly cleaner output.

### Per-case (sorted by precision delta)

| Case | v0.6-nojk r/p/s | v0.7 r/p/s | precision Δ |
|---|---|---|---|
| case_002 (C-401 civil) | 0.60/0.55/1.67 | 0.80/0.80/1.38 | **+0.25** |
| case_001 (C-301 civil) | 0.60/0.55/1.50 | 0.70/0.64/1.57 | +0.09 |
| case_010 (S-1 structural) | 0.75/0.86/2.00 | 0.75/1.00/2.00 | +0.14 |
| case_009 (M-101 mech) | 0.88/0.88/1.43 | 1.00/1.00/1.25 | +0.12 |
| case_003 (C-501 civil) | 0.80/0.80/1.75 | 0.70/0.70/1.71 | −0.10 |
| case_005 (HOH-105 arch) | 0.70/0.78/1.57 | 0.60/0.75/1.50 | −0.03 |
| case_004 (HOH-103 arch) | 0.70/0.70/1.43 | 0.70/0.64/1.43 | −0.06 |
| case_008 (E-100 elec) | 0.63/0.71/1.60 | 0.63/0.71/1.60 | 0.00 |
| case_006 (bath01 REAL) | 0.39/0.33/1.20 | 0.31/0.33/1.25 | 0.00 |

Best mover: case_002 (C-401), +0.25 precision. Worst mover: case_003 (C-501), −0.10 precision. The case_006 real-world bath01 is unchanged — confirming again that the model's struggles with non-synthetic hand-drawn markups are not affected by this prompt change.

### Implication

v0.7 is kept active because:
1. Aggregate precision is over target.
2. The prompt is genuinely cleaner (no internal contradiction, fewer rules).
3. No measurable downside — recall and specificity within noise.

But the win is smaller than the hypothesis predicted, and from a different mechanism. The clean takeaway: the next ~5-point precision gain has to come from somewhere else. Most likely candidates: bare "verify?" / "??" recall (consistently 0.0 across all runs), real-markup performance (case_006 still at 0.31/0.33), or model-tier change.

### What was NOT changed

No few-shot examples added. No restructure beyond rule merge. No new rules. Per the Week 2 plan: holding broader prompt work until real markups are in the eval set.

### Targets table (updated)

| Metric | Target | v0.7 status |
|---|---|---|
| Recall | ≥ 0.80 | 0.687 — short by 0.11, bare-marker misses dominate |
| Precision | ≥ 0.70 | **0.730 ✓** |
| Specificity | ≥ 1.50 | **1.521 ✓** (margin shrunk vs v0.6-nojk) |

Run files: `evals/runs/2026-05-21_v0.7.json` + `.html`

---

## v0.6 — 2026-05-21 (post-JK-removal baseline)

**Aggregate (9 cases, working set):** recall=0.671 · precision=0.683 · specificity=1.572

Same v0.6 prompt, but synthetic generators no longer draw "JK" reviewer initials into the PDFs. This is the honest baseline for v0.7 to beat.

### Delta vs JK-included variance mean (0.637 / 0.638 / 1.623)

| Metric | JK-included mean | JK-free | Δ | vs 1σ | vs 2σ |
|---|---|---|---|---|---|
| Recall | 0.637 ± 0.018 | 0.671 | **+0.034** | yes | no |
| Precision | 0.638 ± 0.023 | 0.683 | **+0.045** | yes | ≈ |
| Specificity | 1.623 ± 0.032 | 1.572 | **−0.051** | yes | no |

JK removal moved precision +4.5 points — at the 2σ boundary, so the effect is real but modest. The specificity drop (~5 points) is also borderline. Plausible explanation: JK was a confident high-precision false positive (1 mark, easy match → boosts specificity-weight on cases where it got matched as a low-spec item). Removing it raises precision but loses some specificity weight.

Run file: `evals/runs/2026-05-21_v0.6-nojk.json`

---

## v0.6 — 2026-05-21 (variance baseline, 3x run on JK-included working set)

Purpose: measure run-to-run noise floor before interpreting any v0.7 delta. Without this, a 10-point precision swing could be the same prompt scoring differently across runs.

Working set: 9 cases (case_001 through case_010 minus 007 which has no label). Includes case_006 (real bath01 elevation), case_008/009/010 (synthetic MEP/structural without JK).

| Run | Recall | Precision | Specificity |
|---|---|---|---|
| var1 | 0.618 | 0.621 | 1.656 |
| var2 | 0.640 | 0.629 | 1.620 |
| var3 | 0.653 | 0.664 | 1.593 |
| **mean** | **0.637** | **0.638** | **1.623** |
| **std dev** | **0.018** | **0.023** | **0.032** |

**Implication:** noise floor is ~2 points on aggregate metrics. Any v0.7 delta over ~5 points is signal, over ~10 points is unambiguous.

Per-case run output files: `evals/runs/2026-05-21_v0.6-var{1,2,3}.{json,html}`. Per-case variance (not aggregate) is higher — e.g., case_001 swung between recall 0.5 and 0.8 across runs. Aggregate is more stable because variance averages out across 9 cases.

**Note:** the original v0.6 score of 0.72 / 0.55 / 1.58 was on 5 cases (case_001–case_005, synthetic civil/arch only). The variance baseline above is on the larger current working set including a real case and MEP/structural cases — different composition, different baseline. v0.7 will be compared against the *post-JK* re-baseline below, not this set.

---

## v0.6 — 2026-05-20 (original scored run)

**Aggregate:** recall=0.72, precision=0.55, specificity=1.58

### Changes
- **`evals/lib/llm-judge.js`**: Added system prompt to the Haiku judge instructing it to match conceptually, not literally. Covers engineering shorthand, abbreviations, and OCR-mangled text. ("DR/SWING BLOCKS EGRESS" should match "door swing blocks corridor egress width".)
- **`src/services/extraction-service.js`**: Added Rule 8 excluding non-content marks: reviewer stamps ("REVIEW SET"), initials blocks, date stamps, and signature areas.
- **`evals/run-eval.js`**: Added `extracted_markups` array to run JSON output for debugging precision failures without re-running.

### Notes
- Recall hit target range (≥0.70) on 3 of 5 sheets. C-401 is the precision outlier (18 extracted, 7 matched) — likely splitting marks or reading engineer callouts as reviewer marks.
- HOH-105 consistently misses m1 (bldg height), m4 (window sill west), m5 (grade line north) — these marks are in tight margins and may need stronger mark placement in the synthetic PDF.
- Ambiguous bare marks (verify?, ??) still missed on C-401 and C-501 — low visual prominence.

---

## v0.5 — 2026-05-20

**Aggregate:** recall=0.38, precision=0.26, specificity=1.68

### Changes
- **`src/services/extraction-service.js`**: Added "Critical distinction" paragraph instructing the model to focus only on reviewer-added annotations and exclude base drawing content.

### Notes
- Worse than v0.4. The broad exclusion instruction caused the model to filter out real reviewer marks that resembled base drawing content (FFE label, compact parking note). Rolled back this approach in v0.6 in favor of a more targeted exclusion (stamps/initials only).
- C-501 improved (0.3→0.6) but C-301 and HOH-105 regressed significantly.

---

## v0.4 — 2026-05-20 (baseline)

**Aggregate:** recall=0.44, precision=0.31, specificity=1.54

### Changes
- First scored run. Extraction prompt as originally shipped.

### Notes
- Low precision caused by extractor reading base drawing content as markup.
- Low recall caused by judge applying strict literal matching — "DR/SWING BLOCKS EGRESS CORR." was extracted but not matched to "Conference room door swing blocks corridor egress width" because the judge had no guidance on abbreviations or shorthand.

---

## Targets

| Metric | Target | v0.6 (original) | v0.7 |
|--------|--------|---|---|
| Recall | ≥ 0.80 | 0.72 — close, HOH-105 dragging | _pending_ |
| Precision | ≥ 0.70 | 0.55 — C-401 splitting marks | _pending_ |
| Specificity | ≥ 1.50 | 1.58 ✓ | _pending_ |
