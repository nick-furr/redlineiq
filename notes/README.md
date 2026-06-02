# notes/

Brain dump for ideas that don't fit anywhere else yet.

Notes belong here when they're too rough for an ADR, too forward-looking for a Notion ticket, too internal for the README, and don't have a natural home in `dogfood/` (friction journals) or `prompts/CHANGELOG.md` (scored prompt changes).

## Typical shapes

- **Strategy / positioning** — market thinking, competitive landscape, pricing experiments, framing language
- **Investigation captures** — non-trivial findings from debugging sessions that don't make it into commit messages
- **Future-work designs** — sketches of features or refactors that aren't ready for tickets
- **External references collected** — vendor doc excerpts, paper summaries, benchmark numbers used in decisions

## What a good note looks like

- Self-contained: a future reader (or future-you) can pick it up cold
- Cites sources: link commits, files, external docs, Notion tickets
- Dated: a header note like `Captured YYYY-MM-DD` so staleness is visible
- Promotes when ready: a note becomes a Notion ticket when actionable, an ADR when decided, or part of the README when user-facing

## Files

Flat layout — no subdirectories. If the directory grows past ~15 files, prune stale ones or carve out structure then.

## Relationship to other doc surfaces

| Surface | Purpose | Example |
|---|---|---|
| `README.md` | What this product is, how to run it | Live demo link, install instructions |
| `dogfood/YYYY-MM-DD.md` | Raw friction journals from using the product end-to-end | "10:16 - I see a red cloud around Office 01W but no actual bubble" |
| `prompts/CHANGELOG.md` | Scored prompt iterations with deltas | "v0.9 +0.204 bare-mark recall" |
| `docs/decisions/NNNN-*.md` | Architectural decisions (ADRs) with consequences | "SQLite via better-sqlite3" |
| `notes/session-log.md` | Factual per-session build record — what shipped, numbers, dead ends, commits | "precision 0.379 → 0.625, recall held" |
| `notes/*.md` | Everything else worth keeping | Investigation findings, strategy thoughts, design sketches |
| `~/.claude/.../memory/*.md` | Personal-context for Claude across sessions | "User prefers terse responses" |
