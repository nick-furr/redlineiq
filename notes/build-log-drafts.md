# Build log drafts — raw material for LinkedIn build-in-public posts

Source material for upcoming Build Log posts (the LinkedIn series started 5/21 with post #1, next post queued for Friday 5/29). Captured while sessions are fresh in context so future-you (or the Build Log Drafter subagent) doesn't have to reconstruct everything from commits + memory.

Each entry below is a self-contained capture: what happened, the specific numbers, the dead ends, the concrete commits. Pick angles from these when drafting; don't try to fit everything into one post.

---

## 2026-05-27 → 2026-05-28 session — DPI investigation arc + tiling breakthrough

**One-line summary:** Spent a long stretch diagnosing why hand-drawn redlines were failing; the obvious hypothesis was wrong twice, and the actual lever turned out to be tiling — not DPI. Along the way, found and fixed a silent bug that had been contaminating every eval comparison for weeks.

### Recommended post angle: "Diagnose carefully, iterate honestly, ship deliberately"

Engineers respect three things: specific numbers, honest dead ends, and a clean payoff. This arc has all three. Suggested structure:

**Hook (1-2 sentences):**
> Spent a week stuck on hand-drawn redlines in RedlineIQ. Here's what worked, what didn't, and the silent bug hiding in plain sight.

**Body (the actual content):**
1. **The symptom:** dogfood session on a real handwritten architectural elevation showed extraction missing readable markups, hallucinating cloud locations, and dropping handwritten content. case_006 in the eval (a real hand-drawn bath01 elevation) had been stuck at recall ≤0.538 for two weeks across every prompt iteration.
2. **First wrong hypothesis: DPI is too low.** Diagnosed `pdf2pic` was forcing a fixed 2400×3200 output that distorted aspect ratios on real PDFs. Fixed it to compute target dims from native PDF inches × DPI. **Eval recall regressed from 0.811 → 0.649.** Reverted.
3. **The actual ceiling:** Anthropic's Sonnet 4.6 server-side resizes all input images to **1568 px on the long edge**. Sending bigger images is wasted bytes plus a degrading double-resize (sharp + Anthropic). Verified via Anthropic vision docs.
4. **Second wrong hypothesis: model alias drift.** When the regression persisted across runs, hypothesized that `claude-sonnet-4-6` was an alias that got bumped to a new snapshot by Anthropic between baseline (5/24) and now (5/28). Investigation showed: for Claude 4.6+ generation, the dateless form **IS** the pinned snapshot per Anthropic docs. No drift to blame.
5. **The silent bug:** turned out the API was defaulting to `temperature: 1.0` on every extraction call since the project started, because nobody set it explicitly. The eval judge had the same problem. So every score comparison across days was contaminated with sampling variance. The Week 2 σ ≈ 0.02 noise floor we'd been treating as a target was a lucky aggregate average over much higher per-case noise. Pinned `temperature: 0` on both calls. Dropped the judge's now-pointless 3x majority vote. New deterministic baseline at v0.9: recall 0.665 (vs the contaminated 0.811).
6. **The actual lever (the payoff):** built a tiling prototype — split large PDFs into ≤1568 px-long-edge tiles, run extraction per tile, dedup-merge. **case_006 lifted from 0.231 → 0.538.** Biggest single-case recall gain in the project. Caveat: indiscriminate tiling tanks precision on synthetic sheets (extracted counts triple, dedup doesn't catch all overlap dupes), so this isn't shipped to production yet. Conditional tiling (only tile detected hand-drawn sources) is the next iteration.

**Closer (1 sentence):**
> Two hypotheses dead, one silent bug fixed, one real breakthrough. The model can read handwriting just fine — it was being delivered a downsampled image.

**Length target:** 1500-2500 chars. Don't try to fit all six bullets into a single LinkedIn post — pick three and link to GitHub for the rest.

### Alternate angle: "Always set API parameters that have defaults"

Sharper if you want a single-finding post. Hook around the temperature=1.0 silent default and how it contaminates evals. Lessons applicable beyond RedlineIQ:

- API defaults are silent until they bite. `temperature` defaults to 1.0 in the Anthropic SDK. We never set it. Every extraction was fully stochastic.
- Judges had the same problem. We were using 3x majority voting to mitigate, but that was treating the symptom, not the cause.
- Old "variance baseline σ ≈ 0.02" was wrong — that was a lucky aggregate of much higher per-case noise.
- Pinned temp=0. Aggregate σ now ≈ 0.003 (effectively deterministic). Per-case soft σ ≈ 0.05 from Anthropic-side residual non-determinism we can't address from our side.
- Codified as ADR 0003: always set temperature explicitly; for 4.6+ models the dateless form is already pinned; for 4.5 and earlier use dated snapshots.

Suggested rule-of-thumb for the post: *"If you wouldn't accept a unit test that returned different results on different runs, you shouldn't accept an eval harness that does either."*

### Alternate angle: "Tiling for vision-language model resolution"

Lead with the case_006 breakthrough. Single specific number (recall 0.231 → 0.538), single specific technical insight (Sonnet 4.6 1568px cap), single specific fix (tile + dedup). Sharp, focused, less arc to follow.

- Anthropic vision constants are worth knowing: Sonnet 4.6 caps at 1568 px long edge; Opus 4.7 at 2576 px. Images larger than the cap get resized server-side.
- For a 36×24 in arch sheet, that's ~43 effective DPI delivered to the model — unreadable handwriting.
- Tiling math: 3×5 grid of overlapping tiles, each ≤1568 px long edge → ~65 effective DPI per tile region. ~25-tile densities for bigger lifts.
- case_006 was stuck at recall ≤0.538 for two weeks across prompt and model iterations. Tiling cracked it without changing either.

### Specific numbers (use throughout posts)

| Number | What it is | Where it came from |
|---|---|---|
| recall **0.231 → 0.538** | case_006 lift, tiling experiment | `evals/runs/2026-05-28_v0.9_tile.json`, commit `de38aa6` |
| recall **0.811 → 0.665** | The "regression" that was actually variance + judge ensembling | Pinned baseline, commit `c3b0b3a` |
| **1568 px** | Sonnet 4.6 server-side image long-edge cap | Anthropic vision docs (platform.claude.com) |
| **2576 px** | Opus 4.7 equivalent cap | Same |
| **σ ≈ 0.003** | Aggregate determinism at pinned config (was much higher before) | Two back-to-back runs at temp=0 |
| **15 commits, 1 night** | Tonight's session output | git log 5/27-5/28 |

### Specific commits to link

- `8412c3a` — revert(pdf-converter): restore prior config after DPI attempt regressed
- `6b23747` — fix(client/PdfViewer): bump backing-store DPI for legible scan rendering
- `02b756c` — fix(extraction): pin temperature=0 for deterministic eval
- `a69469b` — fix(judge): pin temperature=0; drop redundant 3x majority vote
- `9a4c170` — docs: pivot ADR 0003 + rebaseline v0.9 CHANGELOG
- `24e8783` — feat(eval): tiling prototype
- `de38aa6` — eval(v0.9-tile): case_006 cracked

GitHub links (replace with full URLs when drafting):
- ADR 0003: `docs/decisions/0003-pin-model-versions.md`
- Investigation notes: `notes/extraction-quality-levers.md`
- CHANGELOG with full numbers: `prompts/CHANGELOG.md`

### Voice/tone reminders (from positioning.md)

- Engineer-to-engineer. No AI hype words.
- Specific verbs, specific numbers, specific examples.
- Show, don't claim. "Tiled extraction lifted case_006 from 0.231 → 0.538" beats "AI-powered tiling unlocks breakthrough performance."
- Acknowledge dead ends openly — DPI investigation, alias-drift hypothesis. Engineers trust people who say "I was wrong, here's what I learned."
- No need to soften the regressions. "Eval recall regressed from 0.811 → 0.649" is more credible than "the change underperformed expectations."

### What NOT to lead with

- Don't lead with "Built an AI tool for engineers." Lead with the specific bug / specific insight.
- Don't lead with "I learned a lot this week." Show what you learned via what you did.
- Don't promise productionization that hasn't happened. Tiling is validated as an experiment, not shipped. Be honest about that — it's stronger than overpromising.

---

## Template for future session captures

When tomorrow's session (or any session) lands with similar build-log-worthy content, append a new dated section to this file with:

1. **One-line summary** — the elevator pitch
2. **Recommended post angles** — 1-3 candidate framings, each with a hook + body bullets
3. **Specific numbers** — table of concrete metrics with sources (commits, files, runs)
4. **Specific commits** — short list with one-line descriptions
5. **Voice/tone notes** — reminders specific to this session's content
6. **What NOT to do** — anti-patterns specific to this material

The Build Log Drafter subagent (per Notion `36d1ec96-c149-81d6-adba-d1a240c2b1b2` "Dogfood session #1" cross-ref) is the consumer of this file. Keep entries self-contained so the drafter can pick one and write without needing the full session context.
