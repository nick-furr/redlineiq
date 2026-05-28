# Architecture Decision Records

Decisions are recorded chronologically. Each entry follows [Michael Nygard's ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions): Context, Decision, Consequences, Alternatives.

| # | Title | Status | Summary |
|---|---|---|---|
| [0001](0001-async-sse-extraction.md) | Async SSE for extraction | Accepted | Background job + SSE progress stream so multi-page extractions survive load-balancer timeouts. |
| [0002](0002-sqlite-persistence.md) | SQLite via better-sqlite3 | Accepted | Embedded SQL database with row-level updates; replaces flat-file JSON that lost concurrent writes. |
| [0003](0003-pin-model-versions.md) | Pin Claude model versions | Proposed | Always use dated snapshots (`claude-sonnet-4-20250514`), never aliases (`claude-sonnet-4-6`). Aliases drift silently and contaminate eval comparisons across days. |
