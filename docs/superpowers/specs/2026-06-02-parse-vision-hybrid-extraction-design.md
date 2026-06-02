# Parse/Vision Hybrid Extraction — Design

**Date:** 2026-06-02
**Status:** Approved design — Phase 1 ready for implementation planning
**Author:** Nick Furr (with Claude)

## Problem

RedlineIQ extracts redline markups from construction drawings using a tiled
vision pipeline (Claude Sonnet). Vision works on any image but is bounded by the
1568px server-side resize, and it cannot tell the drawing's own printed text
("substrate") apart from the redline annotations — the source of the precision
ceiling.

Many source PDFs carry the markup as **structured data**, not pixels:

- **Un-flattened** (e.g. PDF-XChange / Bluebeam before issue): markup lives as
  live annotation objects — text, type, exact coordinates, color — in the file.
- **Flattened** (the AEC field norm — markups baked in so they can't be moved):
  the annotation layer is gone, **but** (verified below) the redline *text*
  survives in the content stream as colored text, separable by color.

Parsing this structured data sidesteps resolution entirely and is near-lossless
and cheap, where it applies. This design routes inputs by source type instead of
treating everything as an image.

## Evidence (diagnostic spike)

A throwaway diagnostic (`inspect-pdf.js`, repo root) was run on real sheets via
`pdfjs-dist` (`getAnnotations`, `getTextContent`, operator-list fill colors).
Key findings:

| Sheet | regime | annotations | redline text after flatten |
|---|---|---|---|
| San Marcos S201 (`case_012`) | un-flattened → flattened | 24 → 0 | 12 red notes survive as pure `rgb(255,0,0)`, identical count |
| Walpole C-401 (`case_011`, colorful civil) | un-flattened → flattened | 20 → 0 | 21 red ops survive, identical; **red is the only red on the sheet** |

Conclusions (n=2, including a colorful civil stress case):

1. Flattening (PD​F-XChange) **destroys the annotation layer** but **preserves
   redline text** as content-stream text — it does **not** rasterize.
2. Redline `rgb(255,0,0)` is a **clean separator** — no substrate text competes
   for pure red, even on a drawing full of green/orange/gray substrate text.
3. Therefore parsing can serve **both** the un-flattened minority (annotation
   layer) **and** the flattened field-majority (color-filtered content text).

## Architecture

A router in `runJob()` (`src/services/job-service.js`) classifies each upload by
source type and dispatches to one of three regimes. **The existing tiled-vision
path is not modified — it becomes one branch of the router.**

```
runJob() → probeAnnotations(pdfPath)
   ├─ annotations > 0          → parse annotation layer (text + rect + color)   ┐
   ├─ else redline-colored     → parse content stream, filter to redline color  ├→ text-only
   │       text present            (text + position)                            │  LLM label
   └─ else (no anno, no color) → tiled vision  (EXISTING, untouched)            ┘  pass
                                                       → ExtractionResult → addExtractionResults()
```

- **Probe** (`src/utils/pdf-annotation-probe.js`, NEW): opens the PDF once with
  `pdfjs-dist`, counts annotations whose subtype is a markup subtype
  (`FreeText, Square, Circle, Polygon, PolyLine, Line, Ink, Highlight,
  StrikeOut, Underline, Squiggly, Text, Stamp`), excluding `Link/Popup/Widget`.
  Returns `{ sourceType, markupCount, perPageCounts }`. Runs before any image
  conversion, so digital files skip rasterization entirely.
- **Parse service** (`src/services/parse-extraction-service.js`, NEW): extracts
  text + coords from the chosen layer, then a **cheap text-only Claude call**
  classifies each extracted string into `markup_type / related_to / confidence`
  (no image sent). Emits the **same `ExtractionResult` shape** the vision path
  returns, so `addExtractionResults`, SSE events, and the entire UI are
  unchanged.

### Why these decisions

- **Backend, not client:** the extraction must run through the server-side eval
  harness. (The stray `redlineiq-backend: file:..` line in `client/package.json`
  was an artifact of putting parse in the wrong place — it gets reverted.)
- **Text-only LLM labeling:** `markup_type`, `related_to`, `confidence` are
  semantic interpretations and are **not** in the PDF. Parsing gives lossless
  text + coords; a text-only pass adds the labels at ~pennies (no image tokens).
- **Capture coords now, defer highlight UI:** annotation `rect` / text position
  is free at parse time. Store it in a new optional field; on-drawing
  highlighting becomes a clean follow-on with no re-extraction.

## Output schema

Parsed markups map onto the existing schema (`src/models/markup.js`,
`extraction-service.js`) with no breaking changes:

| Field | Source on parse path |
|---|---|
| `markup_text` | annotation `contents` / content-stream text |
| `markup_type` | text-only LLM label (`add/delete/move/modify/dimension/note/clarify/detail`) |
| `related_to` | text-only LLM label (spatial + content reasoning) |
| `confidence` | text-only LLM label (parse text is high-confidence by default) |
| `location_on_drawing` | best-effort string (kept for compatibility) |
| `coordinates` (NEW, optional) | annotation `rect` / text transform — captured, not yet rendered |
| `id`, `drawing_reference` | generated / title-block as today |

## Evaluation

One harness, one scoring definition (recall / precision) — add a **dimension**,
not new metrics:

1. Tag each eval case with its true `source_type` (`digital_annotation` /
   `digital_flattened` / `raster`) in the label metadata.
2. Pipeline routes each case end-to-end (probe → extract → score).
3. Report **broken down by regime** plus an overall: e.g.
   `annotation: 0.99 / flattened: 0.xx / raster: 0.54 / overall: 0.xx`. The
   headline number stays decomposable and honest — never blend regimes into one
   misleading figure.
4. Add a **router-accuracy** line: was each case routed to the correct
   extractor? A mis-route (digital → vision, or flattened-with-stray-annotation
   → wrong path) is the most dangerous new failure mode and must be measured.

A/B fixture: `case_011` and `case_012` exist un-flattened; the flattened
counterparts (`*_flattened.pdf`) give the same redlines in a second regime —
ideal controlled tests once given labels (copy the original's `expected_markups`,
flip the `source_type` tag).

## Phasing

**Phase 1 (this spec → implementation plan): un-flattened annotation parse.**
Router: `annotations > 0 → parse, else → vision (existing)`. Builds all shared
plumbing — probe, parse service, text-only labeling, schema mapping + coords,
eval regime-segmentation + router-accuracy. Proven, lowest-risk, ships a clean
near-100% win for the un-flattened subset (demo + current PD​F-XChange testers).

**Phase 2 (future spec): flattened-vector color-filtered parse.** Adds the
third regime — the field-majority lever. Reuses every Phase 1 component and adds
only the color-aware content-stream extraction front-end. Deferred because it is
the riskiest part and should sit on proven plumbing.

## Known constraints / risks (carry into eval as stress cases)

- **Color decoding must be complete.** The diagnostic missed green/orange
  substrate text set via a non-RGB colorspace (bucketed as black). Phase 2's
  parser must decode *all* text colors before trusting "is this redline-colored."
  Redlines themselves come through as clean `setFillRGBColor` (RGB hex).
- **Text-bearing markups only (Phase 2).** Flattened clouds/arrows become vector
  paths — invisible to `getTextContent`. Parse recovers notes, not bare
  graphical markups; those fall through to vision.
- **Redline-color assumption (Phase 2).** Held on 2 sheets. A drawing whose
  substrate contains genuine red text would defeat the color filter — a required
  eval stress case before relying on it.
- **`>0` whole-file routing.** A flattened file with one stray live annotation
  could mis-route to parse and under-extract. Per-page routing is the deferred
  mitigation; router-accuracy eval is the detector.
- **Watermark contamination.** Free-version PD​F-XChange flatten injects gold
  `rgb(255,215,0)` "demo" stamps. Fine for structural diagnosis (distinct,
  excludable color) but the watermarked `*_flattened.pdf` files need a clean
  flatten before use as eval *scoring* fixtures.
- **gs ≠ field tools.** Ghostscript flatten preserved text but did not carry the
  redline color through the same way; PD​F-XChange did. Field behavior is
  tool-dependent — the probe's content-color check is the runtime guard.

## Out of scope

- On-drawing highlight rendering in `PdfViewer` (coords captured, UI deferred).
- Per-page / mixed-regime routing within a single file (per-page counts logged).
- Phase 2 color-filtered flattened parse (separate future spec).
- Any change to the existing tiled-vision extraction itself.
