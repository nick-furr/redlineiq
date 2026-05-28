# ADR 0003: Make the eval pipeline deterministic — pin temperatures and follow Anthropic's per-generation model-pinning convention

## Status

Accepted (2026-05-28).

## Context

The eval harness depends on a stable model reference: same code + same prompt + same inputs must produce the same scores across days, otherwise we can't tell whether a code change moved a metric or whether something else drifted underneath. Two separate sources of non-determinism were silently contaminating eval results until the 2026-05-28 investigation surfaced them:

**1. Temperature defaulted to 1.0 in both API call sites.**

`src/services/extraction-service.js` calls `client.messages.create()` without setting `temperature`. Anthropic's API defaults to `1.0` when omitted, meaning every extraction since v0.6 was fully stochastic. Per-case recall could swing 0.1–0.4 between runs of identical code.

`evals/lib/llm-judge.js` had the same omission. Its 3x majority-vote pattern was an explicit mitigation for the high-variance judge calls — a band-aid for the temp=1.0 default rather than an architectural choice.

**2. Initial hypothesis: alias drift on `claude-sonnet-4-6`.**

The original draft of this ADR proposed pinning `CLAUDE_MODEL` to a dated snapshot (`claude-sonnet-4-6-YYYYMMDD`) under the assumption that the bare `claude-sonnet-4-6` was a mutable alias. Verifying against Anthropic's docs (`platform.claude.com/docs/en/about-claude/models/model-ids-and-versions`) revealed that **starting with the Claude 4.6 generation, the dateless form IS the pinned snapshot** — there's no separate dated equivalent because the naming convention changed. For older generations (4.5 and earlier), bare forms are aliases that resolve to dated snapshots; dated forms must be used explicitly.

This shifted the diagnosis: the 5/24 → 5/28 score drift (aggregate recall 0.811 → 0.654 across three runs at identical file states) was likely a combination of:
- Judge variance at temp=1.0 (each per-pair judgment had non-trivial noise even with 3x voting)
- Extraction variance at temp=1.0 affecting both recall and precision distributions
- Possibly minor residual Anthropic-side non-determinism even at temp=0 (KV cache, prompt cache state)

Alias drift was not actually the dominant cause — the temperature defaults were. The investigation arrived at a stricter and more accurate decision than the original "use dated snapshots" framing suggested.

## Decision

Make the eval pipeline deterministic by:

**1. Pin `temperature: 0` everywhere the API is called.** Both extraction (`src/services/extraction-service.js`) and judge (`evals/lib/llm-judge.js`). This is the foundational pin — without it, no other determinism work matters.

**2. Drop the judge's 3x majority-vote pattern.** At `temperature: 0` the three calls return identical content; majority-vote becomes pure waste (3× cost, 3× latency, zero variance reduction). One call per judgment.

**3. Follow Anthropic's per-generation model-pinning convention:**

| Generation | Pinning form |
|---|---|
| 4.6 and later | Dateless form IS the pin (`claude-sonnet-4-6`, `claude-opus-4-7`, `claude-haiku-4-5`) — use as-is |
| 4.5 and earlier | Dated form required (`claude-sonnet-4-5-20250929`, `claude-sonnet-4-20250514`) — never use bare aliases |

Confirmed via `platform.claude.com/docs/en/about-claude/models/model-ids-and-versions`. Per-call code must use a model identifier from the correct column for that generation. Periodically re-check Anthropic's docs in case the convention evolves further.

**4. Always set `temperature` explicitly in every new API call site,** even when adding code paths that aren't eval-evaluated today. The default is 1.0 and forgetting to set it is the easy way to reintroduce the same problem.

## Consequences

**Positive:**

- Aggregate eval scores are effectively deterministic across runs (verified 2026-05-28: two back-to-back runs at the pinned config produced aggregate recall 0.662 vs 0.665, σ ≈ 0.003). Down from σ > 0.1 under the prior non-deterministic stack.
- The judge runs 1/3 as many API calls per scored case — meaningful cost and latency win on top of the determinism gain.
- New collaborators (or future-self) inheriting the project see explicit temperatures in code; the "Anthropic default is 1.0" trap is shut.
- ADR 0003 paired with the per-generation convention table gives a clear rule for every future model bump: check what generation, use the right form, set temperature explicitly.

**Negative:**

- We lose the slight upside of judge-vote ensembling on genuinely ambiguous calls. At temp=0 the model picks one interpretation deterministically; ambiguous concepts may always score "no" (or always "yes") rather than getting a 2/3 vote that might flip with the data. Mitigation: if the eval surfaces a particular concept that's systematically misjudged, refine the judge prompt or the expected-concept label rather than re-adding ensembling.
- We don't automatically benefit from Anthropic improving the underlying snapshot if they update it; for the 4.6+ generation Anthropic's docs claim this won't happen by their convention, but we should verify by spot-checking determinism over time.
- **Per-case determinism is "soft" (σ ≈ 0.05 on borderline cases), not byte-perfect.** Anthropic doesn't formally guarantee bit-determinism at temp=0; some residual variance comes from KV cache state, prompt cache turnover, and infrastructure-level batch effects. For comparing close prompt iterations the right tool is run 3–5 times and report median, not chase byte-determinism by disabling caching (which has its own latency and cost costs).

**Migration steps:**

- `src/services/extraction-service.js` — `temperature: 0` added (commit `02b756c`, 2026-05-28)
- `evals/lib/llm-judge.js` — `temperature: 0` added and `judgeMarkup` simplified to single call (this commit set)
- `prompts/CHANGELOG.md` — new baseline scored at the fully deterministic config replaces the contaminated 5/24 0.811 reference
- `CLAUDE_MODEL` env var stays as `claude-sonnet-4-6` (already a pin per Anthropic's 4.6+ convention)

## Alternatives considered

1. **Keep the 3x majority vote and just pin temp=0.** No benefit — three identical calls is wasted spend.

2. **Switch the judge model to a temperature setting other than 0** (say 0.2) to preserve some ensembling value. Adds complexity for marginal benefit; the determinism guarantee is more valuable than ensembling robustness on a 9-case eval set.

3. **Downgrade `CLAUDE_MODEL` to an explicitly dated 4.5 or 4 snapshot** (`claude-sonnet-4-5-20250929`, `claude-sonnet-4-20250514`) for maximum certainty. Loses the v0.8 model-tier gain (+0.103 recall). Rejected — Anthropic's per-generation convention is sufficient for 4.6+; downgrading sacrifices a measured win for speculative certainty.

4. **Stop using LLM-as-judge entirely; switch to exact/fuzzy string matching.** Eliminates judge variance completely but loses the conceptual-equivalence flexibility that makes the harness useful for engineering shorthand and OCR noise. Not the right trade for this domain.

## References

- Original alias-drift hypothesis (now invalidated): notes/extraction-quality-levers.md "model alias drift discovery" section
- Anthropic per-generation pinning convention: https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions
- Anthropic model migration guide: https://platform.claude.com/docs/en/about-claude/models/migration-guide
- Commits: `02b756c` (extraction temp=0), this commit set (judge temp=0 + 1x vote, ADR revision, baseline reset)
- Memory: `~/.claude/.../memory/project_dpi_upstream_hypothesis.md` (full investigation arc)
