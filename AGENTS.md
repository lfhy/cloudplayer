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

## Build Outputs

- Do not write compiled binaries or build artifacts to the `src-wails` repository root.
- Route local Go and Wails build outputs to `bin/` or tool-managed build directories instead.
- For ad-hoc Go smoke validation from the repository root, do not run bare `go build .`.
- Use `go build -o codex-smoke-test .` instead, and remove `codex-smoke-test` after validation if it was created.
- Do not add ignore rules that broadly match source package directory names such as `cloudplayer`.
- If a root-level build artifact must be ignored, use an anchored path rule that cannot match source directories.

## Git Workflow

- After completing the requested implementation and validation successfully, create a normal non-amended commit unless the user explicitly says not to commit.
- When the user explicitly asks for a commit, stage the relevant changes and create a normal non-amended commit.
- Do not include root-level compiled binaries or other transient build artifacts in commits.

## Validation

- After each meaningful refactor batch, run the narrowest useful validation first.
- Before finishing, run the full `src-wails` regression path:
  bindings generation, frontend build, Go build, and `wails3 dev` smoke validation.
