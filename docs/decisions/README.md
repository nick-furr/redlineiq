# Architecture Decision Records

Decisions are recorded chronologically. Each entry follows [Michael Nygard's ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions): Context, Decision, Consequences, Alternatives.

| # | Title | Status | Summary |
|---|---|---|---|
| [0001](0001-async-sse-extraction.md) | Async SSE for extraction | Accepted | Background job + SSE progress stream so multi-page extractions survive load-balancer timeouts. |
| [0002](0002-sqlite-persistence.md) | SQLite via better-sqlite3 | Accepted | Embedded SQL database with row-level updates; replaces flat-file JSON that lost concurrent writes. |
