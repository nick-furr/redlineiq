# Architecture Decision Records

Decisions are recorded chronologically. Each entry follows [Michael Nygard's ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions): Context, Decision, Consequences, Alternatives.

## Where a decision goes

Four mechanisms, one rule each. [`log.md`](log.md) stages everything: every non-trivial
decision gets a dated entry there the moment it happens, with reasoning and a status.
Decisions that turn out architectural are promoted from the log to a numbered ADR here.
Prompt-level deltas go to [`prompts/CHANGELOG.md`](../../prompts/CHANGELOG.md). The build
narrative (what happened, in order, with dead ends) stays in
[`notes/session-log.md`](../../notes/session-log.md). If a choice is being made and none of
these files is being written to, it is not decided yet.

| # | Title | Status | Summary |
|---|---|---|---|
| [0001](0001-async-sse-extraction.md) | Async SSE for extraction | Accepted | Background job + SSE progress stream so multi-page extractions survive load-balancer timeouts. |
| [0002](0002-sqlite-persistence.md) | SQLite via better-sqlite3 | Accepted | Embedded SQL database with row-level updates; replaces flat-file JSON that lost concurrent writes. |
| [0003](0003-pin-model-versions.md) | Make eval deterministic — pin temperatures and follow per-generation model-pinning convention | Accepted | Pin `temperature: 0` on both extraction and judge API calls; drop the now-redundant 3x judge vote; for 4.6+ generation use dateless form (it IS the pin per Anthropic docs), for 4.5 and earlier use dated form. |
| [0004](0004-fts5-retrieval-for-ask.md) | FTS5 keyword retrieval, not embeddings, for markup Q&A | Accepted | The `/ask` RAG endpoint retrieves via SQLite FTS5 (BM25, trigger-synced, zero new deps) — per-project corpora are tiny and exact-token heavy, and Claude does the semantic lift at synthesis. Embeddings deferred until scale demands them. |

## Design specs & plans

The two largest architectural changes were captured as full design specs + implementation plans rather than short ADRs. They're the primary reference for *why* the extraction pipeline is shaped the way it is:

| Decision | Spec | Plan |
|---|---|---|
| **Parse/vision hybrid routing** — probe the annotation layer; parse digital PDFs losslessly, reserve tiled vision for raster/scanned | [`specs/2026-06-02-parse-vision-hybrid-extraction-design.md`](../superpowers/specs/2026-06-02-parse-vision-hybrid-extraction-design.md) | [`plans/2026-06-02-parse-vision-hybrid-phase1.md`](../superpowers/plans/2026-06-02-parse-vision-hybrid-phase1.md) |
| **Tiling + precision post-processing** — split large sheets into ≤1568px tiles to beat the model resize ceiling; deterministic post-pass to claw back the precision cost | [`specs/2026-05-29-tiling-precision-postprocessing-design.md`](../superpowers/specs/2026-05-29-tiling-precision-postprocessing-design.md) | [`plans/2026-05-29-tiling-precision-postprocessing.md`](../superpowers/plans/2026-05-29-tiling-precision-postprocessing.md) |

Prompt-level decisions (two-pass extraction, the v0.10 anti-confabulation guard, the temperature-pinning rebaseline) live in [`prompts/CHANGELOG.md`](../../prompts/CHANGELOG.md). The full build narrative with numbers and dead ends is in [`notes/session-log.md`](../../notes/session-log.md).
