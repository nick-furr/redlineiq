# AI-Assisted Engineering Layer — Design

**Date:** 2026-07-02
**Status:** Approved
**Scope:** Portfolio-visible agentic tooling + one small product feature. The project stays in maintenance mode (v0.9-portfolio); nothing here changes the extraction pipeline or the pinned eval baseline.

## Goal

Make the AI-engineering practices this project already runs on — eval discipline, prompt versioning, deterministic pipelines — visible and executable in the repo itself: a checked-in Claude Code agent team, a project skill, CI-integrated AI code review, and a small retrieval-augmented Q&A endpoint over extracted markups.

## Components

### 1. Claude Code agent team — `.claude/agents/`

Four subagents, each encoding rules that already exist in this repo (CLAUDE.md, ADR 0003, `prompts/CHANGELOG.md`, `STATE.md`) so they enforce real project constraints rather than generic advice:

| Agent | Role | Grounded in |
|---|---|---|
| `eval-analyst` | Interpret `evals/runs/` reports; compare against the pinned v0.9 baseline with the real signal thresholds | ADR 0003, CHANGELOG errata, σ ≈ 0.003 |
| `prompt-reviewer` | Gate prompt changes: immutable snapshots, changelog discipline, temperature pin, holdout protection | CLAUDE.md prompt rules |
| `code-reviewer` | Review diffs against project conventions (ESM, path-agnostic result shape, thin routes, offline tests) | CLAUDE.md + codebase patterns |
| `pipeline-debugger` | Systematic triage of extraction failures with the known failure taxonomy | STATE.md limitations, CLI tooling |

Requires a `.gitignore` change: `.claude/` is currently ignored wholesale; switch to ignoring only `.claude/settings.local.json` so agents and skills are committed.

### 2. Project skill — `.claude/skills/prompt-iteration/`

The prompt-versioning workflow from CLAUDE.md as an executable checklist (hypothesis → snapshot → active.md → CHANGELOG → working-set eval → threshold comparison). One skill, no fluff.

### 3. CI-integrated Claude review — `.github/workflows/claude-review.yml`

`anthropics/claude-code-action@v1` reviews every non-draft PR against CLAUDE.md conventions. Requires the `ANTHROPIC_API_KEY` repo secret; costs cents per PR on a low-traffic repo.

### 4. RAG endpoint — `POST /api/projects/:id/ask`

Ask natural-language questions about a project's extracted markups; answers cite specific markup IDs.

- **Retrieval:** SQLite **FTS5** (BM25) over markup text/type/location/sheet — an external index table on `checklist_items`, kept in sync by insert/delete triggers, backfilled on startup for existing databases. Zero new dependencies, no embedding vendor. Rationale recorded as **ADR 0004** (per-project corpora are tens-to-hundreds of short markups heavy on exact tokens like sheet refs and dimensions; Claude does the semantic lift at synthesis time; embeddings would add a vendor + key for no measurable gain at this scale).
- **Synthesis:** one text-only Claude call (`config.anthropic.model`, `temperature: 0` per ADR 0003), grounded strictly in the retrieved markups, citing `[MK-xxx]` IDs. No retrieval hits → honest "no matching markups" response with **no API call**.
- **Sample project:** the demo project lives in JSON, not SQLite, so it gets an in-memory token-overlap ranker sharing the same synthesis path — the live demo works without a database write.
- **Guards:** same demo-key gate as `/extract`, plus its own rate limit (10/hour/IP).
- **Testing:** offline test (`test/test-ask-retrieval.js`) covering FTS indexing/triggers/backfill/cascade-delete and both retrieval paths against a throwaway DB — wired into `npm test`, no API key or network needed, CI stays free and deterministic.

### 5. README — "AI-assisted engineering" section

Surfaces all of the above with links (agents, skill, CI review, ask endpoint, ADR 0004), since the README is the entry point for anyone browsing the repo.

## Error handling

- FTS query strings are built from sanitized word tokens (never raw user input into `MATCH`) so FTS5 syntax can't be injected or crash the query.
- The ask route returns 400 on a missing question, 404 on unknown project, and surfaces Claude API failures as 500s with a meaningful message.

## Out of scope

Embedding-based retrieval, cross-project search, conversation memory on the ask endpoint, and any change to extraction behavior or eval numbers.
