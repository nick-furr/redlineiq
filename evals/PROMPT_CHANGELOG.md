# Prompt Changelog

Tracks what changed in the extraction prompt and eval harness between scored versions.
Run results are in `evals/runs/YYYY-MM-DD_<version>.json`.

---

## v0.6 — 2026-05-20
**Aggregate:** recall=0.72, precision=0.55, specificity=1.58

### Changes
- **`evals/lib/llm-judge.js`**: Added system prompt to the Haiku judge instructing it to match
  conceptually, not literally. Covers engineering shorthand, abbreviations, and OCR-mangled text.
  ("DR/SWING BLOCKS EGRESS" should match "door swing blocks corridor egress width".)
- **`src/services/extraction-service.js`**: Added Rule 8 excluding non-content marks: reviewer
  stamps ("REVIEW SET"), initials blocks, date stamps, and signature areas.
- **`evals/run-eval.js`**: Added `extracted_markups` array to run JSON output for debugging
  precision failures without re-running.

### Notes
- Recall hit target range (≥0.70) on 3 of 5 sheets. C-401 is the precision outlier (18 extracted,
  7 matched) — likely splitting marks or reading engineer callouts as reviewer marks.
- HOH-105 consistently misses m1 (bldg height), m4 (window sill west), m5 (grade line north) —
  these marks are in tight margins and may need stronger mark placement in the synthetic PDF.
- Ambiguous bare marks (verify?, ??) still missed on C-401 and C-501 — low visual prominence.

---

## v0.5 — 2026-05-20
**Aggregate:** recall=0.38, precision=0.26, specificity=1.68

### Changes
- **`src/services/extraction-service.js`**: Added "Critical distinction" paragraph instructing the
  model to focus only on reviewer-added annotations and exclude base drawing content.

### Notes
- Worse than v0.4. The broad exclusion instruction caused the model to filter out real reviewer
  marks that resembled base drawing content (FFE label, compact parking note). Rolled back this
  approach in v0.6 in favor of a more targeted exclusion (stamps/initials only).
- C-501 improved (0.3→0.6) but C-301 and HOH-105 regressed significantly.

---

## v0.4 — 2026-05-20 (baseline)
**Aggregate:** recall=0.44, precision=0.31, specificity=1.54

### Changes
- First scored run. Extraction prompt as originally shipped.

### Notes
- Low precision caused by extractor reading base drawing content as markup.
- Low recall caused by judge applying strict literal matching — "DR/SWING BLOCKS EGRESS CORR."
  was extracted but not matched to "Conference room door swing blocks corridor egress width"
  because the judge had no guidance on abbreviations or shorthand.

---

## Targets
| Metric | Target | v0.6 status |
|--------|--------|-------------|
| Recall | ≥ 0.80 | 0.72 — close, HOH-105 dragging |
| Precision | ≥ 0.70 | 0.55 — C-401 splitting marks |
| Specificity | ≥ 1.50 | 1.58 ✓ |
