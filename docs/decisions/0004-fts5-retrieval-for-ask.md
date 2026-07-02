# ADR 0004: FTS5 keyword retrieval, not embeddings, for markup Q&A

## Status

Accepted (2026-07-02).

## Context

`POST /api/projects/:id/ask` answers natural-language questions about a project's extracted markups, grounded in the markups themselves (RAG). The retrieval stage needs to select which markups feed the synthesis call. The default industry answer is vector embeddings + a similarity index, which for this stack would mean either an external vector store or an embedding vendor — Anthropic doesn't offer an embeddings endpoint (their docs point to Voyage AI), so embeddings are a new vendor, API key, and billing relationship regardless of where the vectors live.

The corpus shape argues against paying that cost:

- **Per-project corpora are tiny** — tens to low hundreds of short markups. Retrieval quality differences between BM25 and dense vectors show up on large, paraphrase-heavy corpora; at this scale nearly any ranker surfaces the right handful of items.
- **The vocabulary is exact-match heavy.** Drafters ask about sheet refs ("A-201"), grid lines, dimensions, and markup types — tokens where keyword match is *stronger* than embedding similarity, which tends to blur near-identical references.
- **The semantic lift already has a home.** Claude reads the retrieved markups at synthesis time; recall at TOP_K=12 over a ~100-item corpus is forgiving, and conceptual matching happens in the model, not the index.

## Decision

Use **SQLite FTS5** (BM25 ranking) as the retrieval stage:

- A `markup_fts` virtual table indexes `markup_text`, `location_on_drawing`, `markup_type`, and `drawing_reference`, extracted from the markup JSON.
- **Triggers on `checklist_items`** keep the index in sync (insert/delete; the markup JSON is immutable after insert, so no update trigger). Project deletes cascade through the FK, and the cascade fires the delete trigger. A startup backfill covers databases created before the index existed.
- **User input never reaches `MATCH` raw** — questions are reduced to quoted word tokens OR-ed together, so FTS5 query syntax can't be injected.
- The JSON-backed sample project (not in SQLite) uses an in-memory token-overlap ranker feeding the same synthesis path.

Synthesis is one text-only call at `temperature: 0` (ADR 0003) on the configured model, instructed to answer only from the retrieved markups and cite their IDs. Zero retrieval hits short-circuits to an honest "no matching markups" response with no API call.

## Consequences

**Positive:**

- Zero new dependencies, vendors, or keys — better-sqlite3 ships FTS5. Retrieval is deterministic, testable offline, and adds no per-question cost beyond the single synthesis call.
- The index maintains itself at the database layer; no service that writes checklist items needs to know it exists.
- The whole retrieval stage is covered by fast offline tests in CI.

**Negative:**

- Pure paraphrase questions with no token overlap ("what's wrong with the plumbing?" against markups that only say "relocate cleanout") can miss. Acceptable at current corpus sizes; the failure mode is a "no matching markups" response, not a wrong answer.
- BM25 relevance isn't tuned per-column (a hit in `markup_text` counts like a hit in `location`). Not worth weighting until a real query log says otherwise.

**Revisit if:** corpora grow past a few thousand markups per project, cross-project search arrives, or a query log shows paraphrase misses are common — that's the point to measure an embedding retriever against this baseline rather than assume it wins.

## Alternatives considered

1. **Voyage (or other) embeddings + vector index.** New vendor + key + index lifecycle for retrieval quality this corpus can't use. Rejected at this scale; the revisit triggers above name the conditions that would reopen it.
2. **No retrieval — stuff the full checklist into the prompt.** Simplest, and viable for small projects, but token cost scales linearly with project size and large projects would degrade answer focus. The FTS stage costs little and caps the context deterministically.
3. **LIKE queries over the markup JSON.** No ranking, no tokenization, table scans. FTS5 is the same zero-dependency footprint with real BM25 ranking.

## References

- Retrieval + synthesis: `src/services/ask-service.js`; schema + triggers: `src/services/db.js`; route: `src/routes/api.js`
- Offline coverage: `test/test-ask-retrieval.js`
- Determinism pins: ADR 0003
