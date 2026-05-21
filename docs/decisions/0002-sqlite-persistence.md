# 2. SQLite via better-sqlite3 for persistence

Date: 2026-05-21

Status: Accepted

## Context

The original prototype persisted projects and checklist state in a single JSON file on disk. Every checklist update — a drafter marking one item done, adding a note, flagging an item for clarification — required reading the entire file, mutating the object in memory, and writing it back. Two requests racing each other lost writes. The file also grew with every project; the entire history of every checklist was in one blob that had to be parsed on every API call.

As soon as the app went past one project, this was untenable. The choice was between:

- Stay flat-file with a per-project file and some locking, or
- Move to a real database.

## Decision

SQLite, accessed via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3). A single `redlineiq.db` file under `data/` (or a mounted disk path in production). Tables for projects, markups, checklist items, and jobs. The connection is a synchronous singleton in `src/services/db.js`, initialized at startup.

better-sqlite3 specifically (not `node-sqlite3`, not `Drizzle`, not `Prisma`) because:

- Synchronous API. The extraction pipeline and checklist routes don't need to be `async`/`await`-coloured purely for IO that completes in microseconds.
- No connection pooling needed — it's an embedded engine, not a network database.
- Schema migrations are plain SQL in `src/services/db.js`. Twenty lines, zero abstraction.

## Consequences

**Good.**
- Row-level updates. A drafter clicking "done" on one checklist item writes one row instead of rewriting the entire dataset.
- Concurrent reads work fine. SQLite serializes writes via a write lock, which is invisible at the request volumes a portfolio app sees (single-digit RPS at worst).
- One file. Local backup is `cp redlineiq.db backup.db`. Render disk snapshots cover production.
- No external service. The deploy is still `Dockerfile + Node + GraphicsMagick + Ghostscript` — no Postgres container, no managed DB, no networked dependency.
- better-sqlite3 is fast enough to be invisible. Sub-millisecond queries at this scale.

**Bad.**
- Single writer. If RedlineIQ grew to multiple Node processes (horizontal scaling on Render), they would contend on the same DB file. SQLite via NFS or shared volumes is a known footgun. Migration to Postgres would be required at that point.
- Render free tier wipes the container's filesystem on every redeploy. The DB needs a mounted persistent disk (`DATABASE_PATH=/var/data/redlineiq.db`). Forgetting this is a class of bug that surfaces only after a deploy. README calls it out but it's still latent footgun energy.
- better-sqlite3 is a native binding. The deployed container must compile it for the target platform. This is why the Dockerfile pins `node:18-bookworm` rather than alpine — easier to install build deps. ADR-0004 (Dockerfile-on-Render, future) covers the rest.
- No migrations framework. Schema changes are hand-edited SQL in `src/services/db.js`. Fine at this size; would be technical debt at 5+ tables with referential integrity.

## Alternatives considered

- **JSON file with locking.** Tried initially. Lost writes under any concurrency. Even single-user, the API surface (`PATCH /items/:id`) requires read-mutate-write semantics that flat files don't safely provide. Dead end.
- **Postgres.** The "correct" answer for any non-toy app. Rejected for v1 because: requires a separate service, adds a deploy/config layer, complicates local dev (`docker-compose` instead of `npm run dev`), and the read/write pattern is well within SQLite's envelope. Will revisit if multi-tenancy or horizontal scaling lands on the roadmap.
- **`node-sqlite3` (async binding).** Same engine as better-sqlite3, asynchronous API. Forces every call site to be `async`, which is purely ceremonial when the underlying operation is in-process microsecond IO. Made the codebase noisier without benefit.
- **An ORM (Prisma, Drizzle, Knex).** Schema-first migrations are nice. The eight-table-or-fewer scope of this app doesn't justify the dependency or the query-builder API. Plain prepared statements in db.js read like the SQL they are.
- **LiteFS or Turso.** Distributed SQLite. Cutting-edge but vendor-coupled, and the horizontal-scale problem they solve isn't a problem we have. Wrong tool for a portfolio piece that needs to be auditable and obvious.
