# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Parked in portfolio/maintenance mode since June 2026** (v0.9-portfolio). Read `STATE.md` before proposing feature work — it maps current state, known limitations, and the ordered "if resumed" backlog. Don't start new features unless the user explicitly says they're resuming the project.

## Commands

```bash
npm run dev                          # backend with watch, http://localhost:3001
cd client && npm run dev             # frontend dev server :5173, proxies /api to :3001 (run both)
npm test                             # all unit tests — no API key needed
node test/test-annotation-probe.js   # run a single test file (each is a standalone node script)
npm run eval                         # score active prompt vs working set — needs ANTHROPIC_API_KEY, costs API money
node evals/run-eval.js --prompt v0.7 --working-set   # A/B a specific prompt version
node src/scripts/extract-cli.js ./drawing.pdf --pages 1,3 --verbose   # CLI extraction
cd client && npm run lint            # ESLint (client only; no linter on backend)
```

- Node 22.14.0 pinned via `.nvmrc`. ES modules everywhere. Rasterization needs GraphicsMagick + Ghostscript on PATH (`scoop install graphicsmagick ghostscript` on this machine).
- `npm run build` builds only the client; the backend runs from source.

## Architecture

Hybrid parse/vision extraction pipeline. Every uploaded PDF is probed (`src/utils/pdf-annotation-probe.js`) and routed down one of two paths:

- **Parse path** (`src/services/parse-extraction-service.js`) — digital PDFs with a live annotation layer: markup text + exact coordinates read straight from the PDF via pdfjs-dist, then one cheap text-only Claude call for semantic labels. No rasterization, no Vision.
- **Tiled Vision path** (`src/services/tiled-extraction-service.js`) — scanned/flattened/raster sheets: each page split into ≤1568px tiles (`src/utils/pdf-tiler.js`, sized to Sonnet's server-side resize ceiling), Claude Vision per tile, merge + dedup, then precision filters (`src/services/markup-postprocess.js`).

Both paths return the same result shape, so everything downstream — `job-service.js` (async job runner streaming per-page progress over SSE), SQLite persistence (`db.js` / `project-service.js`), REST routes (`src/routes/api.js`), and the React client — is path-agnostic. The CLI (`src/scripts/extract-cli.js`) applies the same routing.

Extraction is async by design: POST `/api/projects/{id}/extract` returns a jobId; progress streams via SSE at `/api/jobs/{jobId}/status` (multi-page extraction takes tens of seconds per page and would time out synchronously). Architecture decisions are recorded in `docs/decisions/` (ADR format); the two large design specs live under `docs/superpowers/specs/`.

## Prompt iteration and evals — the rules that matter

The eval harness is the spine of the project. Non-obvious constraints:

- **The runtime prompt is `prompts/active.md`**, loaded at startup by `extraction-service.js`. Versioned snapshots (`prompts/v0.6.md` … `v0.10.md`) are immutable history — never edit them. A prompt change means: new version file + update `active.md` + an entry in `prompts/CHANGELOG.md` with hypothesis/delta/rationale.
- **Everything is pinned to `temperature: 0`** — both extraction and the Haiku judge (ADR 0003). Do not reintroduce default temperature; the pre-pin numbers (e.g. the old 0.811 recall) are not comparable to anything current.
- **v0.9 is the pinned baseline** (recall 0.665 · precision 0.687 · specificity 1.509) even though `active.md` is v0.10 — v0.10's prompt-only delta was unattributable at the aggregate.
- **Signal thresholds:** aggregate metric moves >0.02 are signal; per-case moves >0.1 on borderline cases are signal. Anything smaller is run-to-run noise (aggregate σ ≈ 0.003).
- **`evals/holdout/` is a holdout set** — never iterate prompts against it. Tune on the working set (`evals/pdfs/`). Case taxonomy and authoring conventions: `evals/CONVENTIONS.md`.
- Eval runs write JSON + HTML reports to `evals/runs/`, named by date and prompt version.
