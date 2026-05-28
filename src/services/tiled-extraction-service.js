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

  // Multi-tile: run per-tile extraction with tile context
  const perTileResults = [];
  for (const tile of pageTiles) {
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
      perTileResults.push({ tile, result });
    } catch (err) {
      console.warn(`  tile (${tile.gridRow},${tile.gridCol}) extraction failed: ${err.message}`);
    }
  }

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
