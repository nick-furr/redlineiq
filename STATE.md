# Project State — RedlineIQ

A map for future-me. Last updated June 2026, at the point active work was paused.

## Where it stands

RedlineIQ is a working, deployed end-to-end pipeline: upload a marked-up plan PDF →
pages rendered to images → Claude Vision extracts annotations → structured, categorized
checklist with confidence and auto-flagged ambiguity. Live at
[redlineiq-app.onrender.com](https://redlineiq-app.onrender.com). The codebase lives
entirely under `src/`; persistence is SQLite; deploy is Docker-on-Render.

The eval harness is the real spine of the project — a deterministic (temperature 0,
per ADR 0003) scoring loop over a versioned working set of cases, with an LLM judge that
matches on conceptual equivalence. Prompt versions are tracked in
`prompts/CHANGELOG.md` with hypothesis/delta/rationale per iteration.

## Current numbers (pinned v0.9 baseline, 9 working-set cases)

- **Recall 0.665 · Precision 0.687 · Specificity 1.509** — fully deterministic config.
- Bare-mark recall (the sub-metric v0.9's two-pass prompt targeted): **57.9%** (11/19),
  up from 37.5% on v0.8.
- These are honest, post-rebaseline numbers. The earlier 0.811 figure was measured
  against a non-deterministic stack (temp 1.0) and is not comparable — see the
  "v0.9 (rebaselined)" entry in `prompts/CHANGELOG.md` and ADR 0003.

## Known limitations

- **Two-pass extraction doesn't generalize across disciplines.** It lifted civil/arch
  bare-mark recall +0.204 but cases 003 (utility), 008 (electrical), and 010 (structural)
  each caught 0/2 — the Pass 2 checklist examples are civil/arch-flavored.
- **Tiling is eval-only, not productionized.** Splitting high-res sheets into ≤1568px
  tiles cracked the model-resolution ceiling (case_006: 0.231 → 0.538 recall) but
  indiscriminate tiling triples extracted count and tanks precision on clean synthetic
  sheets. Needs source-aware (vector vs raster) conditional tiling before shipping.
- **Real hand-drawn / photographed sheets are the hard ceiling.** Clean digital markups
  score well; photographed reviewer markup is where recall falls off.
- **Clarification loop is one-directional** — ambiguous items auto-flag, but there's no
  engineer reply path.
- **No formatted PDF export** — checklist exports as CSV only.

## Top things I'd do next if I picked it back up

1. **Per-discipline Pass 2 few-shot** — extend Pass 2 examples to MEP/structural language
   (or go per-discipline) so bare-mark recall generalizes past civil/arch. Highest-signal
   lever; cases 003/008/010 are the proof set.
2. **Conditional/source-aware tiling** — detect raster vs vector source, tile only
   hand-drawn/scanned sheets, tighten dedup. Lands the case_006 gain in production without
   the precision regression on clean sheets.
3. **Parse/vision hybrid path** — route digital PDFs through annotation parsing and
   reserve tiled vision for scanned/hand-drawn. (Phase 1 merged; the source-type router
   exists — see `src/utils/pdf-annotation-probe.js`.)
4. **Clarification reply workflow** — close the loop on auto-flagged ambiguous markups.
5. **Formatted PDF report export** — for clean drafter handoff.

## Pointers

- Architecture rationale: `docs/decisions/` (ADRs, Nygard format).
- Prompt iteration history: `prompts/CHANGELOG.md`; active prompt: `prompts/active.md`.
- Eval conventions + case taxonomy: `evals/CONVENTIONS.md`.
- Local setup: `DEV_SETUP.md`.
