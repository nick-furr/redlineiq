# ADR 0003: Pin Claude model versions to dated snapshots, never use aliases

## Status

Proposed (becomes Accepted when implemented per the Notion ticket "Pin claude-sonnet-4-6 to a dated snapshot; re-baseline eval at temp=0").

## Context

On 2026-05-23, v0.8 changed `CLAUDE_MODEL` from `claude-sonnet-4-20250514` (a dated snapshot) to `claude-sonnet-4-6` (an alias). This unlocked +0.103 aggregate recall on the eval set — the right move on its face. The decision wasn't framed as "alias vs dated"; we just used whatever string the docs surfaced for the newer model.

On 2026-05-28, while debugging a separate `pdf-converter` rendering issue, we observed that identical code + identical prompt + identical eval inputs scored:

- aggregate recall **0.811** on the 2026-05-24 v0.9 baseline run
- aggregate recall **0.649** on the 2026-05-28 post-DPI-bump run
- aggregate recall **0.654** on the 2026-05-28 post-revert run (same file state as 5/24)
- aggregate recall **0.654** on the 2026-05-28 post-revert + `temperature=0` run

Three separate runs at the same file state converged on the same ~0.65 number, with a clean delta from the 5/24 baseline that no code change explains. After eliminating sampling variance by pinning `temperature=0` (the API was defaulting to 1.0 since we never set it), the gap persisted.

The remaining explanation is that Anthropic updated what the `claude-sonnet-4-6` alias points to between those dates. Anthropic does this without per-customer notification when they ship an improved snapshot. From our side, the model behaves differently one day with no visible cause.

**Direct cost of the discovery:** a multi-hour session burned partly chasing what looked like a code-introduced regression but was actually upstream alias drift.

**Indirect cost going forward (if uncorrected):** every eval comparison across days is contaminated with model-version noise. The eval harness's value depends on a stable reference; aliases break that invariant silently and undetectably from inside the code.

## Decision

**Always use dated Claude model snapshots in production and eval code paths. Never use bare model aliases.**

Dated form: `claude-sonnet-4-20250514`, `claude-sonnet-4-5-20250929`, hypothetically `claude-sonnet-4-6-YYYYMMDD` once we look up the current snapshot ID.

Concrete enforcement points:

- `src/config/index.js` `CLAUDE_MODEL` default must be a dated snapshot
- `.env.example` `CLAUDE_MODEL` must show a dated snapshot
- Deployment env var (Render) must be set to a dated snapshot
- When adopting a new Anthropic snapshot, the upgrade is an explicit change to that string, recorded in `prompts/CHANGELOG.md`, scored against the prior baseline at `temperature=0`, and shipped only if the eval supports it

## Consequences

**Positive:**

- Eval baseline is stable across days. Future regressions point to OUR code changes, not Anthropic-side drift.
- Model upgrades become deliberate, evidence-supported decisions tracked in the CHANGELOG, not silent improvements (or silent regressions).
- A new collaborator or future-self inheriting the project doesn't get silently sandbagged by an alias bump that happened on a Wednesday.
- `temperature=0` (pinned 2026-05-28 in commit 02b756c) plus dated model snapshots produces a fully deterministic extraction pipeline, which is what the eval harness needs to be useful.

**Negative:**

- We don't automatically benefit from Anthropic's improvements to the alias's underlying snapshot. Adoption becomes a manual decision instead of free silent uplift. Acceptable trade for the eval stability.
- Dated snapshots eventually get deprecated by Anthropic (they typically announce with notice). We'll need to refresh the pin periodically — a recurring small task rather than a one-time investment.

**Migration:** see Notion ticket "Pin claude-sonnet-4-6 to a dated snapshot; re-baseline eval at temp=0" (P2, Next). The 2026-05-24 v0.9 baseline of 0.811 is invalidated as a reference until that ticket lands and a new dated-snapshot baseline replaces it.

## Alternatives considered

1. **Keep aliases, accept drift, re-baseline weekly.** Cheap to start, expensive in eval-noise tax forever. Rejected — invalidates the value of the eval harness, and pushes the cost of every Anthropic-side change onto our debug time.

2. **Use aliases in production code, dated snapshots only in the eval code path.** Splits behavior between two code paths, makes "production parity" debugging harder, and the production behavior still drifts silently. Rejected.

3. **Use the latest dated snapshot that the alias currently points to, refreshed via a periodic automated check.** Same end state as option 1 unless we automate the lookup and changelog entry. Adds tooling for no marginal benefit over manual pinning + CHANGELOG hygiene.

4. **Do nothing; accept that "model behavior on a given day" is part of the eval signal.** Rejected — this was the de facto state and it cost us a session to discover. The eval harness exists to measure code changes, not to measure Anthropic's release cadence.

## References

- Notion ticket: "Pin claude-sonnet-4-6 to a dated snapshot; re-baseline eval at temp=0"
- Investigation notes: `notes/extraction-quality-levers.md` (alias drift section)
- Memory: `~/.claude/.../memory/project_dpi_upstream_hypothesis.md`
- Related commit: `02b756c` (pinned `temperature=0` — necessary but not sufficient for stable eval)
- Anthropic model versioning: https://platform.claude.com/docs/en/about-claude/models
