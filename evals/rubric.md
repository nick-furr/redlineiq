# Eval Rubric

This document explains how `run-eval.js` scores extraction results. Read this before trusting any number.

## What the harness does

For each PDF in `pdfs/` (excluding `holdout/` when `--working-set` is passed):

1. Converts the PDF to page images via the same `pdfToImages` function production uses
2. Runs the extraction prompt against each page via `extractMarkupsFromPage`
3. For each expected markup in the label file, asks Claude Haiku: "Is this concept captured anywhere in the extracted output?" — 3x, majority vote
4. Computes three scores and writes a JSON + HTML report to `runs/`

## The three scores

### Recall
`matched / total_expected`

What fraction of the expected markups did the extractor find? This is the primary metric. A good extractor should find all the marks, including the ambiguous ones (m5, m8 in C-301).

**Target**: ≥ 0.80 on working set before shipping a prompt version.

### Precision
`matched / total_extracted`

Approximation of "what fraction of what the extractor returned was real?" If the extractor returns 20 markups but only 10 match expected concepts, precision = 0.5 — the other 10 are noise or hallucinations.

**Caveat**: This is an approximation. An extractor could legitimately find more real markups than the label documents (the label is a minimum, not an exhaustive census). Don't penalize a run for precision < 1.0 without checking the HTML report.

**Target**: ≥ 0.70. Below 0.5 almost always means hallucinated markups.

### Specificity
`avg(specificity_target) across matched items only`

`specificity_target` in the label file is:
- `2` — clear, specific directive (e.g., "change 442.0 to 142.0")
- `1` — requires drafter judgment or research (e.g., "cite applicable zoning section")
- `0` — deliberately ambiguous (bare `verify?` or `??`)

Higher specificity means the extractor is capturing the harder, more detailed marks — not just the obvious ones. An extractor that only catches the easy marks scores low specificity even with high recall.

**Target**: ≥ 1.5, meaning the extractor is consistently getting clear marks AND attempting the ambiguous ones.

## How to interpret a run

| Pattern | Likely cause |
|---------|-------------|
| Low recall, high precision | Extractor is conservative — missing marks but not hallucinating |
| High recall, low precision | Extractor is over-extracting — noise, duplicates, or splitting marks |
| Low specificity, OK recall | Only catching obvious marks; failing on nuanced ones |
| Ambiguous marks (m5, m8) always missed | Extractor may be dropping marks with no clear action |
| Ambiguous marks always matched | Extractor may be hallucinating confident interpretations for vague marks |

## Adding a new case

1. Add the marked-up PDF to `evals/pdfs/` named `case_NNN_<description>.pdf`
2. Create `evals/labels/case_NNN_<description>.json` with `expected_markups`
3. Each expected markup needs: `id`, `concept`, `category`, `page`, `specificity_target` (0/1/2), `is_ambiguous`
4. Include 1–2 marks with `"is_ambiguous": true` and `"specificity_target": 0`
5. Run the harness. A first run recall of 0.6–0.8 is normal. Below 0.4 suggests a label or PDF problem.

## Holdout discipline

PDFs in `holdout/` are never used during prompt iteration. Run against holdout only when:
- You think you have a stable prompt version, AND
- You want to check for overfitting to the working set

If working set recall improves but holdout stays flat across two versions, you're overfitting. Back up and broaden the few-shot examples.
