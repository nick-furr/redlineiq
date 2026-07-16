# Workflow migration from proposal-editor: design

Date: 2026-07-16
Status: approved (brainstormed interactively, decisions recorded below)
Source: Week 1 bullet of the post-audit plan (Notion task "Post-audit plan: eval trust > parse coverage > per-page routing > coordinate linking"), which reads: "overhaul CLAUDE.md to takehome standard, add decisions log alongside ADRs, port plugin setup that worked."

## Goal

Port the working method that made the Buoyant take-home (proposal-editor) run well into RedlineIQ as durable, repo-resident rules, so every future session starts with the same discipline without re-deriving it.

## What the take-home workflow actually was

Five mechanisms, not vibes:

1. A gospel source of truth (SPEC.md) corrected by dated addenda, never silently overridden.
2. A running decisions log made binding on every session by a CLAUDE.md rule; entries logged the moment a decision happens, with reasoning.
3. Hard scope guardrails: the explicit cuts stay cut, with written reasons.
4. Architecture locks stated with their reasons so they survive pushback.
5. Eval discipline: declared baselines, measured claims, honest reporting of flaps.

## Decisions made during this design (with alternatives considered)

- **Decisions log shape: committed `docs/decisions/log.md` with a promotion rule.** Every non-trivial decision lands there when it happens (what, why, status). Architectural ones get promoted to numbered ADRs; prompt deltas keep going to `prompts/CHANGELOG.md`. Rejected: a gitignored working log (take-home mechanic; ground truth invisible in a portfolio repo) and extending `notes/session-log.md` (decisions would drown in narrative).
- **Truth layer: living STATE.md, updated per ship.** STATE.md is rewritten to active-development status and any ship or decision that changes what it claims updates it in the same commit. Rejected: frozen-audit-plus-addenda (an audit is a diagnosis, not a spec) and Notion-as-truth (sessions read the filesystem, not Notion). Notion keeps strategy and weekly check-offs; the repo holds what the agent reads.
- **San Marcos sample (`samples/s201-sanmarcos-framing.pdf`) stays tracked.** It is the live demo's sample sheet and the material is publicly downloadable. The inconsistency with the gitignore's local-only stance on the same sheet is accepted and logged; replacing the demo sample with a synthetic sheet is a candidate for later, not scheduled work.
- **Plugin setup needs no porting.** `enabledPlugins` lives in the global `~/.claude/settings.json`, so RedlineIQ sessions already get superpowers, karpathy, context7, playwright, frontend-design, document-skills, and claude-api. The per-project piece is the permissions allowlist, handled below.

## The work

### 1. CLAUDE.md overhaul

Keep Commands, Architecture, and the eval rules (already good). Change:

- Project status: replace the "parked in portfolio/maintenance mode" block with active status. Post-audit plan in motion, one meaningful ship per week, STATE.md is the live map.
- Fix stale-truth claims the audit flagged in this file itself: the temperature-pin sentence becomes accurate (vision path and judge pinned per ADR 0003; the parse-lane label call is unpinned until the Week 1 fix lands), and the CLI routing claim gets corrected.
- New "Scope guardrails" section: the explicitly-deferred list (status write-back, vision tuning before Week 2 numbers, shared `assembleExtractionResult` refactor opportunistic only, no stack rewrite) stays deferred until the named evidence arrives. Do not build ahead of the current week's gate.
- New "Truth layer" section: STATE.md living source of truth, same-commit update rule; decisions log binding on every session; promotion rule to ADRs; prompt deltas to `prompts/CHANGELOG.md`.
- New "Process rules" section: client-file quarantine (item 4), secrets never committed, conventional commits with real messages, `npm test` plus client lint before push, no AI-sounding language and no em dashes in README, posts, UI copy, or comments.

### 2. Decisions log

Create `docs/decisions/log.md`. One dated entry per decision: what, why, status (COMMITTED / OPEN because empirical / candidate). Seed entries: the no-stack-rewrite decision (2026-07-16), the decisions in this spec (log shape, truth layer, San Marcos), and the audit-report commit decision below. Update `docs/decisions/README.md` with a paragraph on the division of labor: log stages everything, ADRs hold architecture, CHANGELOG holds prompt deltas, session-log holds narrative.

### 3. STATE.md rewrite

From parked map to living state doc: current architecture as shipped (hybrid routing, /ask endpoint), pinned v0.9 baseline numbers, known limitations refreshed from the July audit, the four-week plan distilled from the Notion task, and the deferred list. The "top things I'd do next if I picked it back up" section is deleted as superseded.

### 4. Client-file intake rule

Create gitignored `intake/` directory (with a brief README inside explaining the rule, since the directory itself cannot be committed empty otherwise). CLAUDE.md rule: real firm files land in `intake/` first and never reach git, the demo server, or a LinkedIn post without written permission. The existing `case_C*` convention covers files once they become eval cases; this covers the raw set the moment a design partner sends it. Week 3 of the plan is gated on exactly this scenario.

### 5. Permissions allowlist cleanup

Rewrite `.claude/settings.local.json` down to RedlineIQ-relevant generics: git/gh/npm/node wildcards, Notion tools, curl to localhost and the Render URL, playwright tools, scoop. Drop the roughly 80 one-off and other-repo entries (resume packing, akane, BenefitsService, tracked-var artifacts). File is gitignored, so this is a local-only change.

### 6. Commit the audit report

`docs/audit-2026-07.md` is untracked; the whole post-audit plan cites it. Scan it for anything that should not be public (names, keys, client references), then commit it.

### 7. Notion updates

- RedlineIQ hub page: refresh Current State (last updated 2026-05-31) to July 2026 reality: hybrid and /ask shipped, audit done, post-audit plan is the active roadmap, pilot outreach live. Replace the dead "next gate" list.
- Post-audit plan task: check off the workflow-migration bullet once the repo work is committed.

## Execution notes

Docs and config only, no code changes. A short series of conventional commits on main (`docs:`, `chore:`). Verification: read-through of each rewritten file against the audit and plan for factual claims, `git status` clean at the end, and the gitignore rule for `intake/` proven with `git check-ignore`.

## Out of scope

Everything else in Week 1 (temperature pin, annotation id capture, dead-weight deletion, 429 bound, tiled baseline run) is its own work, not this migration. The stale-truth fixes in service-file headers are also separate; this spec touches only CLAUDE.md's instances.
