/**
 * PDF → Image Conversion
 * 
 * Converts each page of a PDF into a high-res image for Claude Vision.
 * Uses pdf2pic for the conversion and sharp for any post-processing.
 * 
 * Key considerations for redlined drawings:
 * - High DPI (200-300) needed to preserve handwriting legibility
 * - Large architectural sheets may need to be split or downscaled
 *   to fit within Claude's image size limits
 * - Claude Vision accepts images up to ~20MB / 8000x8000px
 */

import { fromPath } from 'pdf2pic';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

// Claude Vision limits
const MAX_IMAGE_DIMENSION = 8000;
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const TARGET_DPI = 200; // Balance between legibility and size

/**
 * Convert a PDF file to an array of base64-encoded page images.
 * 
 * @param {string} pdfPath - Absolute path to the PDF file
 * @param {Object} options
 * @param {number} [options.dpi=200] - Resolution for rendering
 * @param {number[]} [options.pages] - Specific page numbers to convert (1-indexed). 
 *   If omitted, converts all pages.
 * @returns {Promise<PageImage[]>} Array of page images with base64 data
 * 
 * @typedef {Object} PageImage
 * @property {number} pageNumber - 1-indexed page number
 * @property {string} base64 - Base64-encoded image data (no data URI prefix)
 * @property {string} mediaType - MIME type (image/png)
 * @property {number} width - Image width in pixels
 * @property {number} height - Image height in pixels
 */
export async function pdfToImages(pdfPath, options = {}) {
  const { dpi = TARGET_DPI, pages } = options;

  // Verify file exists
  try {
    await fs.access(pdfPath);
  } catch {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  // Set up the converter
  const converter = fromPath(pdfPath, {
    density: dpi,
    saveFilename: 'page',
    savePath: path.dirname(pdfPath),
    format: 'png',
    width: 2400,  // Max width in pixels — keeps large sheets manageable
    height: 3200, // Max height
  });

  // Determine which pages to convert
  let pageNumbers;
  if (pages && pages.length > 0) {
    pageNumbers = pages;
  } else {
    // Convert all pages — pdf2pic uses bulk convert
    // We'll try bulk first, fall back to sequential
    pageNumbers = null;
  }

  const results = [];

  if (pageNumbers) {
    // Convert specific pages
    for (const pageNum of pageNumbers) {
      try {
        const result = await converter(pageNum, { responseType: 'buffer' });
        if (result && result.buffer) {
          const processed = await processImage(result.buffer);
          results.push({
            pageNumber: pageNum,
            ...processed,
          });
        }
      } catch (err) {
        console.warn(`Warning: Failed to convert page ${pageNum}: ${err.message}`);
        results.push({
          pageNumber: pageNum,
          error: err.message,
          base64: null,
          mediaType: 'image/png',
          width: 0,
          height: 0,
        });
      }
    }
  } else {
    // Bulk convert all pages
    try {
      const bulkResult = await converter.bulk(-1, { responseType: 'buffer' });
      for (let i = 0; i < bulkResult.length; i++) {
        const page = bulkResult[i];
        if (page && page.buffer) {
          const processed = await processImage(page.buffer);
          results.push({
            pageNumber: i + 1,
            ...processed,
          });
        }
      }
    } catch (err) {
      // Fallback: try pages one at a time
      console.warn('Bulk conversion failed, trying sequential:', err.message);
      let pageNum = 1;
      let consecutive_failures = 0;
      while (consecutive_failures < 3) {
        try {
          const result = await converter(pageNum, { responseType: 'buffer' });
          if (result && result.buffer) {
            const processed = await processImage(result.buffer);
            results.push({ pageNumber: pageNum, ...processed });
            consecutive_failures = 0;
          } else {
            break;
          }
        } catch {
          consecutive_failures++;
          if (consecutive_failures >= 3) break;
        }
        pageNum++;
      }
    }
  }

  console.log(`Converted ${results.filter(r => r.base64).length} pages from ${path.basename(pdfPath)}`);
  return results;
}

/**
 * Process a raw image buffer:
 * - Resize if too large for Claude Vision
 * - Optimize for file size
 * - Convert to base64
 */
async function processImage(buffer) {
  let image = sharp(buffer);
  const metadata = await image.metadata();

  let { width, height } = metadata;

  // Downscale if exceeding Claude's limits
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    const scale = Math.min(
      MAX_IMAGE_DIMENSION / width,
      MAX_IMAGE_DIMENSION / height
    );
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    image = image.resize(width, height, { fit: 'inside' });
  }

  // Convert to PNG buffer with reasonable quality
  const outputBuffer = await image
    .png({ quality: 90, compressionLevel: 6 })
    .toBuffer();

  // If still too large, reduce quality further
  let finalBuffer = outputBuffer;
  if (outputBuffer.length > MAX_IMAGE_SIZE_BYTES) {
    finalBuffer = await sharp(outputBuffer)
      .resize(Math.round(width * 0.75), Math.round(height * 0.75), { fit: 'inside' })
      .png({ quality: 80, compressionLevel: 8 })
      .toBuffer();
    
    const newMeta = await sharp(finalBuffer).metadata();
    width = newMeta.width;
    height = newMeta.height;
  }

  return {
    base64: finalBuffer.toString('base64'),
    mediaType: 'image/png',
    width,
    height,
  };
}

/**
 * Get the number of pages in a PDF without converting them.
 */
export async function getPdfPageCount(pdfPath) {
  // Use pdf-lib for a quick page count
  const { PDFDocument } = await import('pdf-lib');
  const fileBuffer = await fs.readFile(pdfPath);
  const doc = await PDFDocument.load(fileBuffer);
  return doc.getPageCount();
}
