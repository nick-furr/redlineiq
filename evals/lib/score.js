/**
 * Scoring functions.
 *
 * recall     = matched / total_expected
 *              What fraction of expected markups did the extractor find?
 *
 * precision  = matched / total_extracted
 *              Approximate: of everything the extractor returned, how much
 *              was real? (Low precision → hallucinations or noise.)
 *
 * specificity = avg(specificity_target) across matched items only
 *               specificity_target: 0 = ambiguous, 1 = judgment needed, 2 = clear
 *               Higher means the extractor is capturing harder, more specific marks.
 */

/**
 * @param {Object[]} matchResults - [{matched, specificity_target, ...}]
 * @param {number} totalExtracted - total markups the extractor returned
 * @returns {{ recall, precision, specificity, matched, total_expected, total_extracted }}
 */
export function scoreCase(matchResults, totalExtracted) {
  const matched = matchResults.filter(r => r.matched).length;
  const totalExpected = matchResults.length;

  const recall = totalExpected > 0 ? matched / totalExpected : 0;
  const precision = totalExtracted > 0 ? matched / totalExtracted : 0;

  const matchedItems = matchResults.filter(r => r.matched);
  const specificity = matchedItems.length > 0
    ? matchedItems.reduce((sum, r) => sum + r.specificity_target, 0) / matchedItems.length
    : 0;

  return {
    recall: r3(recall),
    precision: r3(precision),
    specificity: r3(specificity),
    matched,
    total_expected: totalExpected,
    total_extracted: totalExtracted,
  };
}

function r3(n) {
  return Math.round(n * 1000) / 1000;
}
