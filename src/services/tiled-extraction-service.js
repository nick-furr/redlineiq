/**
 * Tiled Extraction Service (eval prototype)
 *
 * Wraps the standard extractMarkupsFromPage to support tiled inputs:
 *   1. Each page is split into N tile images by pdf-tiler.js
 *   2. extractMarkupsFromPage runs per tile with tile-context augmentation
 *   3. Per-tile markup lists are merged with text-similarity dedup
 *
 * The point: deliver more effective per-region DPI to Claude Vision on
 * large sheets where the whole-sheet image otherwise gets server-side
 * downsampled below the resolution needed to read handwriting.
 *
 * This is an eval-only parallel path to extraction-service.js. Production
 * extraction is unchanged. See ADR 0003 + notes/extraction-quality-levers.md.
 */

import { extractMarkupsFromPage } from './extraction-service.js';

/**
 * Extract markups from a page by tile-and-merge.
 *
 * @param {TileImage[]} pageTiles - All tiles for a single page (from pdfToTiledImages, filtered by pageNumber)
 * @param {Object} [context] - Same shape as extractMarkupsFromPage's context
 * @returns {Promise<Object>} Same shape as extractMarkupsFromPage's return value
 */
export async function extractMarkupsFromTiledPage(pageTiles, context = {}) {
  if (pageTiles.length === 0) {
    throw new Error('No tiles provided to extractMarkupsFromTiledPage');
  }
  const pageNumber = pageTiles[0].pageNumber;

  // Single-tile case (small sheets that weren't tiled): just run once, skip merge
  if (pageTiles.length === 1) {
    return extractMarkupsFromPage(pageTiles[0], context);
  }

  // Multi-tile: run per-tile extraction with tile context, capped concurrency.
  // Sequential would be ~N×latency (15 tiles ≈ 60s); a small pool keeps wall-clock
  // low for a live demo while staying under rate limits (each tile call already
  // self-retries on 429).
  const TILE_CONCURRENCY = 4;
  const perTileResults = [];
  let cursor = 0;
  async function worker() {
    while (cursor < pageTiles.length) {
      const i = cursor++;
      const tile = pageTiles[i];
      const tileContext = {
        ...context,
        tileInfo: {
          gridRow: tile.gridRow,
          gridCol: tile.gridCol,
          gridRows: tile.gridRows,
          gridCols: tile.gridCols,
        },
      };
      try {
        const result = await extractMarkupsFromPage(tile, tileContext);
        perTileResults.push({ tile, result, order: i });
      } catch (err) {
        console.warn(`  tile (${tile.gridRow},${tile.gridCol}) extraction failed: ${err.message}`);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(TILE_CONCURRENCY, pageTiles.length) }, () => worker())
  );
  // Restore tile order so the dedup's confidence-replace logic is deterministic
  perTileResults.sort((a, b) => a.order - b.order);

  // Merge: collect all markups, dedup by normalized text
  const allMarkups = [];
  const seen = new Map(); // normalized text → kept markup

  for (const { tile, result } of perTileResults) {
    for (const markup of result.markups) {
      const key = normalizeText(markup.markup_text);
      // Skip empty/no-content markups (sometimes tiles emit clouds with no inferable text)
      if (!key || key.length < 3) {
        // Keep them anyway under a more unique key so we don't drop them entirely,
        // but tag location to avoid trivial dupes
        const fallbackKey = `${key}|${tile.gridRow},${tile.gridCol}`;
        if (!seen.has(fallbackKey)) {
          seen.set(fallbackKey, markup);
          allMarkups.push(markup);
        }
        continue;
      }

      if (seen.has(key)) {
        // Already have this markup from another tile — keep the one with higher confidence
        const existing = seen.get(key);
        if (confidenceRank(markup.confidence) > confidenceRank(existing.confidence)) {
          // Replace in allMarkups
          const idx = allMarkups.indexOf(existing);
          if (idx !== -1) allMarkups[idx] = markup;
          seen.set(key, markup);
        }
      } else {
        seen.set(key, markup);
        allMarkups.push(markup);
      }
    }
  }

  // Use first tile's page metadata as the page-level fields
  const firstResult = perTileResults[0]?.result || {};

  console.log(
    `  merged: ${perTileResults.reduce((s, r) => s + r.result.markups.length, 0)} per-tile markups → ` +
    `${allMarkups.length} after dedup`
  );

  return {
    page_number: pageNumber,
    drawing_reference: firstResult.drawing_reference || 'Unknown',
    drawing_title: firstResult.drawing_title || '',
    total_markups_found: allMarkups.length,
    markups: allMarkups,
  };
}

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\[partially illegible\]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function confidenceRank(conf) {
  return { high: 3, medium: 2, low: 1 }[conf] || 0;
}

/**
 * Extract markups from ALL pages of a PDF using the tiled path.
 *
 * Drop-in parallel to extractAllPages() in extraction-service.js — same
 * return shape ({pages, allMarkups, totalMarkups, stats}) and same per-page
 * onProgress(pageNum, totalPages, result) contract, so job-service.js and
 * addExtractionResults() need no other changes. Tiling is internal to each
 * page; small sheets pass through as a single tile (conditional routing is
 * handled upstream in pdf-tiler.js / extractMarkupsFromTiledPage).
 *
 * @param {TileImage[]} tiles - Flat array of tiles across all pages (from pdfToTiledImages)
 * @param {Object} [context]
 * @param {Function} [onProgress] - (pageNum, totalPages, result) after each page
 * @returns {Promise<Object>} { pages, allMarkups, totalMarkups, stats }
 */
export async function extractAllPagesTiled(tiles, context = {}, onProgress = null) {
  // Group tiles by page, preserving page order
  const byPage = new Map();
  for (const tile of tiles) {
    if (!byPage.has(tile.pageNumber)) byPage.set(tile.pageNumber, []);
    byPage.get(tile.pageNumber).push(tile);
  }
  const pageNumbers = [...byPage.keys()].sort((a, b) => a - b);
  const totalPages = pageNumbers.length;

  const pages = [];
  const allMarkups = [];
  let globalIdCounter = 1;

  for (const pageNumber of pageNumbers) {
    try {
      const result = await extractMarkupsFromTiledPage(byPage.get(pageNumber), context);

      // Re-number IDs to be globally unique across all pages (mirrors extractAllPages)
      for (const markup of result.markups) {
        const oldId = markup.id;
        markup.id = `MK-${String(globalIdCounter).padStart(3, '0')}`;
        for (const other of result.markups) {
          if (other.related_to === oldId) other.related_to = markup.id;
        }
        globalIdCounter++;
      }

      pages.push(result);
      allMarkups.push(...result.markups);
      if (onProgress) onProgress(pageNumber, totalPages, result);
    } catch (err) {
      console.error(`Error extracting page ${pageNumber} (tiled):`, err.message);
      pages.push({
        page_number: pageNumber,
        drawing_reference: 'Error',
        drawing_title: `Failed to process page ${pageNumber}`,
        total_markups_found: 0,
        markups: [],
        error: err.message,
      });
      if (onProgress) onProgress(pageNumber, totalPages, { error: err.message });
    }
  }

  // Stats — same shape as extractAllPages
  const stats = {
    totalPages,
    pagesProcessed: pages.filter(p => !p.error).length,
    pagesFailed: pages.filter(p => p.error).length,
    totalMarkups: allMarkups.length,
    byType: {},
    byConfidence: { high: 0, medium: 0, low: 0 },
    ambiguousCount: 0,
  };
  for (const markup of allMarkups) {
    stats.byType[markup.markup_type] = (stats.byType[markup.markup_type] || 0) + 1;
    if (markup.confidence in stats.byConfidence) stats.byConfidence[markup.confidence]++;
    if (markup.ambiguous) stats.ambiguousCount++;
  }

  return { pages, allMarkups, totalMarkups: allMarkups.length, stats };
}
