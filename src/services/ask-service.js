/**
 * Ask Service — retrieval-augmented Q&A over a project's extracted markups.
 *
 * Two-stage RAG (ADR 0004):
 *   1. Retrieve: SQLite FTS5 (BM25) over the markup_fts index — deterministic,
 *      zero extra dependencies. Per-project corpora are small and heavy on
 *      exact tokens (sheet refs, dimensions), where keyword ranking holds up.
 *   2. Synthesize: one text-only Claude call grounded strictly in the
 *      retrieved markups, citing markup IDs.
 *
 * The sample project lives in JSON rather than SQLite, so it gets an
 * in-memory token-overlap ranker feeding the same synthesis path.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import db from './db.js';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

// Enough context to answer multi-markup questions without stuffing the whole
// checklist into the prompt on large projects.
const TOP_K = 12;

const searchStmt = db.prepare(`
  SELECT item_id, markup_text, location, markup_type, drawing_reference, page_number
  FROM markup_fts
  WHERE project_id = ? AND markup_fts MATCH ?
  ORDER BY bm25(markup_fts)
  LIMIT ?
`);

/**
 * Turn a free-text question into a safe FTS5 MATCH expression.
 * Only quoted word tokens survive, OR-ed together — user input can never
 * inject FTS5 query syntax (NEAR, column filters, unbalanced quotes).
 * Returns null when the question has no indexable tokens.
 */
export function toFtsQuery(question) {
  const tokens = question.match(/[A-Za-z0-9]+/g);
  if (!tokens || tokens.length === 0) return null;
  const unique = [...new Set(tokens.map(token => token.toLowerCase()))];
  return unique.map(token => `"${token}"`).join(' OR ');
}

/**
 * Retrieve the markups most relevant to a question via FTS5, BM25-ranked.
 *
 * @returns {Array<Object>} normalized source objects (possibly empty)
 */
export function retrieveMarkups(projectId, question) {
  const ftsQuery = toFtsQuery(question);
  if (!ftsQuery) return [];

  return searchStmt.all(projectId, ftsQuery, TOP_K).map(row => ({
    id: row.item_id,
    markup_text: row.markup_text,
    markup_type: row.markup_type,
    drawing_reference: row.drawing_reference,
    location_on_drawing: row.location,
    page_number: row.page_number,
  }));
}

/**
 * In-memory fallback ranker for checklist items that aren't in SQLite
 * (the pre-extracted sample project). Scores by question-token overlap
 * against the markup's searchable text — same fields FTS5 indexes.
 *
 * @param {Array<Object>} items - ChecklistItem[] (each wraps a .markup)
 */
export function rankItemsByOverlap(items, question) {
  const questionTokens = new Set(
    (question.match(/[A-Za-z0-9]+/g) || []).map(token => token.toLowerCase())
  );
  if (questionTokens.size === 0) return [];

  return items
    .map(item => {
      const haystack = [
        item.markup.markup_text,
        item.markup.location_on_drawing,
        item.markup.markup_type,
        item.markup.drawing_reference,
      ].join(' ').toLowerCase();
      const itemTokens = new Set(haystack.match(/[a-z0-9]+/g) || []);
      let score = 0;
      for (const token of questionTokens) {
        if (itemTokens.has(token)) score++;
      }
      return { item, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map(({ item }) => ({
      id: item.id,
      markup_text: item.markup.markup_text,
      markup_type: item.markup.markup_type,
      drawing_reference: item.markup.drawing_reference,
      location_on_drawing: item.markup.location_on_drawing,
      page_number: item.markup.page_number ?? null,
    }));
}

const SYNTHESIS_SYSTEM_PROMPT = `You answer a drafter's questions about the redline markups extracted from a construction plan set.

Rules:
- Answer ONLY from the markups provided in the user message. Never use outside knowledge of construction practice to add requirements that are not in the markups.
- Cite the markup IDs you drew from in square brackets, e.g. [MK-003], immediately after each claim they support.
- If the provided markups do not answer the question, say so plainly instead of guessing.
- Be concise and specific — sheet references, locations, and dimensions matter to a drafter.`;

/**
 * Answer a question grounded in the retrieved markups.
 *
 * @param {string} question
 * @param {Array<Object>} sources - output of retrieveMarkups/rankItemsByOverlap
 * @returns {Promise<string>} the answer text
 */
export async function answerFromMarkups(question, sources) {
  const contextLines = sources.map(source => {
    const page = source.page_number ? ` (page ${source.page_number})` : '';
    return `[${source.id}] sheet ${source.drawing_reference}${page}, ${source.markup_type}, ${source.location_on_drawing}: ${source.markup_text}`;
  });

  const userMessage = `Markups retrieved for this question:\n\n${contextLines.join('\n')}\n\nQuestion: ${question}`;

  try {
    // temperature pinned per ADR 0003 — never rely on the API default
    const response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 1024,
      temperature: 0,
      system: SYNTHESIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent) {
      throw new Error('No text response from Claude');
    }
    return textContent.text;
  } catch (err) {
    throw new Error(`Markup Q&A synthesis failed: ${err.message}`);
  }
}
