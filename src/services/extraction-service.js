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

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import { MARKUP_TYPES, CONFIDENCE } from '../models/markup.js';
import langfuse from './langfuse.js';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

// ─── The Extraction Prompt ─────────────────────────────────────
// Loaded from prompts/active.md at module import. Version + history
// live alongside the prompt file. See prompts/CHANGELOG.md.

// Defaults to prompts/active.md. Override at invocation with REDLINEIQ_PROMPT_FILE=prompts/v0.6.md
// so the eval harness can A/B compare versions without swapping active.md.
const PROMPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../',
  process.env.REDLINEIQ_PROMPT_FILE || 'prompts/active.md'
);

function loadPrompt() {
  const raw = readFileSync(PROMPT_PATH, 'utf-8');
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
  return body.replace(/\{\{MARKUP_TYPES\}\}/g, Object.values(MARKUP_TYPES).join(', '));
}

const SYSTEM_PROMPT = loadPrompt();

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

  const generation = context.langfuseTrace?.generation({
    name: `extract-page-${pageNumber}`,
    model: config.anthropic.model,
    modelParameters: { max_tokens: 8192, temperature: 0 },
    input: { system: SYSTEM_PROMPT, user: userMessage },
  });

  try {
    const response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 8192,
      temperature: 0,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
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
    const normalized = normalizeExtractionResult(result, pageNumber);

    const u = response.usage;
    const cacheRead = u.cache_read_input_tokens ?? 0;
    const cacheWrite = u.cache_creation_input_tokens ?? 0;
    if (cacheRead || cacheWrite) {
      console.log(
        `  cache: read=${cacheRead} write=${cacheWrite} fresh_input=${u.input_tokens} output=${u.output_tokens}`
      );
    }

    generation?.end({
      output: rawText,
      usage: {
        input: u.input_tokens,
        output: u.output_tokens,
        cache_read: cacheRead,
        cache_write: cacheWrite,
      },
      metadata: {
        markups_found: normalized.markups.length,
        drawing_reference: normalized.drawing_reference,
      },
    });

    return normalized;
  } catch (err) {
    generation?.end({ level: 'ERROR', statusMessage: err.message });

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

  const trace = langfuse.trace({
    name: 'pdf-extraction',
    metadata: {
      projectName: context.projectName,
      totalPages: pageImages.length,
    },
  });

  for (const pageImage of pageImages) {
    if (!pageImage.base64) {
      console.warn(`Skipping page ${pageImage.pageNumber} — no image data`);
      continue;
    }

    try {
      const result = await extractMarkupsFromPage(pageImage, { ...context, langfuseTrace: trace });

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

  trace.update({ output: { totalMarkups: allMarkups.length, stats } });
  await langfuse.flushAsync();

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
  if (context.tileInfo) {
    const { gridRow, gridCol, gridRows, gridCols } = context.tileInfo;
    msg += ` This image is tile (row ${gridRow + 1}, col ${gridCol + 1}) of a ${gridRows}x${gridCols} grid covering this page; other tiles cover the rest of the sheet and are extracted separately. Only report markups visible in this tile. Tiles overlap by ~10% at each edge, so markups near tile boundaries may also appear in neighbor tiles — that's expected and will be deduped downstream.`;
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
