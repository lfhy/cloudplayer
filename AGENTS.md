# Repository Guidelines

## `src-wails` Structure Rules

- All hand-written code files under `src-wails` must stay under 300 lines.
- If a file approaches the limit, split it by feature or responsibility before adding more logic.
- Generated files are excluded from this rule:
  `frontend/bindings`, `frontend/dist`, `frontend/node_modules`.
- Every hand-written code file under `src-wails` must include at least one meaningful comment.
- Prefer file-level comments that explain the file responsibility, plus short section comments where logic is non-obvious.

## Frontend Organization

- Organize frontend code by type first, then by feature:
  `src/pages`, `src/components`, `src/services`, `src/state`, `src/utils`, `src/windows`, `src/styles`.
- Keep entry files thin. They should wire modules together, not hold page logic inline.
- Large HTML structures should be moved into JS template modules or smaller window/page entry files.
- Large CSS should be split by page or component responsibility.

## Backend Organization

- Split Go files by responsibility within a package, for example:
  `download_enqueue.go`, `download_helpers.go`, `service_playlists.go`.
- Keep service methods grouped by feature instead of one large service file.
- Shared parsing, normalization, and transport helpers should live in dedicated helper files.

## Validation

- After each meaningful refactor batch, run the narrowest useful validation first.
- Before finishing, run the full `src-wails` regression path:
  bindings generation, frontend build, Go build, and `wails3 dev` smoke validation.
