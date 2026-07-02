---
name: prompt-iteration
description: Use when changing the extraction prompt — walks the full versioning + eval loop (hypothesis, snapshot, changelog, working-set eval, threshold comparison) so no prompt change ships unmeasured or breaks the version history.
---

# Prompt Iteration Workflow

Every extraction-prompt change in this repo follows the same measured loop. The runtime prompt is `prompts/active.md`; versioned snapshots (`prompts/vN.md`) are immutable history. Skipping steps is how unattributable deltas and contaminated baselines happen.

## Checklist — do these in order

1. **Write the hypothesis first.** Which case(s) or sub-metric should move, in which direction, by roughly how much? If you can't name a validation target, you're not ready to edit the prompt. (Reference format: the v0.9 and v0.10 entries in `prompts/CHANGELOG.md`.)
2. **Snapshot, never edit.** Copy the current prompt to the next `prompts/vN.md`. Never modify an existing versioned file — they are the audit trail behind every number in the changelog.
3. **Apply the change to the new `vN.md`, then copy it to `active.md`.** Keep the `{{MARKUP_TYPES}}` placeholder intact — `extraction-service.js` substitutes it from `src/models/markup.js` at load time.
4. **Add the `prompts/CHANGELOG.md` entry** with: change, why, hypothesis, validation target. Do this *before* running the eval so the target is committed, not retrofitted.
5. **Run the eval on the working set only:**
   ```bash
   node evals/run-eval.js --prompt vN --working-set
   ```
   Never run against `evals/holdout/` during iteration — the holdout exists to stay untouched until a candidate is final. Note: eval runs cost API money (`ANTHROPIC_API_KEY` required).
6. **Compare against the pinned v0.9 baseline** (recall 0.665 · precision 0.687 · specificity 1.509) using the real thresholds: aggregate moves >0.02 are signal, per-case moves >0.1 on borderline cases are signal, anything less is noise (σ ≈ 0.003 aggregate). Check per-case before aggregate — offsetting moves hide in the average. The `eval-analyst` agent does this comparison well.
7. **Record the result in the changelog entry — including failure.** Failed experiments stay in the changelog with an honest post-mortem (see v0.10, which failed its objective and says so). A failed hypothesis with a clear conclusion is a valid, valuable outcome.
8. **If the change is a keeper**, note whether the pinned baseline should move — that's a deliberate decision recorded in the changelog, not an automatic consequence of a good run.

## Constraints that always apply

- `temperature: 0` pinned everywhere (ADR 0003) — never reintroduce the default.
- Pre-rebaseline numbers (anything before 2026-05-28, e.g. the 0.811 recall) are not comparable to current runs.
- Check the errata block at the top of `prompts/CHANGELOG.md` before comparing across dates — eval cases themselves have changed (case_011 re-authoring).
