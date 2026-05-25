# Repository Guidelines

## `lib` And `go` Structure Rules

- All hand-written code files under `lib`, `go`, and `macos/Runner` must stay under 500 lines.
- If a file approaches the limit, split it by feature or responsibility before adding more logic.
- Generated files are excluded from this rule:
  `.dart_tool`, `build`, `macos/Flutter/ephemeral`, `linux/flutter/ephemeral`, `windows/flutter/ephemeral`.
- Every hand-written code file under `lib`, `go`, and `macos/Runner` must include at least one meaningful comment.
- Prefer file-level comments that explain the file responsibility, plus short section comments where logic is non-obvious.

## Flutter Frontend Organization

- Organize Flutter code by type first, then by feature:
  `lib/pages`, `lib/widgets`, `lib/services`, `lib/state`, `lib/utils`, `lib/windows`, `lib/theme`.
- Keep entry files thin. They should wire modules together, not hold page logic inline.
- Large widget trees should be moved into page/widget modules instead of one oversized `build()` method.
- Large visual themes should be split by page or component responsibility.
- Match legacy Wails copy and layout exactly unless the task explicitly asks for copy or layout changes.

## Child Window UI

- Standalone child windows should follow the compact native-dialog style used by the previous close-confirm window.
- User-facing frontend failure notifications should prefer a shared message-dialog flow instead of ad-hoc alerts so failure reasons stay consistent.
- Collection-mode terminology should stay consistent across frontend and backend:
  `offline` = 本地歌单 / 本地我喜欢，
  `online` = 直接使用酷狗云端歌单 / 云端我喜欢，
  `hybrid` = 云歌单 fork 到本地并尽量回写云端，失败时保留本地。
- Keep child windows simple: no decorative app icon, no extra explanatory copy unless the flow truly needs it.
- Titles should be visually centered, while leaving safe space for macOS traffic lights and Windows title-bar controls.
- Child window content should be horizontally centered inside the native window, rather than stretched to fill the viewport.
- Reserve a platform-safe top inset for title-bar controls: macOS needs extra space for traffic lights, Windows needs space for the right-side close controls.
- Avoid nested white modal shells inside child windows. Prefer one transparent or near-transparent content surface and let the actual content define the visual weight.
- Layout child windows in three clear zones: title at top, primary actions in the middle area, secondary controls at the bottom.
- Secondary controls such as `取消` or `记住这次选择` should stay pinned to the bottom edge of the content area.
- Primary actions should use compact button sizing consistent with the main app, not large card-like blocks.

## Go Bridge Organization

- Split Go files by responsibility within a package, for example:
  `download_enqueue.go`, `service_playlists.go`, `bridge_settings.go`.
- Keep bridge exports grouped by feature instead of one large bridge file.
- Shared parsing, normalization, and transport helpers should live in dedicated helper files.
- Prefer a narrow C ABI plus JSON payloads for Flutter FFI when it avoids duplicating backend structs in Dart.

## Build Outputs

- Do not write compiled binaries or build artifacts to the repository root.
- Route local Go and Flutter build outputs to `bin/`, `build/`, or tool-managed build directories.
- For ad-hoc Go smoke validation from the repository root, do not run bare `go build .`.
- Use `go build -o bin/...` for manual bridge smoke tests, and remove temporary one-off outputs if they were created.
- Do not add ignore rules that broadly match source package directory names such as `cloudplayer`.
- If a root-level build artifact must be ignored, use an anchored path rule that cannot match source directories.

## Git Workflow

- After completing the requested implementation and validation successfully, create a normal non-amended commit unless the user explicitly says not to commit.
- When the user explicitly asks for a commit, stage the relevant changes and create a normal non-amended commit.
- Do not include compiled binaries or other transient build artifacts in commits.
- Every time a new feature is added, update `README.md` in the same change set before committing.
- Maintain release note drafts in `CHANGELOG.md` under `## Unreleased` as work lands when the change is relevant to an upcoming release.

## Validation

- After each meaningful refactor batch, run the narrowest useful validation first.
- For macOS launch and integrated smoke validation, prefer repository scripts over ad-hoc commands.
- Use `make run` as the default macOS app launch path because it rebuilds the Go bridge before invoking Flutter.
- Do not bypass the scripted startup path with bare `flutter run -d macos` unless the task explicitly requires isolating Flutter-only startup behavior.
- Before finishing, run the full macOS regression path through `flutter run -d macos` smoke validation.
- Treat `flutter run -d macos` as the final integrated build-and-run check for this repository.
- The final validation must confirm the app launches and renders correctly on macOS.
  `flutter analyze` or `flutter build macos` alone is not sufficient.
