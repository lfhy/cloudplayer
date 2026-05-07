#!/usr/bin/env bash
set -euo pipefail

# This script orchestrates the existing Wails tasks into a repeatable desktop release flow.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="${APP_NAME:-CloudPlayer}"
RELEASE_DIR="${RELEASE_DIR:-$ROOT_DIR/bin/releases}"
TARGETS_CSV="${TARGETS:-windows/amd64,windows/arm64,macos/amd64,macos/arm64}"
WINDOWS_FORMAT="${WINDOWS_FORMAT:-nsis}"
INCLUDE_MACOS_UNIVERSAL="${INCLUDE_MACOS_UNIVERSAL:-false}"
USE_WINDOWS_CGO="${USE_WINDOWS_CGO:-0}"
INCLUDE_WINDOWS_DUAL="${INCLUDE_WINDOWS_DUAL:-true}"
DRY_RUN=false
SKIP_CLEAN=false

usage() {
  cat <<'EOF'
Usage: ./scripts/build_desktop_packages.sh [options]

Options:
  --targets <csv>              Comma-separated targets:
                               windows/amd64,windows/arm64,macos/amd64,macos/arm64
  --windows-format <format>    Windows package format: nsis or msix
  --release-dir <path>         Output directory, default: bin/releases
  --include-macos-universal    Also build a universal macOS package
  --skip-windows-dual          Skip the combined Windows dual-arch installer
  --use-windows-cgo            Enable CGO for Windows builds
  --skip-clean                 Keep existing release directory contents
  --dry-run                    Print commands without executing
  -h, --help                   Show this help
EOF
}

log() {
  printf '==> %s\n' "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

run_task() {
  local task_name="$1"
  shift
  local command=(wails3 task "$task_name" "$@")
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '+'
    printf ' %q' "${command[@]}"
    printf '\n'
    return
  fi
  (cd "$ROOT_DIR" && "${command[@]}")
}

archive_macos_bundle() {
  local bundle_path="$1"
  local archive_path="$2"
  local parent_dir
  local bundle_name
  local archive_name
  parent_dir="$(dirname "$bundle_path")"
  bundle_name="$(basename "$bundle_path")"
  archive_name="$(basename "$archive_path")"
  rm -f "$archive_path"
  if command -v ditto >/dev/null 2>&1; then
    (cd "$parent_dir" && ditto -c -k --sequesterRsrc --keepParent "$bundle_name" "$archive_name")
    return
  fi
  command -v zip >/dev/null 2>&1 || fail "zip or ditto is required to archive macOS bundles"
  (cd "$parent_dir" && zip -qry "$archive_name" "$bundle_name")
}

ensure_prerequisites() {
  command -v wails3 >/dev/null 2>&1 || fail "wails3 is required"
  [[ "$DRY_RUN" == "true" ]] && return
  for target in "${TARGETS[@]}"; do
    case "$target" in
      windows/*)
        if [[ "$WINDOWS_FORMAT" == "nsis" ]] && ! command -v makensis >/dev/null 2>&1; then
          fail "NSIS packaging requires makensis; install NSIS or use --windows-format msix"
        fi
        ;;
      macos/*)
        if [[ "$(uname -s)" != "Darwin" ]] && ! command -v docker >/dev/null 2>&1; then
          fail "Cross-building macOS packages on non-macOS hosts requires Docker"
        fi
        ;;
    esac
  done
}

parse_targets() {
  local item
  IFS=',' read -r -a raw_targets <<< "$TARGETS_CSV"
  TARGETS=()
  for item in "${raw_targets[@]}"; do
    item="${item//[[:space:]]/}"
    [[ -n "$item" ]] || continue
    case "$item" in
      windows/amd64|windows/arm64|macos/amd64|macos/arm64)
        TARGETS+=("$item")
        ;;
      *)
        fail "Unsupported target: $item"
        ;;
    esac
  done
  [[ "${#TARGETS[@]}" -gt 0 ]] || fail "No valid targets were provided"
}

prepare_release_dir() {
  [[ "$DRY_RUN" == "true" ]] && return
  mkdir -p "$RELEASE_DIR"
  if [[ "$SKIP_CLEAN" != "true" ]]; then
    rm -rf "$RELEASE_DIR/windows" "$RELEASE_DIR/macos"
  fi
}

stage_windows_package() {
  local arch="$1"
  local target_dir="$RELEASE_DIR/windows/$arch"
  local installer_path=""
  local arch_upper
  arch_upper="$(printf '%s' "$arch" | tr '[:lower:]' '[:upper:]')"
  log "Building Windows ${arch} package"
  run_task windows:package "ARCH=$arch" "FORMAT=$WINDOWS_FORMAT" "CGO_ENABLED=$USE_WINDOWS_CGO"
  [[ "$DRY_RUN" == "true" ]] && return
  mkdir -p "$target_dir"
  case "$WINDOWS_FORMAT" in
    nsis)
      if [[ -f "$ROOT_DIR/bin/$APP_NAME-$arch-installer.exe" ]]; then
        installer_path="$ROOT_DIR/bin/$APP_NAME-$arch-installer.exe"
      elif [[ -f "$ROOT_DIR/bin/$APP_NAME-$arch_upper-installer.exe" ]]; then
        installer_path="$ROOT_DIR/bin/$APP_NAME-$arch_upper-installer.exe"
      else
        installer_path="$(find "$ROOT_DIR/bin" -maxdepth 1 -type f -name "$APP_NAME-*-installer.exe" | sort | tail -n 1)"
      fi
      [[ -n "$installer_path" && -f "$installer_path" ]] || fail "Windows ${arch} installer was not created"
      cp "$installer_path" "$target_dir/$APP_NAME-windows-$arch-installer.exe"
      ;;
    msix)
      installer_path="$ROOT_DIR/bin/$APP_NAME-$arch.msix"
      [[ -f "$installer_path" ]] || fail "Windows ${arch} MSIX package was not created"
      cp "$installer_path" "$target_dir/$APP_NAME-windows-$arch.msix"
      ;;
    *)
      fail "Unsupported windows format: $WINDOWS_FORMAT"
      ;;
  esac
  if [[ -f "$ROOT_DIR/bin/$APP_NAME.exe" ]]; then
    cp "$ROOT_DIR/bin/$APP_NAME.exe" "$target_dir/$APP_NAME-windows-$arch.exe"
  fi
}

stage_windows_dual_package() {
  local target_dir="$RELEASE_DIR/windows/dual"
  local installer_path="$ROOT_DIR/bin/$APP_NAME-amd64_arm64-installer.exe"
  log "Building Windows dual-arch package"
  run_task windows:package:dual "FORMAT=$WINDOWS_FORMAT" "CGO_ENABLED=$USE_WINDOWS_CGO"
  [[ "$DRY_RUN" == "true" ]] && return
  [[ "$WINDOWS_FORMAT" == "nsis" ]] || fail "Windows dual package currently supports nsis only"
  [[ -f "$installer_path" ]] || fail "Windows dual-arch installer was not created"
  mkdir -p "$target_dir"
  cp "$installer_path" "$target_dir/$APP_NAME-windows-amd64-arm64-installer.exe"
  [[ -f "$target_dir/$APP_NAME-windows-amd64-arm64-installer.exe" ]] || fail "Dual-arch installer copy failed"
}

stage_macos_package() {
  local arch="$1"
  local target_dir="$RELEASE_DIR/macos/$arch"
  local bundle_copy="$target_dir/$APP_NAME.app"
  local dmg_path="$ROOT_DIR/bin/$APP_NAME.dmg"
  log "Building macOS ${arch} package"
  run_task darwin:package:dmg "ARCH=$arch"
  [[ "$DRY_RUN" == "true" ]] && return
  [[ -d "$ROOT_DIR/bin/$APP_NAME.app" ]] || fail "macOS ${arch} app bundle was not created"
  [[ -f "$dmg_path" ]] || fail "macOS ${arch} dmg was not created"
  rm -rf "$bundle_copy"
  mkdir -p "$target_dir"
  cp -R "$ROOT_DIR/bin/$APP_NAME.app" "$bundle_copy"
  archive_macos_bundle "$bundle_copy" "$target_dir/$APP_NAME-darwin-$arch.zip"
  [[ -f "$target_dir/$APP_NAME-darwin-$arch.zip" ]] || fail "macOS ${arch} zip was not created"
  cp "$dmg_path" "$target_dir/$APP_NAME-darwin-$arch.dmg"
  [[ -f "$target_dir/$APP_NAME-darwin-$arch.dmg" ]] || fail "macOS ${arch} dmg copy failed"
  if [[ -f "$ROOT_DIR/bin/$APP_NAME" ]]; then
    cp "$ROOT_DIR/bin/$APP_NAME" "$target_dir/$APP_NAME-darwin-$arch"
  fi
}

stage_macos_universal_package() {
  local target_dir="$RELEASE_DIR/macos/universal"
  local bundle_copy="$target_dir/$APP_NAME.app"
  local dmg_path="$ROOT_DIR/bin/$APP_NAME.dmg"
  log "Building macOS universal package"
  run_task darwin:package:dmg:universal
  [[ "$DRY_RUN" == "true" ]] && return
  [[ -d "$ROOT_DIR/bin/$APP_NAME.app" ]] || fail "macOS universal app bundle was not created"
  [[ -f "$dmg_path" ]] || fail "macOS universal dmg was not created"
  rm -rf "$bundle_copy"
  mkdir -p "$target_dir"
  cp -R "$ROOT_DIR/bin/$APP_NAME.app" "$bundle_copy"
  archive_macos_bundle "$bundle_copy" "$target_dir/$APP_NAME-darwin-universal.zip"
  [[ -f "$target_dir/$APP_NAME-darwin-universal.zip" ]] || fail "macOS universal zip was not created"
  cp "$dmg_path" "$target_dir/$APP_NAME-darwin-universal.dmg"
  [[ -f "$target_dir/$APP_NAME-darwin-universal.dmg" ]] || fail "macOS universal dmg copy failed"
  if [[ -f "$ROOT_DIR/bin/$APP_NAME" ]]; then
    cp "$ROOT_DIR/bin/$APP_NAME" "$target_dir/$APP_NAME-darwin-universal"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --targets)
      TARGETS_CSV="$2"
      shift 2
      ;;
    --windows-format)
      WINDOWS_FORMAT="$2"
      shift 2
      ;;
    --release-dir)
      RELEASE_DIR="$2"
      shift 2
      ;;
    --include-macos-universal)
      INCLUDE_MACOS_UNIVERSAL="true"
      shift
      ;;
    --skip-windows-dual)
      INCLUDE_WINDOWS_DUAL="false"
      shift
      ;;
    --use-windows-cgo)
      USE_WINDOWS_CGO="1"
      shift
      ;;
    --skip-clean)
      SKIP_CLEAN="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
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

case "$WINDOWS_FORMAT" in
  nsis|msix) ;;
  *)
    fail "windows format must be nsis or msix"
    ;;
esac

parse_targets
ensure_prerequisites
prepare_release_dir

for target in "${TARGETS[@]}"; do
  case "$target" in
    windows/*)
      stage_windows_package "${target#windows/}"
      ;;
    macos/*)
      stage_macos_package "${target#macos/}"
      ;;
  esac
done

if [[ "$INCLUDE_WINDOWS_DUAL" == "true" ]]; then
  for target in "${TARGETS[@]}"; do
    if [[ "$target" == "windows/amd64" ]]; then
      has_windows_amd64=true
    fi
    if [[ "$target" == "windows/arm64" ]]; then
      has_windows_arm64=true
    fi
  done
  if [[ "${has_windows_amd64:-false}" == "true" && "${has_windows_arm64:-false}" == "true" ]]; then
    stage_windows_dual_package
  fi
fi

if [[ "$INCLUDE_MACOS_UNIVERSAL" == "true" ]]; then
  stage_macos_universal_package
fi

if [[ "$DRY_RUN" != "true" ]]; then
  log "Release packages written to $RELEASE_DIR"
fi
