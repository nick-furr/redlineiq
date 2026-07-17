# CLAUDE.md

Working rules for this repo. STATE.md is the living source of truth for where the project
stands; read it before proposing work. The July 2026 audit (`docs/audit-2026-07.md`) is the
snapshot the current plan derives from.

## Project status

**Active development as of July 2026.** The roadmap is the post-audit plan (Notion task
"Post-audit plan", mirrored in STATE.md): one meaningful ship per week, four weeks. The
earlier parked/portfolio banner is history.

## Commands

```bash
npm run dev                          # backend with watch, http://localhost:3001
cd client && npm run dev             # frontend dev server :5173, proxies /api to :3001 (run both)
npm test                             # all unit tests, no API key needed
node test/test-annotation-probe.js   # run a single test file (each is a standalone node script)
npm run eval                         # score active prompt vs working set: needs ANTHROPIC_API_KEY, costs API money
node evals/run-eval.js --prompt v0.7 --working-set   # A/B a specific prompt version
node src/scripts/extract-cli.js ./drawing.pdf --pages 1,3 --verbose   # CLI extraction
cd client && npm run lint            # ESLint (client only; no linter on backend)
```

- Node 22.14.0 pinned via `.nvmrc`. ES modules everywhere. Rasterization needs
  GraphicsMagick + Ghostscript on PATH (`scoop install graphicsmagick ghostscript` on this
  machine).
- `npm run build` builds only the client; the backend runs from source.

## Architecture

Hybrid parse/vision extraction pipeline. Every uploaded PDF is probed
(`src/utils/pdf-annotation-probe.js`) and routed down one of two paths:

- **Parse path** (`src/services/parse-extraction-service.js`): digital PDFs with a live
  annotation layer. Markup text and exact coordinates read straight from the PDF via
  pdfjs-dist, then one cheap text-only Claude call for semantic labels. No rasterization,
  no Vision.
- **Tiled Vision path** (`src/services/tiled-extraction-service.js`): scanned, flattened,
  and raster sheets. Each page split into ≤1568px tiles (`src/utils/pdf-tiler.js`, sized to
  Sonnet's server-side resize ceiling), Claude Vision per tile, merge + dedup, then
  precision filters (`src/services/markup-postprocess.js`).

Both paths return the same result shape, so everything downstream is path-agnostic:
`job-service.js` (async job runner streaming per-page progress over SSE), SQLite persistence
(`db.js` / `project-service.js`), REST routes (`src/routes/api.js`), the `/ask` RAG endpoint
(FTS5 retrieval, ADR 0004), and the React client.

The CLI (`src/scripts/extract-cli.js`) applies the same source-type **routing**, but its
raster branch is un-tiled single-image extraction, not the production tiled path
(audit §1). Do not treat CLI vision output as production behavior.

Extraction is async by design: POST `/api/projects/{id}/extract` returns a jobId; progress
streams via SSE at `/api/jobs/{jobId}/status` (multi-page extraction takes tens of seconds
per page and would time out synchronously).

## Prompt iteration and evals: the rules that matter

The eval harness is the spine of the project. Non-obvious constraints:

- **The runtime prompt is `prompts/active.md`**, loaded at startup by
  `extraction-service.js`. Versioned snapshots (`prompts/v0.6.md` … `v0.10.md`) are
  immutable history; never edit them. A prompt change means: new version file + update
  `active.md` + an entry in `prompts/CHANGELOG.md` with hypothesis/delta/rationale.
- **Every Claude call site pins `temperature: 0` per ADR 0003** (vision extraction,
  parse-lane labeling, the Haiku judge). Never add a new API call site without an explicit
  `temperature`. Pre-pin numbers (e.g. the old 0.811 recall) are not comparable to anything
  current.
- **The harness's default vision path is not production's**: production tiles every raster
  page; the harness only tiles with `--tile`. Baselines that claim to represent production
  must run with `--tile`.
- **v0.9 is the pinned baseline** (recall 0.665 · precision 0.687 · specificity 1.509) even
  though `active.md` is v0.10; v0.10's prompt-only delta was unattributable at the
  aggregate.
- **Signal thresholds:** aggregate metric moves >0.02 are signal; per-case moves >0.1 on
  borderline cases are signal. Anything smaller is run-to-run noise (aggregate σ ≈ 0.003).
- **`evals/holdout/` is a holdout set**; never iterate prompts against it. Tune on the
  working set (`evals/pdfs/`). Case taxonomy and authoring conventions:
  `evals/CONVENTIONS.md`.
- Eval runs write JSON + HTML reports to `evals/runs/`, named by date and prompt version.

## Truth layer

- **STATE.md is the living source of truth.** Any ship or decision that changes what it
  claims updates it in the same commit. If a doc claim and reality diverge, fixing the doc
  is part of the change, not follow-up work.
- **Every non-trivial decision goes to `docs/decisions/log.md` the moment it happens**:
  what, why, status (COMMITTED / OPEN because empirical / candidate). Architectural
  decisions get promoted to numbered ADRs in `docs/decisions/`. Prompt deltas go to
  `prompts/CHANGELOG.md`. Division of labor: `docs/decisions/README.md`.

## Scope guardrails

- Build the current week's gate from STATE.md's plan. Nothing from a later week starts
  before the current week's ship lands.
- **The deferred list stays deferred until the named evidence arrives** (reasons in the
  decisions log and STATE.md): status write-back (needs durable object storage first),
  vision tuning (re-assess after Week 2 numbers), the shared `assembleExtractionResult`
  refactor (opportunistic only, when already touching those files), stack rewrite (decided
  against 2026-07-16). Knowing a feature would be nice is not a reason to build it.

## Process rules

- **Real firm files (design partners, pilots) land in gitignored `intake/` first** and
  never reach git, the demo server, or a LinkedIn post without written permission. Cleared
  eval material follows the local-only `case_C*` convention in `evals/CONVENTIONS.md`.
  Shared with permission for testing is not permission to republish.
- The API key is never committed, pasted, or logged. `ANTHROPIC_API_KEY` via env only.
- Conventional commits (feat:, fix:, chore:, docs:, refactor:), real messages, unsquashed
  history that tells the story.
- `npm test` and `cd client && npm run lint` pass before every push.
- No em dashes and no AI-sounding language in any writing: README, commits, UI copy,
  code comments, posts.
