# Architecture Decision Records

Decisions are recorded chronologically. Each entry follows [Michael Nygard's ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions): Context, Decision, Consequences, Alternatives.

| # | Title | Status | Summary |
|---|---|---|---|
| [0001](0001-async-sse-extraction.md) | Async SSE for extraction | Accepted | Background job + SSE progress stream so multi-page extractions survive load-balancer timeouts. |
| [0002](0002-sqlite-persistence.md) | SQLite via better-sqlite3 | Accepted | Embedded SQL database with row-level updates; replaces flat-file JSON that lost concurrent writes. |
| [0003](0003-pin-model-versions.md) | Make eval deterministic — pin temperatures and follow per-generation model-pinning convention | Accepted | Pin `temperature: 0` on both extraction and judge API calls; drop the now-redundant 3x judge vote; for 4.6+ generation use dateless form (it IS the pin per Anthropic docs), for 4.5 and earlier use dated form. |
