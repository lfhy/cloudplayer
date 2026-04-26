# CloudPlayer Tauri

**Languages:** [简体中文](README.md) | **English** (current)

**Quick links:** [Overview](#sec-overview) · [Key features](#sec-features) · [Preview](#sec-preview) · [Environment and dependencies](#sec-deps) · [Development and build](#sec-build) · [Local release](#sec-release-local) · [GitHub Release](#sec-github-release) · [Release checklist](#sec-checklist) · [Acknowledgments](#sec-ack)

> **Downloads:** Pre-built installers are published on **GitHub Releases**. Open the repository on GitHub and use the **Releases** entry in the header (or the releases link on the repo home page) to download assets for each version.

<a id="sec-overview"></a>

CloudPlayer is a desktop music application built with Tauri, Rust, and Vite. It focuses on music discovery and preview, multi-source lyric retrieval, local library management, download queue handling, and playlist import workflows for desktop use.

<a id="sec-features"></a>

## Key features

- **Desktop application architecture:** Built on Tauri 2 with the system WebView, balancing a desktop-native workflow with a relatively small footprint and fast startup.
- **Search and playback:** Supports global search, online preview, and local playback.
- **Multi-source lyric pipeline:** Falls back in the order **QQ Music → Kugou → Netease → LRCLIB**, preferring word-level lyrics whenever available; QQ QRC is supported through custom 3DES decryption and parsing.
- **Optional Netease API integration:** Supports a self-hosted Netease API base URL and prefers `lyric/new` for YRC word-level lyrics.
- **Local data management:** Uses SQLite for the local library, playlists, and recent play history.
- **Download task queue:** Supports background audio download workflows.
- **Share link import:** Imports playlist content from Netease Music and QQ Music share links.
- **Tray and desktop lyrics:** Provides a system tray integration together with a desktop lyric window and synchronized style settings.
- **Captcha assistance module:** Includes helper logic for slider-style verification flows; see the `captcha_slider` module for details.

<a id="sec-preview"></a>

## Preview

<p align="center">
  <img src="docs/preview.png" alt="CloudPlayer screenshot" width="720" />
</p>

---

<a id="sec-deps"></a>

## Environment and dependencies

### Frontend dependencies

- `vite`
- `@tauri-apps/cli`
- `@tauri-apps/api`
- `@tauri-apps/plugin-dialog`

### Backend dependencies

Key dependencies defined in `src-tauri/Cargo.toml` include:

- `tauri`, `tauri-build`, `tauri-plugin-dialog`
- `tokio`, `reqwest`, `rusqlite`, `serde`, `serde_json`
- `walkdir`, `regex`, `url`, `image`, `imageproc`, `rand`, `chrono`

### Dependency check commands

```bash
npm install
npm outdated
cargo check --manifest-path src-tauri/Cargo.toml
```

---

<a id="sec-build"></a>

## Development and build

### Requirements

- Node.js 18 or later, preferably an LTS release
- npm
- Rust stable toolchain
- On Windows, the required Tauri prerequisites should be installed in advance, including WebView2 and MSVC Build Tools

It is recommended to verify the local toolchain versions first:

```bash
node -v
npm -v
rustc -V
cargo -V
```

### Development mode

```bash
npm run dev
npm run tauri dev
```

### Frontend production build

```bash
npm run build
```

The frontend build output is written to `dist/` and referenced by Tauri through `frontendDist: ../dist`.

---

<a id="sec-release-local"></a>

## Local release

The current packaging configuration in `src-tauri/tauri.conf.json` is:

```json
"bundle": {
  "active": true,
  "targets": "nsis"
}
```

This means packaging is currently enabled and the default installer target is `nsis`.

To build a local release:

1. Ensure frontend dependencies and the Rust toolchain are installed.
2. Run:

```bash
npm run tauri build
```

Artifacts are typically generated in:

- `src-tauri/target/release/`
- `src-tauri/target/release/bundle/`

---

<a id="sec-github-release"></a>

## GitHub Release

The following process can be used to publish installer binaries to a GitHub Release page.

### 1. Version preparation

Before creating a release, keep the following version fields in sync:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

The recommended tag format is `v0.1.0`.

### 2. Build release artifacts

```bash
npm run tauri build
```

After the build completes, collect release artifacts from `src-tauri/target/release/bundle/`, such as `.msi` and `.exe` installer files.

### 3A. Create a Release in the GitHub web UI

1. Push commits and the release tag:

```bash
git add .
git commit -m "release: v0.1.0"
git tag v0.1.0
git push origin master --tags
```

2. Open the repository and go to **Releases**.
3. Select **Draft a new release**.
4. Choose the tag `v0.1.0`.
5. Upload the installer files from `src-tauri/target/release/bundle/`.
6. Publish the Release.

### 3B. Create a Release with GitHub CLI

```bash
gh release create v0.1.0 ^
  "src-tauri/target/release/bundle/**" ^
  --title "v0.1.0" ^
  --notes "CloudPlayer v0.1.0 release"
```

If wildcard upload is not supported by the current shell, pass explicit file paths instead.

---

<a id="sec-checklist"></a>

## Release checklist

- `npm install` has been executed
- `cargo check` passes
- `bundle.active = true`
- Version numbers are synchronized
- `npm run tauri build` artifacts have been verified
- The Git tag has been created and pushed
- The GitHub Release has been published with installer assets

---

<a id="sec-ack"></a>

## Acknowledgments

Support for QQ Music QRC, including custom Triple-DES decryption and QRC body parsing, draws on the following open-source projects:

- **[LDDC](https://github.com/chenmozhijin/LDDC)** (Lyric Downloader): for the non-standard 3DES implementation in `tripledes.py` and related parsing ideas.
- **[QQMusicDecoder](https://github.com/WXRIW/QQMusicDecoder)**: the upstream C# implementation referenced by LDDC, including files such as `DESHelper.cs` and `Decrypter.cs`.

If you maintain, redistribute, or build upon this project, please comply with the licenses of the upstream projects, including the GPL-3.0 license used by LDDC.
