#!/usr/bin/env node

/**
 * CLI Extraction Script
 * 
 * Run extraction on a PDF without starting the server.
 * Great for testing and iterating on the prompt.
 * 
 * Usage:
 *   node src/scripts/extract-cli.js <path-to-pdf> [--pages 1,2,3] [--output result.json]
 * 
 * Examples:
 *   node src/scripts/extract-cli.js ./test/sample-redline.pdf
 *   node src/scripts/extract-cli.js ./test/sample-redline.pdf --pages 1,3
 *   node src/scripts/extract-cli.js ./test/sample-redline.pdf --output ./output/result.json
 */

import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import { pdfToImages, getPdfPageCount } from '../utils/pdf-converter.js';
import { extractAllPages } from '../services/extraction-service.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
RedlineIQ Extraction CLI

Usage:
  node src/scripts/extract-cli.js <pdf-path> [options]

Options:
  --pages <nums>    Comma-separated page numbers (e.g., 1,3,5)
  --output <path>   Output file path (default: stdout)
  --verbose         Show detailed progress

Examples:
  node src/scripts/extract-cli.js ./test/sample.pdf
  node src/scripts/extract-cli.js ./test/sample.pdf --pages 1 --verbose
    `);
    process.exit(0);
  }

  // Parse args
  const pdfPath = path.resolve(args[0]);
  const pagesArg = args.indexOf('--pages');
  const outputArg = args.indexOf('--output');
  const verbose = args.includes('--verbose');

  const pages = pagesArg !== -1
    ? args[pagesArg + 1].split(',').map(Number)
    : undefined;
  
  const outputPath = outputArg !== -1
    ? path.resolve(args[outputArg + 1])
    : null;

  // Verify API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key.');
    process.exit(1);
  }

  // Verify PDF exists
  try {
    await fs.access(pdfPath);
  } catch {
    console.error(`Error: File not found: ${pdfPath}`);
    process.exit(1);
  }

  console.log(`\n📄 RedlineIQ Extraction`);
  console.log(`   File: ${path.basename(pdfPath)}`);

  // Get page count
  const totalPages = await getPdfPageCount(pdfPath);
  console.log(`   Pages: ${totalPages}`);

  if (pages) {
    console.log(`   Processing pages: ${pages.join(', ')}`);
  } else {
    console.log(`   Processing: all pages`);
  }

  console.log(`\n🔄 Converting PDF to images...`);
  const startTime = Date.now();

  const pageImages = await pdfToImages(pdfPath, { pages });
  const validImages = pageImages.filter(p => p.base64);
  console.log(`   ✓ ${validImages.length} pages converted (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);

  console.log(`\n🤖 Running extraction with Claude...\n`);

  const result = await extractAllPages(
    validImages,
    { projectName: path.basename(pdfPath, '.pdf') },
    (pageNum, total, pageResult) => {
      if (pageResult.error) {
        console.log(`   ✗ Page ${pageNum}/${total}: ERROR - ${pageResult.error}`);
      } else {
        const count = pageResult.markups ? pageResult.markups.length : 0;
        console.log(`   ✓ Page ${pageNum}/${total}: ${count} markups found`);
        
        if (verbose && pageResult.markups) {
          for (const m of pageResult.markups) {
            const flag = m.ambiguous ? ' ⚠️' : '';
            const conf = m.confidence === 'low' ? ' [low conf]' : '';
            console.log(`      ${m.id}: [${m.markup_type}] "${m.markup_text}"${conf}${flag}`);
          }
        }
      }
    }
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Print summary
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📊 Extraction Complete (${elapsed}s)`);
  console.log(`   Total markups: ${result.totalMarkups}`);
  console.log(`   Pages processed: ${result.stats.pagesProcessed}/${result.stats.totalPages}`);
  
  if (result.stats.pagesFailed > 0) {
    console.log(`   Pages failed: ${result.stats.pagesFailed}`);
  }

  console.log(`\n   By type:`);
  for (const [type, count] of Object.entries(result.stats.byType)) {
    console.log(`     ${type}: ${count}`);
  }

  console.log(`\n   By confidence:`);
  console.log(`     High: ${result.stats.byConfidence.high}`);
  console.log(`     Medium: ${result.stats.byConfidence.medium}`);
  console.log(`     Low: ${result.stats.byConfidence.low}`);

  if (result.stats.ambiguousCount > 0) {
    console.log(`\n   ⚠️  Ambiguous items: ${result.stats.ambiguousCount}`);
  }

  // Output results
  const output = JSON.stringify(result, null, 2);

  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, output, 'utf-8');
    console.log(`\n💾 Results saved to: ${outputPath}`);
  } else {
    console.log(`\n📋 Full JSON output:\n`);
    console.log(output);
  }
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
