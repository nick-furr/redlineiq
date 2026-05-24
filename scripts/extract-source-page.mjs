import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

const sourceDir = path.resolve('evals/synthetic/source');
const candidates = ['bohler_walpole.pdf', '9_updated_civil_engineering_plan_set_prepared_by_bohler.pdf'];

let sourcePath = null;
for (const name of candidates) {
  const p = path.join(sourceDir, name);
  try {
    await fs.access(p);
    sourcePath = p;
    break;
  } catch {}
}

if (!sourcePath) {
  console.error(`No source PDF found in ${sourceDir}. Looked for: ${candidates.join(', ')}`);
  process.exit(1);
}

const pageIndex = 4;
const outPath = path.resolve('evals/pdfs/case_R001_walpole_c401_grading.pdf');

const srcBytes = await fs.readFile(sourcePath);
const src = await PDFDocument.load(srcBytes);

if (pageIndex >= src.getPageCount()) {
  console.error(`Source has ${src.getPageCount()} pages; page 5 (index ${pageIndex}) doesn't exist`);
  process.exit(1);
}

const out = await PDFDocument.create();
const [copied] = await out.copyPages(src, [pageIndex]);
out.addPage(copied);

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, await out.save());

console.log(`✓ Source: ${path.basename(sourcePath)} (page 5 of ${src.getPageCount()})`);
console.log(`✓ Output: ${outPath}`);
