#!/usr/bin/env bash
set -euo pipefail

# Build portable desktop release archives for the current host platform and
# stage the Go bridge next to the packaged executable before zipping.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="${APP_NAME:-CloudPlayer}"
ARTIFACT_PREFIX="${ARTIFACT_PREFIX:-cloudplayer}"
PLATFORM=""
VERSION=""
BUILD_NUMBER="1"
OUTPUT_DIR="$ROOT_DIR/dist/release"

usage() {
  cat <<'EOF'
Usage: ./scripts/build_desktop_packages.sh --platform <windows|macos> --version <x.y.z> [options]

Options:
  --platform <name>        Build the current host's windows or macos package
  --version <x.y.z>        Release version passed to flutter build
  --build-number <num>     Build number passed to flutter build
  --output-dir <path>      Output directory for archives
  -h, --help               Show this help
EOF
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"
}

to_windows_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
    return
  fi
  printf '%s' "$1"
}

build_windows() {
  require_cmd flutter
  require_cmd go
  require_cmd powershell.exe
  mkdir -p "$ROOT_DIR/bin/bridge" "$OUTPUT_DIR"
  (
    cd "$ROOT_DIR"
    go build -buildmode=c-shared -o bin/bridge/cloudplayer_bridge.dll ./bridge
    flutter build windows --release \
      --build-name "$VERSION" \
      --build-number "$BUILD_NUMBER"
  )
  local release_dir="$ROOT_DIR/build/windows/x64/runner/Release"
  local bridge_dll="$ROOT_DIR/bin/bridge/cloudplayer_bridge.dll"
  local archive_path="$OUTPUT_DIR/$ARTIFACT_PREFIX-windows-x64.zip"
  [[ -d "$release_dir" ]] || fail "Windows release directory not found: $release_dir"
  [[ -f "$bridge_dll" ]] || fail "Windows bridge was not built: $bridge_dll"
  cp "$bridge_dll" "$release_dir/cloudplayer_bridge.dll"
  local release_dir_win archive_path_win
  release_dir_win="$(to_windows_path "$release_dir")"
  archive_path_win="$(to_windows_path "$archive_path")"
  powershell.exe -NoProfile -Command \
    "if (Test-Path '$archive_path_win') { Remove-Item '$archive_path_win' -Force }; Compress-Archive -Path '$release_dir_win\\*' -DestinationPath '$archive_path_win' -Force" >/dev/null
  [[ -f "$archive_path" ]] || fail "Windows archive was not created: $archive_path"
}

build_macos() {
  require_cmd flutter
  require_cmd go
  require_cmd ditto
  mkdir -p "$ROOT_DIR/bin/bridge" "$OUTPUT_DIR"
  (
    cd "$ROOT_DIR"
    MACOSX_DEPLOYMENT_TARGET="${MACOSX_DEPLOYMENT_TARGET:-11.0}" \
      go build -buildmode=c-shared -o bin/bridge/libcloudplayer_bridge.dylib ./bridge
    flutter build macos --release \
      --build-name "$VERSION" \
      --build-number "$BUILD_NUMBER"
  )
  local app_bundle="$ROOT_DIR/build/macos/Build/Products/Release/$APP_NAME.app"
  local bridge_dylib="$ROOT_DIR/bin/bridge/libcloudplayer_bridge.dylib"
  local archive_name="$ARTIFACT_PREFIX-darwin-$(uname -m).zip"
  local archive_path="$OUTPUT_DIR/$archive_name"
  [[ -d "$app_bundle" ]] || fail "macOS app bundle not found: $app_bundle"
  [[ -f "$bridge_dylib" ]] || fail "macOS bridge was not built: $bridge_dylib"
  cp "$bridge_dylib" "$app_bundle/Contents/MacOS/libcloudplayer_bridge.dylib"
  rm -f "$archive_path"
  (
    cd "$(dirname "$app_bundle")"
    ditto -c -k --sequesterRsrc --keepParent "$(basename "$app_bundle")" "$archive_name"
    mv "$archive_name" "$archive_path"
  )
  [[ -f "$archive_path" ]] || fail "macOS archive was not created: $archive_path"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      PLATFORM="${2:-}"
      shift 2
      ;;
    --version)
      VERSION="${2:-}"
      shift 2
      ;;
    --build-number)
      BUILD_NUMBER="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

[[ -n "$PLATFORM" ]] || fail "--platform is required"
[[ -n "$VERSION" ]] || fail "--version is required"

case "$PLATFORM" in
  windows)
    build_windows
    ;;
  macos)
    build_macos
    ;;
  *)
    fail "Unsupported platform: $PLATFORM"
    ;;
esac
