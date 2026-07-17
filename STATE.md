# Project State: RedlineIQ

The living source of truth for where the project stands. Any ship or decision that changes
what this file claims updates it in the same commit (rule in `CLAUDE.md`). Last updated
2026-07-16, at the start of the post-audit push.

## Where it stands

**Public v1 note (2026-07-17):** the public `redlineiq` repo is archived at this commit as
the v1 portfolio artifact. Active development, including this file's future updates,
continues in a private repository (see `docs/decisions/log.md`, "v1 public repo archived").

Active development as of July 2026. RedlineIQ is a working, deployed end-to-end pipeline:
upload a marked-up plan PDF, get a structured, categorized checklist with confidence and
auto-flagged ambiguity. Live at [redlineiq-app.onrender.com](https://redlineiq-app.onrender.com);
SQLite persistence, Docker-on-Render deploy.

Extraction is a hybrid: an annotation-layer probe routes each upload. Digital PDFs with live
annotations are parsed losslessly (pdfjs, exact coordinates, one cheap text-only label call);
scanned and flattened sheets go through tiled Claude Vision with deterministic precision
post-processing. Both lanes converge on one result shape. A RAG Q&A endpoint (`/ask`,
FTS5 retrieval per ADR 0004) answers questions over a project's extracted markups.

A full read-only codebase audit landed 2026-07-16: `docs/audit-2026-07.md`. The current
roadmap derives from it.

## Current numbers

- **Pinned v0.9 baseline** (9-case working set as of that pin, untiled default harness
  config): recall 0.665 · precision 0.687 · specificity 1.509. Historical reference for
  prompt-only deltas; not directly comparable to the line below (different case count,
  untiled).
- **Week 1 production-equivalent baseline** (2026-07-17, `evals/runs/2026-07-17_current_tile.json`):
  active prompt (v0.10), `--tile` (matches production's raster path), full 12-case working
  set, temperature pin landed. Aggregate: **recall 0.835 · precision 0.593 · specificity
  1.593**. By regime: raster n=10 recall 0.818 / precision 0.520; digital_annotation n=2
  recall 0.923 / precision 0.959; router accuracy 100%. This is the reference for Week 2's
  "re-run eval, compare against Week 1 baseline."
- The raster precision hit (0.520) is the known tiling tradeoff already logged under Known
  limitations below — indiscriminate tiling triples extracted count and catches more
  substrate-text false positives on clean sheets. Not a regression; it is what production
  has actually been doing since Phase 1, now measured honestly instead of masked by an
  untiled harness default.
  The parse lane's temperature pin landed 2026-07-16; parse-lane numbers from before it are
  not comparable.

## Known limitations

- **Mixed PDFs lose their raster pages silently.** Routing is document-level: one live
  annotation anywhere sends the whole file down the parse lane, where scanned pages yield
  empty results with no warning. The per-page counts needed to fix it are already computed
  and consumed by nothing. This is the Week 3 ship, gated before any design partner sends
  a real file.
- **Text-less annotations are dropped on the parse lane.** A cloud with no `/Contents` never
  reaches output: a built-in recall ceiling, not a model failure.
- **Substrate-text false positives** remain the open precision class on the vision path (the
  model transcribes the drawing's own printed text as redlines).
- **`drawing_reference` is hardcoded `'Unknown'` on parse output**, degrading `/ask`
  retrieval and blocking per-sheet grouping. Week 2 work, and the upstream fix coordinate
  linking needs.
- **Real hand-drawn / photographed sheets are the hard ceiling.** Clean digital markups
  score well; photographed reviewer markup is where recall falls off.
- **Clarification loop is one-directional**; no engineer reply path.
- **No formatted PDF export**; checklist exports as CSV only.

## The plan (from the post-audit Notion task, one meaningful ship per week)

1. **Week 1, make the numbers real:** pin `temperature: 0` in `labelMarkups`, capture the
   pdfjs annotation id, fix the stale-truth headers and CLI routing claims, delete dead
   weight, bound the 429 retry, run the `--tile` baseline. Plus this workflow migration.
2. **Week 2, parse-lane eval depth:** more `digital_annotation` cases, populate
   `drawing_reference`, re-flatten and label the two watermarked fixtures, re-run against
   the Week 1 baseline.
3. **Week 3, per-page routing:** wire up `perPageCounts`, add a mixed digital+raster
   fixture. Lands before any pilot file arrives.
4. **Week 4, coordinate linking ships:** the `.lsp` generator (per-sheet AutoLISP zoom to
   `/Rect`), verify the plot-scale assumption with a human, record the demo.

**Deferred until the named evidence arrives** (do not build ahead): status write-back
(needs durable object storage first; belongs in the v2 one-pager), vision tuning (re-assess
after Week 2 numbers), the shared `assembleExtractionResult` refactor (opportunistic only,
when touching those files), stack rewrite (decided against 2026-07-16, see
`docs/decisions/log.md`).

## Where everything lives (project map)

| Looking for… | Go to |
|---|---|
| What it is, how to run it, the architecture | [`README.md`](README.md) |
| Live demo + walkthrough video | links at the top of the README |
| Current state, limitations, the plan (this file) | [`STATE.md`](STATE.md) |
| The July 2026 audit every plan item cites | [`docs/audit-2026-07.md`](docs/audit-2026-07.md) |
| Running decisions log (staged, promoted to ADRs) | [`docs/decisions/log.md`](docs/decisions/log.md) |
| *Why* decisions were made (ADRs + the two big design specs/plans) | [`docs/decisions/`](docs/decisions/) → its index links the hybrid + tiling specs |
| Prompt iteration history, eval numbers, failed experiments | [`prompts/CHANGELOG.md`](prompts/CHANGELOG.md); active prompt: [`prompts/active.md`](prompts/active.md) |
| Full build narrative (every session, dead end, commit, metric) | [`notes/session-log.md`](notes/session-log.md) |
| Eval case taxonomy + authoring conventions | [`evals/CONVENTIONS.md`](evals/CONVENTIONS.md) |
| Real-world friction / dogfooding notes | [`dogfood/`](dogfood/) |
| Incoming design-partner files (gitignored, quarantine) | `intake/` |
| Local setup (Node pin, GraphicsMagick/Ghostscript, troubleshooting) | [`DEV_SETUP.md`](DEV_SETUP.md) |

## In one paragraph (for applications / interviews)

RedlineIQ is a deployed, end-to-end AI pipeline that turns marked-up construction plan PDFs
into structured, actionable checklists: every redline annotation extracted with type,
location, and confidence, ambiguous ones auto-flagged. The engineering depth is in the
extraction architecture and the measurement discipline. A source-type probe routes digital
PDFs through a lossless annotation-layer parse (no Vision call) and everything else through
tiled Claude Vision that splits sheets into ≤1568px tiles to beat the model's server-side
resize ceiling, with a deterministic post-processing pass for precision. Quality is tracked
by a reproducible eval harness (pinned `temperature: 0`, conceptual-equivalence LLM judge,
σ ≈ 0.003 aggregate) over a versioned case set, with honest, defensible metrics rather than
cherry-picked ones. Built solo, shipped on Docker/Render, documented with ADRs, design
specs, a decisions log, and a full build log.
