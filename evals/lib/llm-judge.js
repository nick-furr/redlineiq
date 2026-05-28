/**
 * LLM-as-judge: determines whether an expected markup concept is captured
 * anywhere in the extracted output. Single call at temperature=0 for
 * determinism (prior 3x majority-vote pattern existed to mitigate API
 * default temperature=1.0 variance; redundant once temperature is pinned).
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
  return singleVote(expectedConcept, extractedMarkups);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function singleVote(expectedConcept, extractedMarkups, retries = 4) {
  const summary = extractedMarkups
    .map(m => `- [${m.markup_type}] "${m.markup_text}" at: ${m.location_on_drawing}`)
    .join('\n');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
          const response = await client.messages.create({
        model: JUDGE_MODEL,
        max_tokens: 5,
        temperature: 0,
        system: `You are evaluating whether a redline markup extraction captured a specific reviewer concept.
Reviewers use engineering shorthand, abbreviations, and OCR may mangle text. Judge by CONCEPTUAL equivalence, not literal text.
Examples of matches: "DR/SWING BLOCKS EGRESS" = "door swing blocks egress width", "8\" SAN UNDERSIZED" = "8 inch sanitary sewer undersized", "ADD SIGHT TRIANGLE DIMS" = "add sight triangle dimensions".
Answer "yes" if the concept is substantially present in any entry. Answer "no" only if genuinely absent.`,
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
    } catch (err) {
      if (err.status === 429 && attempt < retries) {
        const wait = Math.pow(2, attempt + 1) * 1000;
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}
