export const SAMPLE_ID = 'sample-demo-001';

export function isSampleProject(id) {
  return id === SAMPLE_ID;
}

/**
 * Express middleware — rejects write requests targeting the sample project.
 * Apply as the first argument on any route that mutates project state.
 */
export function rejectSampleWrite(req, res, next) {
  if (isSampleProject(req.params.id)) {
    return res.status(400).json({ error: 'The sample project is read-only.' });
  }
  next();
}
