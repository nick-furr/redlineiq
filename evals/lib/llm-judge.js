/**
 * LLM-as-judge: determines whether an expected markup concept is captured
 * anywhere in the extracted output. Uses 3x majority vote to reduce variance.
 */
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const JUDGE_MODEL = 'claude-haiku-4-5-20251001';

/**
 * @param {string} expectedConcept - Human-readable description of the expected markup
 * @param {Object[]} extractedMarkups - Array of markups from extractMarkupsFromPage
 * @returns {Promise<boolean>} true if concept is captured in the extraction
 */
export async function judgeMarkup(expectedConcept, extractedMarkups) {
  const votes = await Promise.all([
    singleVote(expectedConcept, extractedMarkups),
    singleVote(expectedConcept, extractedMarkups),
    singleVote(expectedConcept, extractedMarkups),
  ]);
  return votes.filter(Boolean).length >= 2;
}

async function singleVote(expectedConcept, extractedMarkups) {
  const summary = extractedMarkups
    .map(m => `- [${m.markup_type}] "${m.markup_text}" at: ${m.location_on_drawing}`)
    .join('\n');

  const response = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 5,
    messages: [{
      role: 'user',
      content: `Does the extraction capture the expected concept?

Expected: ${expectedConcept}

Extracted markups:
${summary || '(none)'}

Answer only "yes" or "no".`,
    }],
  });

  return response.content[0].text.trim().toLowerCase().startsWith('yes');
}
