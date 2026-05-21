# 1. Async SSE for extraction

Date: 2026-05-21

Status: Accepted

## Context

A redline extraction request hits Claude Vision once per page. On a 5-page PDF that's 30–60 seconds of model latency per page, plus image conversion and validation overhead. A synchronous `POST /extract` would block the HTTP connection for several minutes — past every default load-balancer timeout (Render, Cloudflare, nginx, Vercel all sit between 30s and 100s). The request would die before extraction finished, leaving the user with nothing.

The UI also needs per-page feedback. A blank spinner for two minutes is indistinguishable from a hang. Users will refresh, double-submit, or close the tab.

## Decision

Extraction runs as a background job. The flow:

1. `POST /api/projects/:id/extract` creates a job row and returns `{ jobId }` immediately.
2. `GET /api/jobs/:jobId/status` is a Server-Sent Events stream that emits per-page progress events as the job runs, then a terminal `complete` or `failed` event.
3. The job service (`src/services/job-service.js`) drives extraction in the background and writes progress to both an in-memory map (for SSE delivery) and the SQLite jobs table (for crash recovery and post-hoc inspection).

The client opens the SSE stream after the initial POST and renders the per-page events as they arrive.

## Consequences

**Good.**
- Extraction is no longer bounded by load-balancer timeouts. A 10-page PDF (~5–10 minutes) completes successfully.
- The UI shows real progress: which page is being processed, what was found, when each page finishes.
- Failure on one page doesn't kill the whole job — the job service records per-page errors and continues.
- Jobs survive a server restart with degraded UX (the SSE stream drops but the job row still exists, so the client can reconnect and resume).

**Bad.**
- More moving parts than a synchronous endpoint. Three things have to stay in sync: the jobs DB row, the in-memory progress map, and the SSE client. Bugs in any one of them manifest as "the UI is wrong" without an obvious cause.
- SSE reconnection logic is on the client. If a network hiccup drops the stream mid-extraction, the client needs to re-open the stream and not double-render events. Currently handled but fragile.
- Backpressure is implicit. If two users start large jobs concurrently, both queue on the same Claude API rate limit — neither is throttled by us, just by the upstream.
- Progress events are best-effort: an event lost during SSE reconnection is lost forever. The UI fills in the gap by reading the DB on stream reconnect, but the user briefly sees a stale state.

## Alternatives considered

- **Synchronous `POST /extract`.** Simpler but fails at load-balancer timeout. Would require chunking the work or capping at 1–2 pages, which defeats the product.
- **Long polling.** Client repeats `GET /jobs/:id` every few seconds. Equivalent complexity to SSE, more requests, noisier logs, marginally less efficient. SSE is also closer to the platform's strengths (stream of events from a server you control).
- **WebSockets.** Real-time bidirectional channel. We don't need bidirectional — the client never pushes anything mid-extraction. The setup overhead and operational complexity (auth, reconnection, scaling across instances) isn't justified.
- **Polling via background worker + email/webhook on done.** Decouples completely. Right answer at higher scale or for B2B integrations. Wrong shape for a portfolio-tier interactive demo where the user is watching.
