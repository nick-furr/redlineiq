# RedlineIQ — positioning

Working draft. Captures the strategic framing for the product separately from build details. Source-of-truth for README copy, landing-page headlines, sales conversations, and interview talking points. Updated as positioning sharpens or evidence comes in (interviews, real-customer reactions, competitive moves).

Sections marked **(needs user input)** are placeholders for thinking the doc should hold once it's done — don't ship anything off this file that's still in TODO form.

---

## The core wedge

**Lead framing:** Bluebeam's own Markups List + filtering UX is an admission that organizing redline markups is hard. A specialized tool that organizes markups *automatically* — turning them into a structured checklist before the drafter even opens the file — is the obvious product.

This framing is sharper than "handwriting OCR for redlines" because:
- It speaks to a pain Bluebeam users already feel and have already paid for (filtering, search, hyperlinks)
- It positions RedlineIQ as completing a job the incumbent half-finished, not competing on a feature
- It side-steps the "this is just OCR" reductive framing that makes the product sound commoditized
- It surfaces a buyer (the firm already paying for Bluebeam licenses) rather than a tech demo

**Secondary frames (use when context fits, don't lead with):**
- Handwriting/scan OCR for messy redlines — useful when the prospect's actual pain is illegible markups
- Markup-to-checklist task generation — useful for project-management-flavored conversations
- Markup deduplication across multi-reviewer reviews — useful when the prospect mentions "I get the same comment from three reviewers"

## Who this is for

**Target funnel (from broad to narrow):**

1. All construction / AEC firms working from drawings (universe — huge, not addressable directly)
2. Firms doing **markup-heavy review cycles** (architecture, civil consulting, structural, MEP — i.e., design-side or design-review-side, not pure field)
3. Firms whose review workflow is already **Bluebeam-centric** (Markups List, Studio Sessions, etc.)
4. Within those: drafters and project engineers who **personally feel the cleanup pain** on every project they touch
5. The wedge buyer: **a CAD manager or a small-firm principal** who's bought a Bluebeam license and watched their team spend hours per project organizing redlines

**Anti-target (deliberately not for):**
- General contractors doing field-side markup (different workflow, mostly photos and RFIs, not drawing reviews)
- Massive enterprise AEC (procurement cycles too long, requirements too custom for v1)
- Solo practitioners who don't have enough volume to justify the workflow change
- Firms not on Bluebeam (Adobe-only shops — different integration story)

**(needs user input)** — Sharpen "personally feels the pain" into a profile: hours per week spent on markup cleanup, project type, seniority. Use post-Karanveer / post-Sandis-coffee-chat learnings to populate.

## Anchor metrics

**The goal is 10–50 paying customers,** not TAM trivia. This shapes every decision:

- Pricing: must work at small-team scale ($50–500/mo per firm range, not enterprise contracts)
- Sales motion: founder-led outbound + product-led-trial, not field sales
- Feature scope: deep on the markup-organization job, shallow on adjacent workflows (don't compete with project management or RFI tools)
- Distribution: AEC-specific channels (LinkedIn AEC tags, AEC Slack/Discord, civil-engineering subreddits), not general SaaS launch playbook

**(needs user input)** — Pull from Perplexity research:
- Pricing benchmarks for AEC-adjacent SaaS (RFI tools, drawing management, etc.)
- Customer acquisition cost expectations for AEC SaaS
- Typical Bluebeam-add-on or plug-in pricing for reference

## Competitive landscape

**Bluebeam itself** is the incumbent. Markups List + filtering + Studio Sessions all exist. The positioning isn't "replace Bluebeam" — it's "the post-review cleanup tool that Bluebeam doesn't ship." Risk: Bluebeam ships their own AI markup-organization feature. Mitigation: ship faster, integrate deeper, build on customer feedback Bluebeam doesn't have access to.

**Generic ChatGPT / Claude upload-the-PDF substitution.** A drafter could literally drag the PDF into ChatGPT and ask "give me a checklist of these markups." Why pay for RedlineIQ? Reasons (need to be validated, see JTBD):
- Verification against the source — RedlineIQ shows the PDF with overlay, you can click each item and see where it came from. ChatGPT can't do that.
- Persistence — RedlineIQ remembers the checklist across sessions and team members. ChatGPT is per-session, no team workflow.
- Domain-tuned prompting — RedlineIQ's extraction is calibrated for AEC redline conventions (cloud annotations, "verify?" marks, callout bubbles). General models often miss or misclassify these.
- Liability / audit trail — important in regulated work; ChatGPT doesn't give you anything traceable. RedlineIQ can.

**(needs user input)** — Specific AEC tools to map:
- Sphera (drawing management)
- Procore (project management with drawing tools)
- ConstructConnect / Document Crunch (more analysis-focused)
- Newer AI-AEC startups (ArchiLabs, Document Crunch, Civils.ai per outreach log)

For each, capture: what they do, where they overlap with RedlineIQ, where RedlineIQ wedges them.

## JTBD discovery questions (use in customer interviews)

These are the questions that should be asked when talking to prospective customers. The answers shape positioning sharpness over time. Use during Week 6 interview pipeline (Karanveer call etc.) and any cold customer chat.

**1. Liability (validates the "audit trail matters" hypothesis):**
> "If you missed a markup this tool didn't catch, who's on the hook?"

Listen for: do they spontaneously mention insurance, errors-and-omissions, or specific liability scenarios? Does the answer change how willing they are to trust an AI tool with this job?

**2. Substitution (validates against the ChatGPT-DIY threat):**
> "Have you ever uploaded a redline to ChatGPT? What happened?"

Listen for: have they tried it? What broke? Did they trust the output? Did they verify it manually? If they say "I haven't tried" — why not? (Fear of accuracy? IP concerns? Didn't think of it?)

**3. Integration (informs roadmap direction):**
> "Would you want this inside Bluebeam, or as its own thing?"

Listen for: do they want a plugin? A standalone web app? An export-to-Bluebeam workflow? Their answer maps to which integration to build first.

**4. Forced-rank (winner becomes the landing-page headline):**
> "Rank these by how much time they'd save you — (a) faster markup capture, (b) cleaning up messy markups, (c) consolidating comments from multiple reviewers, (d) turning markups into actionable tasks."

Listen for: do they actually pause to rank, or does one jump out immediately? The winner across multiple interviews becomes the headline. The loser tells you what to deprioritize.

**(needs user input)** — As interviews happen, log answers verbatim in `dogfood/` or a new `notes/jtbd-interviews/` subfolder. After 5+ interviews, write a summary back into this file about which framings are winning.

## What v1 IS / what v1 is NOT

Protects against scope creep when prospects ask for features. Hard scope discipline.

**v1 IS:**
- Upload a PDF with redline markups → get a structured checklist back
- Per-markup metadata: type, text, location, page, drawing reference
- A viewer that shows the PDF with markup overlays for verification
- Flag-for-review workflow on ambiguous extractions
- CSV export for handoff to whatever the team's project tracker is

**v1 is NOT:**
- A markup *creation* tool (Bluebeam handles that — RedlineIQ is post-creation)
- A multi-user collaboration platform (no real-time editing, no comments, no @-mentions)
- A project management system (the checklist exports cleanly to whatever they already use)
- A direct Bluebeam plugin (web-app only for v1; plugin path is a v2 question)
- A general document AI tool (focused on AEC redlines; refuse adjacent asks)

## Voice / tone

- **Engineer-to-engineer.** No AI hype words ("revolutionary," "AI-powered," "transform," "leverage"). Specific verbs, specific numbers, specific examples.
- **Show, don't claim.** "Reads handwritten markups and gives you a structured list" beats "AI-powered markup analysis."
- **Acknowledge limits.** RedlineIQ doesn't catch everything — saying so up front builds trust and matches what users will see anyway in the flagged items.
- **No AEC-jargon-stripping.** When talking to AEC people, use AEC vocabulary (clouds, RFIs, sheet numbers, scale, callouts). Don't dumb down.

## Things this doc deliberately does NOT cover

- **The build details** — that's `README.md` (user-facing) and `notes/extraction-quality-levers.md` (internal)
- **Pricing experiments** — when there's enough data to write up, add a `## Pricing` section (or a sibling file `notes/pricing.md`)
- **Hiring / staffing positioning** — separate file if/when needed; this doc is product, not personal brand
- **Specific feature roadmap** — Notion Tasks DB owns that

## Open positioning questions (worth thinking through)

These are the things this doc doesn't have answers for yet:

1. **The "is this a feature or a product" question.** If Bluebeam ships their own version in 6 months, what's the moat? (Hint: probably distribution, customer relationships, and domain calibration — not the tech itself.)
2. **The pricing curve.** Per-project? Per-seat? Per-firm? Tiered by markup volume? Each has implications for sales motion.
3. **The handwriting-vs-clean-PDF split.** If most production redlines are Bluebeam-clean (vector annotations), the OCR angle is a smaller market than the organization angle. If most are scanned/handwritten, OCR is the wedge. Reality is probably 50/50 by firm type. Need data.
4. **The "who's the actual buyer" question.** Drafter feels the pain; CAD manager probably approves the tool; firm principal pays. Different sales pitches for each layer.
5. **The agent-AEC adjacency.** Companies like Document Crunch, ArchiLabs, Civils.ai are building AI-AEC tools. Is RedlineIQ a feature inside one of those, an acquisition target, or a category they don't address?

## References

- Engineering Practice Plan (Notion): the Task Board "Brain Dump" + Ongoing items that seeded this doc
- Perplexity research (TODO: link or excerpt)
- Outreach log: `outreach_log_karanveer_firm.md` (in repo) for context on the first JTBD interview pipeline
- README.md — keep aligned with whatever positioning lands here
- Memory: any future `user`-type entries about product strategy preferences should cross-reference this doc
