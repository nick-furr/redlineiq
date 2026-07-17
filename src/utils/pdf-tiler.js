/**
 * PDF → Tile Images
 *
 * Splits each PDF page into an N×M grid of overlapping tiles, each sized
 * so that its long edge ≈ 1568 px (Sonnet 4.6's server-side image resize
 * ceiling). The point: deliver high effective DPI to the model on a large
 * sheet by chopping it into smaller pieces that each fit within Anthropic's
 * input cap, rather than downsampling the whole sheet to fit.
 *
 * This is the production raster pipeline (job-service.js), separate from
 * pdf-converter.js, which the CLI's raster branch and the eval harness's
 * default (non --tile) runs use instead. See ADR 0003 for the validating
 * measurements and notes/extraction-quality-levers.md for the why.
 */

import { fromPath } from 'pdf2pic';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const TARGET_TILE_LONG_EDGE_PX = 1568; // matches Anthropic Sonnet 4.6 server resize cap
const TILE_OVERLAP_RATIO = 0.10;       // 10% overlap between adjacent tiles
const RASTER_DPI = 200;                // base density for full-page rasterization
const MIN_LONG_EDGE_IN_FOR_TILING = 12; // don't tile small sheets

/**
 * Convert a PDF file into an array of tile images per page.
 *
 * @param {string} pdfPath - Absolute path to PDF
 * @param {Object} [options]
 * @param {number} [options.dpi=200] - Rasterization density before slicing
 * @returns {Promise<TileImage[]>}
 *
 * @typedef {Object} TileImage
 * @property {number} pageNumber - 1-indexed
 * @property {number} tileIndex - 0-indexed flat index within page
 * @property {number} gridRow - 0-indexed row position
 * @property {number} gridCol - 0-indexed column position
 * @property {number} gridRows - Total rows in this page's grid
 * @property {number} gridCols - Total cols in this page's grid
 * @property {string} base64 - Base64 PNG (no data URI prefix)
 * @property {string} mediaType - 'image/png'
 * @property {number} width - Tile width in pixels
 * @property {number} height - Tile height in pixels
 */
export async function pdfToTiledImages(pdfPath, options = {}) {
  const { dpi = RASTER_DPI } = options;

  try {
    await fs.access(pdfPath);
  } catch {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  // Get native PDF dimensions per page (in inches)
  const { PDFDocument } = await import('pdf-lib');
  const pdfBuffer = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();

  const tiles = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const { width: pdfPtW, height: pdfPtH } = pdfDoc.getPage(pageNum - 1).getSize();
    const widthIn = pdfPtW / 72;
    const heightIn = pdfPtH / 72;
    const longEdgeIn = Math.max(widthIn, heightIn);

    // Decide grid size — adaptive to sheet size
    const { gridRows, gridCols } = computeGrid(widthIn, heightIn);
    const shouldTile = longEdgeIn >= MIN_LONG_EDGE_IN_FOR_TILING && gridRows * gridCols > 1;

    if (!shouldTile) {
      // Small sheet — just render once at TARGET_TILE_LONG_EDGE_PX long edge
      const targetW = Math.round(widthIn / longEdgeIn * TARGET_TILE_LONG_EDGE_PX);
      const targetH = Math.round(heightIn / longEdgeIn * TARGET_TILE_LONG_EDGE_PX);
      const buf = await rasterizePage(pdfPath, pageNum, targetW, targetH);
      const processed = await toBase64Png(buf);
      tiles.push({
        pageNumber: pageNum,
        tileIndex: 0,
        gridRow: 0,
        gridCol: 0,
        gridRows: 1,
        gridCols: 1,
        ...processed,
      });
      continue;
    }

    // Tiled — rasterize the full page at higher resolution, then slice
    const fullW = Math.round(widthIn * dpi);
    const fullH = Math.round(heightIn * dpi);
    const fullBuf = await rasterizePage(pdfPath, pageNum, fullW, fullH);

    // Verify what pdf2pic actually produced (may differ slightly from requested)
    const fullMeta = await sharp(fullBuf).metadata();
    const actualW = fullMeta.width;
    const actualH = fullMeta.height;

    // Compute tile dimensions with overlap
    const baseTileW = Math.floor(actualW / gridCols);
    const baseTileH = Math.floor(actualH / gridRows);
    const overlapW = Math.round(baseTileW * TILE_OVERLAP_RATIO);
    const overlapH = Math.round(baseTileH * TILE_OVERLAP_RATIO);

    let tileIdx = 0;
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        // Compute crop box with overlap into neighbors
        const left = Math.max(0, c * baseTileW - overlapW);
        const top = Math.max(0, r * baseTileH - overlapH);
        const rightEdge = Math.min(actualW, (c + 1) * baseTileW + overlapW);
        const bottomEdge = Math.min(actualH, (r + 1) * baseTileH + overlapH);
        const cropW = rightEdge - left;
        const cropH = bottomEdge - top;

        const tileBuf = await sharp(fullBuf)
          .extract({ left, top, width: cropW, height: cropH })
          .png({ quality: 90, compressionLevel: 6 })
          .toBuffer();

        const processed = await toBase64Png(tileBuf);
        tiles.push({
          pageNumber: pageNum,
          tileIndex: tileIdx,
          gridRow: r,
          gridCol: c,
          gridRows,
          gridCols,
          ...processed,
        });
        tileIdx++;
      }
    }

    console.log(
      `[pdf-tiler] page ${pageNum}: ${widthIn.toFixed(1)}"x${heightIn.toFixed(1)}" → ` +
      `${gridRows}x${gridCols} grid = ${tileIdx} tiles ` +
      `(base tile ~${baseTileW}x${baseTileH}px, overlap ~${overlapW}x${overlapH}px)`
    );
  }

  return tiles;
}

/**
 * Compute grid dimensions targeting ~1568px long edge per tile at RASTER_DPI.
 * Returns {gridRows: 1, gridCols: 1} for small sheets (no tiling).
 */
function computeGrid(widthIn, heightIn) {
  const longEdgeIn = Math.max(widthIn, heightIn);
  if (longEdgeIn < MIN_LONG_EDGE_IN_FOR_TILING) {
    return { gridRows: 1, gridCols: 1 };
  }

  // Each tile should be ~1568px long edge at RASTER_DPI = ~7.84 inches
  const targetTileLongEdgeIn = TARGET_TILE_LONG_EDGE_PX / RASTER_DPI;
  const longEdgeTiles = Math.max(1, Math.ceil(longEdgeIn / targetTileLongEdgeIn));
  // Short edge tile count: same per-inch tiling density
  const shortEdgeIn = Math.min(widthIn, heightIn);
  const shortEdgeTiles = Math.max(1, Math.round(shortEdgeIn / targetTileLongEdgeIn));

  return widthIn >= heightIn
    ? { gridRows: shortEdgeTiles, gridCols: longEdgeTiles }
    : { gridRows: longEdgeTiles, gridCols: shortEdgeTiles };
}

async function rasterizePage(pdfPath, pageNum, targetW, targetH) {
  const converter = fromPath(pdfPath, {
    density: RASTER_DPI,
    saveFilename: `page${pageNum}`,
    savePath: path.dirname(pdfPath),
    format: 'png',
    width: targetW,
    height: targetH,
    preserveAspectRatio: true,
  });
  const result = await converter(pageNum, { responseType: 'buffer' });
  if (!result || !result.buffer) {
    throw new Error(`pdf2pic returned no buffer for page ${pageNum}`);
  }
  return result.buffer;
}

async function toBase64Png(buffer) {
  const meta = await sharp(buffer).metadata();
  return {
    base64: buffer.toString('base64'),
    mediaType: 'image/png',
    width: meta.width,
    height: meta.height,
  };
}
