# Repository Guidelines

## `src-wails` Structure Rules

- All hand-written code files under `src-wails` must stay under 500 lines.
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

## Child Window UI

- Standalone child windows should follow the compact native-dialog style used by the close-confirm window.
- User-facing frontend failure notifications should prefer the shared `message-dialog` child window instead of browser `alert()`; reuse `showMessageDialog(...)` / `alertRequestFailed(...)` so failure reasons stay consistent.
- Collection-mode terminology should stay consistent across frontend and backend:
  `offline` = 本地歌单 / 本地我喜欢，
  `online` = 直接使用酷狗云端歌单 / 云端我喜欢，
  `hybrid` = 云歌单 fork 到本地并尽量回写云端，失败时保留本地。
- Keep child windows simple: no decorative app icon, no extra explanatory copy unless the flow truly needs it.
- Titles should be visually centered, while leaving safe space for macOS traffic lights and Windows title-bar controls.
- Child window content should be horizontally centered inside the native window, rather than stretched to fill the viewport.
- Reserve a platform-safe top inset for title-bar controls: macOS needs extra space for traffic lights, Windows needs space for the right-side close controls.
- Avoid nested white modal shells inside child windows. Prefer one transparent or near-transparent content surface and let the actual content define the visual weight.
- Child windows should auto-size from rendered content with `ResizeObserver`-style measurement instead of relying only on guessed fixed heights.
- Child-window root/layout should prefer content-driven sizing such as `max-content` / intrinsic height, not `100vh` filler cards, unless the window truly needs a full-height layout.
- Layout child windows in three clear zones: title at top, primary actions in the middle area, secondary controls at the bottom.
- Secondary controls such as `取消` or `记住这次选择` should stay pinned to the bottom edge of the content area.
- Primary actions should use compact button sizing consistent with the main app, not large card-like blocks.

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

## Windows Encoding

- On Windows, treat PowerShell console output and ad-hoc shell edits as potentially encoding-sensitive, especially for UTF-8 files containing Chinese text.
- When updating text-heavy or encoding-sensitive files such as `README.md`, `CHANGELOG.md`, `AGENTS.md`, or localized frontend copy, prefer a small Node script that reads and writes explicit `utf8` text over shell one-liners.

## Git Workflow

- After completing the requested implementation and validation successfully, create a normal non-amended commit unless the user explicitly says not to commit.
- When the user explicitly asks for a commit, stage the relevant changes and create a normal non-amended commit.
- Do not include root-level compiled binaries or other transient build artifacts in commits.
- Every time a new feature is added, update `README.md` in the same change set before committing.
- Maintain release note drafts in `CHANGELOG.md` under `## Unreleased` as work lands when the change is relevant to an upcoming release.
- When preparing or updating a release workflow, prefer `CHANGELOG.md` as the source of truth for release notes instead of reconstructing everything from commit history.
- After a tagged release is prepared, archive `CHANGELOG.md` `## Unreleased` into a versioned section with `scripts/archive_unreleased_changelog.sh`.
- If `apply_patch` becomes unreliable on encoding-sensitive files such as `README.md` or `CHANGELOG.md`, prefer a small Node script that reads and writes explicit `utf8` text over ad-hoc shell editing.

## Validation

- After each meaningful refactor batch, run the narrowest useful validation first.
- Before finishing, run the full `src-wails` regression path through `wails3 dev` smoke validation.
- Treat `wails3 dev` as the final integrated build-and-run check for `src-wails`.
  Do not separately repeat bindings generation, frontend build, and Go build beforehand unless the task specifically needs those narrower commands for diagnosis.
- The final validation MUST use `wails3 dev` to confirm the app launches and renders correctly.
  `npm run build` alone is not sufficient.
