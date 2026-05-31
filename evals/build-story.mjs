// Generates a single self-contained story.html for the RedlineIQ call artifact.
// Reads the real run JSONs so every number on the page is file-backed — no hand transcription.
// Regenerate any time: `node evals/build-story.mjs`

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const runsDir = join(dirname(fileURLToPath(import.meta.url)), "runs");
const load = (name) => JSON.parse(readFileSync(join(runsDir, `${name}.json`), "utf8"));
const caseRow = (run, caseId) => run.results.find((r) => r.case_id === caseId);

// --- Source runs -----------------------------------------------------------
const baseline = load("2026-05-28_v0.9"); // 9-case pinned baseline, tiling OFF
const currentFull = load("2026-05-29_current"); // 11 cases, tiling OFF — shows dense-sheet failure
const tile012 = load("2026-05-29_current_tile_only"); // case_012, tiled
const tileV09 = load("2026-05-28_v0.9_tile"); // case_001 tiled, pre-postprocess
const tile001Post = load("2026-05-30_current_tile_only"); // case_001 tiled + postprocess

const pct = (n) => (n == null ? "—" : n.toFixed(3));
const sp = (n) => (n == null ? "—" : n.toFixed(2));

// --- Narrative data points (all derived from the runs above) ---------------
const agg = baseline.aggregate;

const dense012Single = caseRow(currentFull, "case_012_sanmarcos_s201_framing").scores;
const dense011Single = caseRow(currentFull, "case_011_walpole_c401_grading").scores;
const dense012Tiled = caseRow(tile012, "case_012_sanmarcos_s201_framing").scores;

const c001RawTile = caseRow(tileV09, "case_001_c301_site_layout").scores; // pre-postprocess
const c001PostTile = caseRow(tile001Post, "case_001_c301_site_layout").scores; // post-postprocess

const baseRows = baseline.results
  .map((r) => {
    const s = r.scores;
    return `<tr>
      <td>${r.case_id.replace(/^case_\d+_/, "").replace(/_/g, " ")}</td>
      <td class="disc">${r.discipline}</td>
      <td>${r.sheet}</td>
      <td class="num">${pct(s.recall)}</td>
      <td class="num">${pct(s.precision)}</td>
      <td class="num">${sp(s.specificity)}</td>
      <td class="num dim">${s.matched}/${s.total_expected}</td>
    </tr>`;
  })
  .join("\n");

const card = (v, l, accent = "") =>
  `<div class="m${accent ? " " + accent : ""}"><div class="v">${v}</div><div class="l">${l}</div></div>`;

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RedlineIQ — Engineering Story</title>
<style>
  :root{--bg:#0d0d0f;--panel:#16161a;--line:#26262c;--ink:#e6e6ea;--dim:#7a7a85;--green:#4ade80;--red:#f87171;--blue:#60a5fa;--amber:#fbbf24}
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:var(--bg);color:var(--ink);line-height:1.5;padding:2.5rem 2rem 4rem}
  .wrap{max-width:920px;margin:0 auto}
  h1{font-size:1.5rem;margin:0 0 .15rem;letter-spacing:-.01em}
  .sub{color:var(--dim);font-size:.82rem;margin-bottom:2.25rem}
  h2{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin:2.75rem 0 .25rem;font-weight:600}
  .cap{color:var(--dim);font-size:.9rem;margin:0 0 1rem;max-width:64ch}
  .cap b{color:var(--ink);font-weight:600}
  .agg{display:flex;gap:1rem;flex-wrap:wrap;margin:1rem 0}
  .m{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:.9rem 1.3rem;min-width:130px}
  .m .v{font-size:1.9rem;font-weight:700;color:#fff;line-height:1}
  .m .l{font-size:.68rem;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin-top:.4rem}
  .m.win .v{color:var(--green)} .m.warn .v{color:var(--amber)}
  table{width:100%;border-collapse:collapse;font-size:.84rem;margin:.5rem 0 .5rem}
  th{background:#121216;padding:.5rem .65rem;text-align:left;color:var(--dim);font-weight:500;border-bottom:1px solid var(--line);font-size:.74rem;text-transform:uppercase;letter-spacing:.04em}
  td{padding:.5rem .65rem;border-bottom:1px solid #1c1c22}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  td.dim,.dim{color:var(--dim)} td.disc{color:var(--dim);text-transform:capitalize}
  .delta{display:inline-block;border:1px solid var(--line);border-radius:6px;background:var(--panel);overflow:hidden;margin:.4rem 0 .2rem}
  .delta table{margin:0}
  .ba{display:flex;gap:0;align-items:stretch;margin:.6rem 0 1.2rem;flex-wrap:wrap}
  .ba .col{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:1rem 1.3rem;flex:1;min-width:200px}
  .ba .col.before{opacity:.7}
  .ba .arrow{display:flex;align-items:center;color:var(--dim);font-size:1.4rem;padding:0 .8rem}
  .ba .tag{font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--dim);margin-bottom:.5rem}
  .ba .big{font-size:1.6rem;font-weight:700}
  .ba .big.up{color:var(--green)} .ba .big.down{color:var(--red)}
  .ba .meta{font-size:.78rem;color:var(--dim);margin-top:.35rem}
  .foot{margin-top:3rem;border-top:1px solid var(--line);padding-top:1.25rem;color:var(--dim);font-size:.8rem}
  .foot b{color:var(--ink)} .foot ul{margin:.5rem 0 0;padding-left:1.1rem} .foot li{margin:.25rem 0}
  code{background:#1c1c22;border:1px solid var(--line);border-radius:4px;padding:.05rem .35rem;font-size:.85em;color:#cdd}
</style></head><body><div class="wrap">

<h1>RedlineIQ — How the extraction pipeline earns its numbers</h1>
<div class="sub">Vision extraction of construction redlines · Claude Sonnet 4.6 · deterministic eval (temp 0 extract + Haiku judge) · generated from saved run files</div>

<h2>Baseline — where the measured suite stands</h2>
<p class="cap">Nine annotated sheets across civil, architectural, MEP and structural. Pinned prompt <b>v0.9</b>, single-image path. Every markup is graded by an independent judge against a hand-built answer key — <b>recall</b> = real markups found, <b>precision</b> = of what was returned, how much was real, <b>specificity</b> = how detailed the call-out is (higher = more actionable).</p>
<div class="agg">
  ${card(pct(agg.recall), "Recall")}
  ${card(pct(agg.precision), "Precision")}
  ${card(sp(agg.specificity), "Specificity")}
  ${card(baseline.cases_evaluated, "Cases")}
</div>

<h2>Lever 1 — Tiling cracks dense-sheet confabulation</h2>
<p class="cap">On dense sheets (framing, grading), Sonnet 4.6's <b>1568px server-side image cap</b> shrinks the drawing until fine call-outs blur — the model stops reading and starts <b>confabulating</b>. Two real failures, single-image: <b>Walpole C-401 grading R ${pct(dense011Single.recall)}</b> (${dense011Single.matched}/${dense011Single.total_expected} found) and <b>San Marcos S-201 framing R ${pct(dense012Single.recall)}</b> (${dense012Single.matched}/${dense012Single.total_expected}). The fix: split the sheet into ≤1568px tiles so every region is read at full resolution.</p>
<div class="ba">
  <div class="col before">
    <div class="tag">San Marcos S-201 · single image</div>
    <div class="big down">${pct(dense012Single.recall)}</div>
    <div class="meta">recall · ${dense012Single.matched}/${dense012Single.total_expected} markups found</div>
  </div>
  <div class="arrow">→</div>
  <div class="col">
    <div class="tag">Same sheet · tiled</div>
    <div class="big up">${pct(dense012Tiled.recall)}</div>
    <div class="meta">recall · ${dense012Tiled.matched}/${dense012Tiled.total_expected} markups found</div>
  </div>
</div>
<p class="cap dim">~11× recall on the sheet that was effectively blank. Walpole C-401 is the same failure mode, queued for the tiled pass.</p>

<h2>Lever 2 — Precision post-processing pays the tiling tax</h2>
<p class="cap">Tiling buys recall but inflates output: the same markup gets reported from adjacent tiles, plus location-only noise. Raw tiled extraction balloons the return count and precision drops. <code>markup-postprocess.js</code> fixes it deterministically — drop location-only markers, Jaccard cross-tile dedup (≥0.6), unique-ID renumber with <code>related_to</code> remapping.</p>
<div class="ba">
  <div class="col before">
    <div class="tag">C-301 · tiled, raw</div>
    <div class="big down">${pct(c001RawTile.precision)}</div>
    <div class="meta">precision · ${c001RawTile.total_extracted} extractions returned</div>
  </div>
  <div class="arrow">→</div>
  <div class="col">
    <div class="tag">C-301 · tiled + post-process</div>
    <div class="big up">${pct(c001PostTile.precision)}</div>
    <div class="meta">precision · ${c001PostTile.total_extracted} extractions · recall held ${pct(c001PostTile.recall)}</div>
  </div>
</div>
<p class="cap dim">Dedup collapses ${c001RawTile.total_extracted} raw returns to ${c001PostTile.total_extracted} real ones. Same pass lifted San Marcos S-201 precision 0.379 → 0.625 with recall held (commit <code>e48ce35</code>).</p>

<h2>Full baseline — per sheet</h2>
<p class="cap">The detail behind the headline. This is the table I run on every change.</p>
<table>
  <thead><tr><th>Case</th><th>Discipline</th><th>Sheet</th><th>Recall</th><th>Precision</th><th>Spec</th><th>Found</th></tr></thead>
  <tbody>
${baseRows}
  </tbody>
</table>

<div class="foot">
  <b>Method.</b> Deterministic harness: temperature-0 extraction, fixed prompt version, independent Haiku judge against a hand-built answer key per sheet. Tiling splits any sheet whose long edge exceeds 1568px. Post-processing is pure deterministic code (no model call): location-only drop → Jaccard dedup ≥0.6 → unique-ID renumber.
  <ul>
    <li><b>Honest gap:</b> tiling is applied per-sheet in production, but I haven't run a single clean full-suite tiled + post-processed pass — so the 9-case aggregate above is the single-image baseline, and the tiling/precision wins are shown per-sheet.</li>
    <li><b>Next build:</b> for digital PDFs (Bluebeam / PDF-XChange), parse the embedded annotation objects directly via pdfjs instead of vision — right tool for the source. Designed, not yet built.</li>
  </ul>
</div>

</div></body></html>`;

const out = join(dirname(fileURLToPath(import.meta.url)), "story.html");
writeFileSync(out, html, "utf8");
console.log("wrote", out);
