#!/usr/bin/env node
/**
 * RedlineIQ eval harness.
 *
 * Usage:
 *   node evals/run-eval.js                         # all PDFs in pdfs/, uses prompts/active.md
 *   node evals/run-eval.js --working-set           # exclude holdout/
 *   node evals/run-eval.js --prompt v0.7           # loads prompts/v0.7.md if exists, else uses
 *                                                  # active.md and the tag is label-only
 *
 * Each run writes to evals/runs/YYYY-MM-DD_<tag>.json + .html
 */
import 'dotenv/config';
import { readdir, readFile, writeFile, mkdir, access } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { pdfToImages } from '../src/utils/pdf-converter.js';
import { judgeMarkup } from './lib/llm-judge.js';
import { scoreCase } from './lib/score.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const PDFS_DIR    = join(HERE, 'pdfs');
const LABELS_DIR  = join(HERE, 'labels');
const HOLDOUT_DIR = join(HERE, 'holdout');
const RUNS_DIR    = join(HERE, 'runs');
const REPO_ROOT   = resolve(HERE, '..');

const args = process.argv.slice(2);
const workingSetOnly = args.includes('--working-set');
const promptIdx = args.indexOf('--prompt');
const promptVersion = promptIdx !== -1 ? args[promptIdx + 1] : 'current';

// If --prompt names a file under prompts/, point extraction-service.js at it via env var
// before the module is dynamically imported. Otherwise fall back to prompts/active.md and
// treat the tag as a label only (preserves the variance-baseline pattern of v0.6-var1, etc).
const candidatePromptFile = `prompts/${promptVersion}.md`;
if (existsSync(resolve(REPO_ROOT, candidatePromptFile))) {
  process.env.REDLINEIQ_PROMPT_FILE = candidatePromptFile;
  console.log(`Prompt source: ${candidatePromptFile}`);
} else if (promptIdx !== -1) {
  console.log(`Prompt source: prompts/active.md (no prompts/${promptVersion}.md found; --prompt tag is label-only)`);
}

const { extractMarkupsFromPage } = await import('../src/services/extraction-service.js');

async function run() {
  await mkdir(RUNS_DIR, { recursive: true });

  const allPdfs = (await readdir(PDFS_DIR)).filter(f => f.endsWith('.pdf'));
  const holdoutNames = new Set(
    (await readdir(HOLDOUT_DIR).catch(() => [])).filter(f => f.endsWith('.pdf'))
  );
  const pdfs = workingSetOnly ? allPdfs.filter(f => !holdoutNames.has(f)) : allPdfs;

  if (pdfs.length === 0) {
    console.log('No PDFs found. Add marked-up PDFs to evals/pdfs/ and labels to evals/labels/.');
    process.exit(0);
  }

  console.log(`\nRedlineIQ eval — prompt: ${promptVersion} — ${pdfs.length} PDF(s)${workingSetOnly ? ' (working set)' : ''}\n`);

  const results = [];

  for (const pdfFile of pdfs) {
    const caseId = pdfFile.replace('.pdf', '');
    const labelPath = join(LABELS_DIR, `${caseId}.json`);

    try {
      await access(labelPath);
    } catch {
      console.warn(`  Skipping ${pdfFile} — no label at labels/${caseId}.json\n`);
      continue;
    }

    const label = JSON.parse(await readFile(labelPath, 'utf-8'));
    console.log(`${caseId}  [${label.discipline}]  ${label.expected_markups.length} expected`);

    const pageImages = await pdfToImages(join(PDFS_DIR, pdfFile));

    const allExtracted = [];
    for (const pageImage of pageImages) {
      const result = await extractMarkupsFromPage(pageImage, { projectName: label.sheet });
      allExtracted.push(...result.markups);
    }
    console.log(`  extracted: ${allExtracted.length}`);

    const matchResults = [];
    for (const expected of label.expected_markups) {
      const matched = await judgeMarkup(expected.concept, allExtracted);
      matchResults.push({ ...expected, matched });
      console.log(`  ${matched ? '✓' : '✗'} ${expected.id}  ${expected.concept.slice(0, 70)}`);
    }

    const scores = scoreCase(matchResults, allExtracted.length);
    console.log(`  → recall=${scores.recall}  precision=${scores.precision}  specificity=${scores.specificity}\n`);

    results.push({ case_id: caseId, discipline: label.discipline, sheet: label.sheet, scores, match_results: matchResults, extracted_count: allExtracted.length, extracted_markups: allExtracted });
  }

  const aggregate = {
    recall: avg(results.map(r => r.scores.recall)),
    precision: avg(results.map(r => r.scores.precision)),
    specificity: avg(results.map(r => r.scores.specificity)),
  };

  const timestamp = new Date().toISOString().slice(0, 10);
  const runPath = join(RUNS_DIR, `${timestamp}_${promptVersion}.json`);
  const htmlPath = runPath.replace('.json', '.html');

  const output = { timestamp: new Date().toISOString(), prompt_version: promptVersion, working_set_only: workingSetOnly, cases_evaluated: results.length, aggregate, results };

  await writeFile(runPath, JSON.stringify(output, null, 2));
  await writeFile(htmlPath, buildHtml(output));

  console.log(`Aggregate  recall=${aggregate.recall}  precision=${aggregate.precision}  specificity=${aggregate.specificity}`);
  console.log(`\nJSON : ${runPath}`);
  console.log(`HTML : ${htmlPath}`);
}

function avg(arr) {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 1000) / 1000 : 0;
}

function buildHtml(output) {
  const rows = output.results.flatMap(r =>
    r.match_results.map(m => `<tr class="${m.matched ? 'ok' : 'miss'}">
      <td>${r.case_id}</td><td>${m.id}</td>
      <td>${m.matched ? '✓' : '✗'}</td>
      <td>${m.category}</td><td>${m.specificity_target}</td>
      <td>${m.is_ambiguous ? '●' : ''}</td>
      <td>${m.concept}</td>
    </tr>`)
  ).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>RedlineIQ Eval — ${output.timestamp.slice(0,10)} ${output.prompt_version}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:2rem;background:#0f0f0f;color:#e0e0e0;margin:0}
  h1{font-size:1.1rem;color:#f0f0f0;margin:0 0 0.25rem}
  .meta{color:#666;font-size:0.8rem;margin-bottom:1.5rem}
  .agg{display:flex;gap:1.5rem;margin-bottom:2rem}
  .m{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:0.75rem 1.25rem}
  .m .v{font-size:1.75rem;font-weight:700;color:#fff}
  .m .l{font-size:0.7rem;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:0.82rem}
  th{background:#161616;padding:.45rem .6rem;text-align:left;color:#666;font-weight:500;border-bottom:1px solid #2a2a2a}
  td{padding:.35rem .6rem;border-bottom:1px solid #1a1a1a;vertical-align:top}
  tr.ok td:nth-child(3){color:#4ade80}
  tr.miss td:nth-child(3){color:#f87171}
  tr.miss{opacity:.65}
</style></head><body>
<h1>RedlineIQ Eval</h1>
<div class="meta">${output.timestamp.slice(0,16).replace('T',' ')} · prompt: ${output.prompt_version} · ${output.cases_evaluated} case(s)</div>
<div class="agg">
  <div class="m"><div class="v">${output.aggregate.recall}</div><div class="l">Recall</div></div>
  <div class="m"><div class="v">${output.aggregate.precision}</div><div class="l">Precision</div></div>
  <div class="m"><div class="v">${output.aggregate.specificity}</div><div class="l">Specificity</div></div>
</div>
<table><thead><tr><th>Case</th><th>ID</th><th>Match</th><th>Category</th><th>Spec</th><th>Amb</th><th>Expected concept</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}

run().catch(err => { console.error(err); process.exit(1); });
