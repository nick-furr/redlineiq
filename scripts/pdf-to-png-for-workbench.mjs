import { fromPath } from 'pdf2pic';
import path from 'path';
import fs from 'fs/promises';

const cases = [
  'evals/pdfs/case_002_c401_grading.pdf',
  'evals/pdfs/case_004_hoh_103_office_floorplan.pdf',
  'evals/pdfs/case_006_bath01_elevation.pdf',
];

const outDir = path.resolve('scripts/workbench-images');
await fs.mkdir(outDir, { recursive: true });

for (const pdfRel of cases) {
  const pdfPath = path.resolve(pdfRel);
  const base = path.basename(pdfRel, '.pdf');
  const converter = fromPath(pdfPath, {
    density: 200,
    saveFilename: base,
    savePath: outDir,
    format: 'png',
    width: 2400,
    height: 3200,
  });
  await converter(1);
  console.log(`✓ ${base}.1.png`);
}

console.log(`\nDone. Files in: ${outDir}`);
