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
- **Tiling is unconditional on the raster path.** Tiling ships in production (it cracked
  the model-resolution ceiling — case_006: 0.231 → 0.538 recall) and source-type routing
  is live (`pdf-annotation-probe.js`), but every raster page is tiled regardless of need.
  Indiscriminate tiling triples extracted count and hurts precision on clean sheets;
  `markup-postprocess.js` filters the worst of it. The open work is gating tiling on actual
  sheet resolution rather than tiling all raster.
- **Substrate-text false positives are the open precision class.** On the tiled vision
  path, the model transcribes the drawing's own printed black text as if it were redlines.
  Post-processing removed the location-only-cloud and cross-tile-dup FPs, but ~8/13 of
  case_012's FPs are this substrate-text class — can't be deduped away. The fix is a prompt
  rule ("extract only the colored annotation layer, never the substrate") and, for digital
  PDFs, the parse path (which sidesteps it entirely by reading the annotation objects).
- **Real hand-drawn / photographed sheets are the hard ceiling.** Clean digital markups
  score well; photographed reviewer markup is where recall falls off.
- **Clarification loop is one-directional** — ambiguous items auto-flag, but there's no
  engineer reply path.
- **No formatted PDF export** — checklist exports as CSV only.

## Top things I'd do next if I picked it back up

1. **Per-discipline Pass 2 few-shot** — extend Pass 2 examples to MEP/structural language
   (or go per-discipline) so bare-mark recall generalizes past civil/arch. Highest-signal
   lever; cases 003/008/010 are the proof set.
2. **Conditional tiling** — production tiles every raster page; gate it on actual sheet
   resolution (and tighten merge dedup) so clean low-res scans skip the precision hit.
   Source-type routing and the parse/vision split already ship — this is the remaining
   refinement on the raster path.
3. **Parse/vision hybrid — Phase 2.** Phase 1 ships: digital PDFs with a live annotation
   layer are parsed losslessly, everything else routes to tiled vision (see
   `src/utils/pdf-annotation-probe.js`, `src/services/parse-extraction-service.js`).
   Phase 2 is the `digital_flattened` regime — digital PDFs whose markups were flattened
   into the page and so carry no annotation layer to parse.
4. **On-drawing highlighting** — the parse path already captures `{ page, rect, subtype }`
   coordinates per markup (PDF points, bottom-left origin); the UI to overlay them on the
   rendered drawing is not built. Lowest-risk visual win, data is already there.
5. **Clarification reply workflow** — close the loop on auto-flagged ambiguous markups.
6. **Formatted PDF report export** — for clean drafter handoff.

## Where everything lives (project map)

One place to orient from — whether resuming the build or describing it for an opportunity.

| Looking for… | Go to |
|---|---|
| What it is, how to run it, the architecture | [`README.md`](README.md) |
| Live demo + walkthrough video | links at the top of the README |
| Current state, limitations, what's next (this file) | [`STATE.md`](STATE.md) |
| *Why* decisions were made (ADRs + the two big design specs/plans) | [`docs/decisions/`](docs/decisions/) → its index links the hybrid + tiling specs |
| Prompt iteration history, eval numbers, failed experiments | [`prompts/CHANGELOG.md`](prompts/CHANGELOG.md); active prompt: [`prompts/active.md`](prompts/active.md) |
| Full build narrative — every session, dead end, commit, metric | [`notes/session-log.md`](notes/session-log.md) |
| Eval case taxonomy + authoring conventions | [`evals/CONVENTIONS.md`](evals/CONVENTIONS.md) |
| Real-world friction / dogfooding notes | [`dogfood/`](dogfood/) |
| Local setup (Node pin, GraphicsMagick/Ghostscript, troubleshooting) | [`DEV_SETUP.md`](DEV_SETUP.md) |

## In one paragraph (for applications / interviews)

RedlineIQ is a deployed, end-to-end AI pipeline that turns marked-up construction plan PDFs into structured, actionable checklists — extracting every redline annotation with type, location, and confidence, and auto-flagging ambiguous ones. The engineering depth is in the extraction architecture and the measurement discipline: a source-type probe routes digital PDFs through a **lossless annotation-layer parse** (no Vision call) and everything else through **tiled Claude Vision** that splits sheets into ≤1568px tiles to beat the model's server-side resize ceiling, with a deterministic post-processing pass for precision. Quality is tracked by a **reproducible eval harness** (pinned `temperature: 0`, conceptual-equivalence LLM judge, σ ≈ 0.003 aggregate) over a versioned case set — with honest, defensible metrics rather than cherry-picked ones. Built solo, shipped on Docker/Render, documented with ADRs, design specs, and a full build log.
