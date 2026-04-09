/**
 * Extraction Service
 * 
 * The core of RedlineIQ. Sends page images to Claude's Vision API 
 * with a carefully crafted prompt and returns structured markup data.
 * 
 * The extraction prompt was iterated across 3 rounds in the Anthropic
 * Console Workbench against real redlined architectural drawings.
 * Key behaviors locked in:
 *   - Each annotation as its own item
 *   - [illegible] for unreadable handwriting
 *   - Cloud-to-annotation linking via related_to field
 *   - Confidence scoring per item
 *   - Ambiguity flagging for unclear intent
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import { MARKUP_TYPES, CONFIDENCE } from '../models/markup.js';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

// ─── The Extraction Prompt ─────────────────────────────────────
// This is the product's core IP. Every word has been tested.

const SYSTEM_PROMPT = `You are an expert architectural and engineering drawing analyst specializing in interpreting redline markup annotations on construction drawings.

Your task is to extract EVERY redline markup annotation from the provided drawing image and return them as structured JSON.

## Rules

1. **Every annotation is its own item.** If an arrow points to text, the text is one item. If a cloud circles an area, the cloud is one item. If there's a separate note explaining the cloud, that's another item linked via "related_to".

2. **Cloud-to-text linking.** When a revision cloud (or circle, or bubble) highlights an area AND there is a separate text annotation explaining what to do, create entries for BOTH and link them:
   - The cloud/circle gets an entry with markup_type describing the action
   - The text note gets its own entry
   - Set "related_to" on the text note pointing to the cloud's ID, and vice versa

3. **Handwriting handling:**
   - If text is completely unreadable: set markup_text to "[illegible]", confidence to "low"
   - If partially readable: set markup_text to your best interpretation with "[partially illegible]" prefix, include "raw_interpretation" with the literal characters you can make out, confidence to "low"
   - If readable but meaning is unclear: set text normally, confidence to "medium", ambiguous to true

4. **Markup types:** Classify each annotation as one of: ${Object.values(MARKUP_TYPES).join(', ')}. Use "note" as fallback if unclear.

5. **Location descriptions:** Be specific about where on the drawing each markup appears. Reference grid lines, room names, elevation markers, or relative position (e.g., "upper-left quadrant, near the kitchen island").

6. **Drawing reference:** Identify the sheet number/name from title blocks or headers (e.g., "A-201", "C-3.1"). If not visible, use "Unknown".

7. **Be exhaustive.** Do not skip small annotations, dimension corrections, check marks, question marks, or arrows. Each one matters to the drafter.

## Response Format

Respond with ONLY valid JSON, no markdown formatting, no backticks. Use this exact structure:

{
  "page_number": <integer>,
  "drawing_reference": "<sheet number>",
  "drawing_title": "<title from title block or best description>",
  "total_markups_found": <integer>,
  "markups": [
    {
      "id": "MK-<three digit number starting from 001>",
      "markup_text": "<the text/instruction content>",
      "markup_type": "<one of the allowed types>",
      "drawing_reference": "<sheet number>",
      "location_on_drawing": "<specific location description>",
      "related_to": "<ID of related markup or null>",
      "confidence": "<high|medium|low>",
      "ambiguous": <true|false>,
      "raw_interpretation": "<optional: literal characters for low-confidence items>"
    }
  ]
}`;

/**
 * Extract markups from a single page image.
 * 
 * @param {Object} pageImage - From pdfToImages()
 * @param {string} pageImage.base64 - Base64-encoded image
 * @param {string} pageImage.mediaType - MIME type
 * @param {number} pageImage.pageNumber - 1-indexed page number
 * @param {Object} [context] - Additional context
 * @param {string} [context.projectName] - Project name for context
 * @param {string} [context.expectedSheets] - Known sheet numbers
 * @returns {Promise<Object>} Parsed extraction result
 */
export async function extractMarkupsFromPage(pageImage, context = {}) {
  const { base64, mediaType, pageNumber } = pageImage;

  if (!base64) {
    throw new Error(`No image data for page ${pageNumber}`);
  }

  const userMessage = buildUserMessage(pageNumber, context);

  try {
    const response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: userMessage,
            },
          ],
        },
      ],
    });

    // Extract the text response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent) {
      throw new Error('No text response from Claude');
    }

    // Parse JSON — strip any accidental markdown fences
    const rawText = textContent.text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const result = JSON.parse(rawText);

    // Validate and normalize
    return normalizeExtractionResult(result, pageNumber);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error(`JSON parse error on page ${pageNumber}:`, err.message);
      throw new Error(`Failed to parse extraction result for page ${pageNumber}. The API response was not valid JSON.`);
    }
    if (err.status === 429) {
      // Rate limited — wait and retry once
      console.warn('Rate limited, waiting 10s...');
      await sleep(10000);
      return extractMarkupsFromPage(pageImage, context);
    }
    throw err;
  }
}

/**
 * Extract markups from ALL pages of a PDF.
 * Processes pages sequentially to respect rate limits.
 * 
 * @param {PageImage[]} pageImages - Array from pdfToImages()
 * @param {Object} [context] - Additional context
 * @param {Function} [onProgress] - Called after each page: (pageNum, total, result)
 * @returns {Promise<ExtractionResult>}
 * 
 * @typedef {Object} ExtractionResult
 * @property {Object[]} pages - Per-page extraction results
 * @property {Object[]} allMarkups - Flattened array of all markups
 * @property {number} totalMarkups - Total count
 * @property {Object} stats - Summary statistics
 */
export async function extractAllPages(pageImages, context = {}, onProgress = null) {
  const pages = [];
  const allMarkups = [];
  let globalIdCounter = 1;

  for (const pageImage of pageImages) {
    if (!pageImage.base64) {
      console.warn(`Skipping page ${pageImage.pageNumber} — no image data`);
      continue;
    }

    try {
      const result = await extractMarkupsFromPage(pageImage, context);

      // Re-number IDs to be globally unique across all pages
      for (const markup of result.markups) {
        const oldId = markup.id;
        markup.id = `MK-${String(globalIdCounter).padStart(3, '0')}`;

        // Update any related_to references within this page
        for (const other of result.markups) {
          if (other.related_to === oldId) {
            other.related_to = markup.id;
          }
        }
        globalIdCounter++;
      }

      pages.push(result);
      allMarkups.push(...result.markups);

      if (onProgress) {
        onProgress(pageImage.pageNumber, pageImages.length, result);
      }

      // Small delay between pages to be nice to the API
      if (pageImages.indexOf(pageImage) < pageImages.length - 1) {
        await sleep(1000);
      }
    } catch (err) {
      console.error(`Error extracting page ${pageImage.pageNumber}:`, err.message);
      pages.push({
        page_number: pageImage.pageNumber,
        drawing_reference: 'Error',
        drawing_title: `Failed to process page ${pageImage.pageNumber}`,
        total_markups_found: 0,
        markups: [],
        error: err.message,
      });

      if (onProgress) {
        onProgress(pageImage.pageNumber, pageImages.length, { error: err.message });
      }
    }
  }

  // Compute stats
  const stats = {
    totalPages: pageImages.length,
    pagesProcessed: pages.filter(p => !p.error).length,
    pagesFailed: pages.filter(p => p.error).length,
    totalMarkups: allMarkups.length,
    byType: {},
    byConfidence: { high: 0, medium: 0, low: 0 },
    ambiguousCount: 0,
  };

  for (const markup of allMarkups) {
    stats.byType[markup.markup_type] = (stats.byType[markup.markup_type] || 0) + 1;
    stats.byConfidence[markup.confidence]++;
    if (markup.ambiguous) stats.ambiguousCount++;
  }

  return { pages, allMarkups, totalMarkups: allMarkups.length, stats };
}

// ─── Helpers ───────────────────────────────────────────────────

function buildUserMessage(pageNumber, context) {
  let msg = `Extract all redline markup annotations from this drawing image. This is page ${pageNumber}.`;

  if (context.projectName) {
    msg += ` The project is "${context.projectName}".`;
  }
  if (context.expectedSheets) {
    msg += ` Known sheet numbers in this set: ${context.expectedSheets}.`;
  }

  msg += '\n\nReturn ONLY the JSON object. No explanation, no markdown.';
  return msg;
}

function normalizeExtractionResult(result, pageNumber) {
  // Ensure required fields exist
  if (!result.markups) result.markups = [];
  if (!result.page_number) result.page_number = pageNumber;
  if (!result.drawing_reference) result.drawing_reference = 'Unknown';
  if (!result.drawing_title) result.drawing_title = '';
  if (!result.total_markups_found) result.total_markups_found = result.markups.length;

  // Validate each markup
  for (const markup of result.markups) {
    // Ensure markup_type is valid
    if (!Object.values(MARKUP_TYPES).includes(markup.markup_type)) {
      markup.markup_type = 'note'; // Fallback
    }
    // Ensure confidence is valid
    if (!Object.values(CONFIDENCE).includes(markup.confidence)) {
      markup.confidence = 'medium'; // Fallback
    }
    // Ensure boolean
    markup.ambiguous = Boolean(markup.ambiguous);
    // Ensure related_to is string or null
    if (markup.related_to === '' || markup.related_to === undefined) {
      markup.related_to = null;
    }
  }

  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
