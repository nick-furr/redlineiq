# intake/ — quarantine for real firm files

Landing zone for anything a design partner or pilot firm sends: marked-up sets, samples,
exports. Everything in this directory except this README is gitignored.

Rules (binding, see CLAUDE.md):

- Files here never reach git, the demo server, or a LinkedIn post without written
  permission from the firm that sent them.
- Cleared for eval use means the file moves into the `case_C*` / `case_hC*` convention
  (local-only by gitignore, see `evals/CONVENTIONS.md`), not into the committed case set.
- Shared with permission for testing is not permission to republish.
