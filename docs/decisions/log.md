# Decisions log

Running log of every non-trivial decision, written the moment it happens. One dated entry
each: what was decided, why, and a status. This log stages everything; decisions that turn
out to be architectural get promoted to a numbered ADR in this directory. Prompt deltas go
to `prompts/CHANGELOG.md` instead. Division of labor is spelled out in [README.md](README.md).

Statuses: **COMMITTED** (decided, act on it), **OPEN, empirical** (needs data before it can
be decided; the data source is named), **candidate** (worth doing, not scheduled).

---

## 2026-07-16 — No stack rewrite / Next.js migration

**COMMITTED.** Considered during post-audit planning and rejected. The AI-efficiency
problems the audit surfaced live in the docs and CLAUDE.md layer, not the framework.
Express + Vite + SQLite on Render stays. Revisit only if a platform constraint (not a
preference) forces it.

## 2026-07-16 — Decisions log is committed, with an ADR promotion rule

**COMMITTED.** This file. The take-home used a gitignored working log because the repo was
graded and the log held presubmission material; RedlineIQ is a portfolio repo where the
reasoning being public is a feature. Alternatives rejected: gitignored log (ground truth
invisible to repo readers, drifts from ADRs), folding into `notes/session-log.md`
(decisions drown in narrative). See `docs/superpowers/specs/2026-07-16-workflow-migration-design.md`.

## 2026-07-16 — STATE.md is the living source of truth, updated per ship

**COMMITTED.** Any ship or decision that changes what STATE.md claims updates it in the
same commit. Rejected: frozen-doc-plus-dated-addenda (right for a graded artifact, noise
for a living solo product) and Notion-as-truth (sessions read the filesystem). Notion keeps
strategy and weekly check-offs; the repo holds what agents and readers actually see.

## 2026-07-16 — San Marcos demo sample stays tracked

**COMMITTED**, with a follow-up candidate. `samples/s201-sanmarcos-framing.pdf` is committed
and public while the gitignore declares the evals copy of the same sheet local-only. The
inconsistency is accepted: the live demo serves this sample and the material is publicly
downloadable. **Candidate:** replace the demo sample with a synthetic sheet when convenient,
then untrack the PDF.

## 2026-07-16 — Real firm files quarantine in `intake/`

**COMMITTED.** Gitignored `intake/` is the landing zone for any file a design partner or
pilot firm sends. Nothing moves from there to git, the demo server, or a public post
without written permission. Existing `case_C*` convention covers files once they become
eval cases; this covers the raw set the moment it arrives. Week 3 of the post-audit plan
is gated on exactly this scenario. Lesson imported from the proposal-editor take-home,
where the equivalent rule existed before the first fixture arrived.
