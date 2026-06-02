/**
 * Aggregate eval rows by source-type regime + compute router accuracy.
 * Keeps recall/precision definitions identical to the overall harness — this
 * only adds a breakdown dimension so digital and raster numbers don't blend.
 *
 * Expected route per regime (Phase 1): digital_annotation → parse, else → vision.
 */
const expectedRoute = (sourceType) => (sourceType === 'digital_annotation' ? 'parse' : 'vision');

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function summarizeByRegime(rows) {
  const byRegime = {};
  for (const r of rows) {
    const k = r.expected_source || 'raster';
    (byRegime[k] ||= []).push(r);
  }
  const reduce = (rs) => ({
    count: rs.length,
    recall: avg(rs.map(r => r.scores.recall)),
    precision: avg(rs.map(r => r.scores.precision)),
  });
  const out = { byRegime: {}, overall: reduce(rows) };
  for (const [k, rs] of Object.entries(byRegime)) out.byRegime[k] = reduce(rs);

  const correct = rows.filter(r => r.routed === expectedRoute(r.expected_source || 'raster')).length;
  out.routerAccuracy = rows.length ? correct / rows.length : 0;
  return out;
}
