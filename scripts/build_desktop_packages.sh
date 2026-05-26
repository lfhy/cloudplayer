#!/usr/bin/env bash
set -euo pipefail

# Build release archives for the current host platform and stage the Go bridge
# next to the packaged executable before packaging.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="${APP_NAME:-CloudPlayer}"
ARTIFACT_PREFIX="${ARTIFACT_PREFIX:-cloudplayer}"
PLATFORM=""
ARCH=""
VERSION=""
BUILD_NUMBER="1"
OUTPUT_DIR="$ROOT_DIR/dist/release"
MACOS_BRIDGE_OUTPUT=""
WINDOWS_VC_REDIST_X64_URL="${WINDOWS_VC_REDIST_X64_URL:-https://aka.ms/vs/17/release/vc_redist.x64.exe}"
WINDOWS_VC_REDIST_ARM64_URL="${WINDOWS_VC_REDIST_ARM64_URL:-https://aka.ms/vs/17/release/vc_redist.arm64.exe}"

usage() {
  cat <<'EOF'
Usage: ./scripts/build_desktop_packages.sh --platform <windows|macos> --version <x.y.z> [options]

Options:
  --platform <name>        Build the current host's windows or macos package
  --arch <name>            Target archive arch: amd64/arm64/universal for macos,
                           amd64/arm64 for windows
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

resolve_output_dir() {
  case "$1" in
    /*)
      printf '%s\n' "$1"
      ;;
    *)
      printf '%s\n' "$ROOT_DIR/$1"
      ;;
  esac
}

to_windows_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
    return
  fi
  printf '%s' "$1"
}

resolve_windows_toolchain_path() {
  local path="$1"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$path"
    return
  fi
  printf '%s' "$path"
}

resolve_windows_release_dir() {
  local arch_label="$1"
  local candidates=()
  local candidate=""

  case "$arch_label" in
    amd64)
      candidates=(
        "$ROOT_DIR/build/windows/x64/runner/Release"
        "$ROOT_DIR/build/windows/windows-x64/runner/Release"
      )
      ;;
    arm64)
      candidates=(
        "$ROOT_DIR/build/windows/arm64/runner/Release"
        "$ROOT_DIR/build/windows/windows-arm64/runner/Release"
      )
      ;;
    *)
      fail "Unsupported Windows arch: $arch_label"
      ;;
  esac

  # Flutter's Windows output directory naming changed across SDK releases.
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate/$APP_NAME.exe" ]]; then
      printf '%s\n' "$candidate"
      return
    fi
  done

  fail "Windows release directory not found. Checked: ${candidates[*]}"
}

download_windows_file() {
  local url="$1"
  local output_path="$2"
  local output_dir output_path_win

  require_cmd powershell.exe
  output_dir="$(dirname "$output_path")"
  mkdir -p "$output_dir"

  if [[ -s "$output_path" ]]; then
    return
  fi

  output_path_win="$(to_windows_path "$output_path")"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
    \$ErrorActionPreference = 'Stop'
    \$ProgressPreference = 'SilentlyContinue'
    \$url = '$url'
    \$output = '$output_path_win'
    \$parent = Split-Path -Parent \$output
    if (-not (Test-Path -LiteralPath \$parent)) {
      New-Item -ItemType Directory -Path \$parent | Out-Null
    }
    \$attempt = 0
    while (\$true) {
      try {
        Invoke-WebRequest -Uri \$url -OutFile \$output
        break
      } catch {
        \$attempt += 1
        if (\$attempt -ge 5) {
          throw
        }
        Start-Sleep -Seconds (2 * \$attempt)
      }
    }
  " >/dev/null

  [[ -s "$output_path" ]] || fail "Failed to download Windows prerequisite: $url"
}

build_windows() {
  local arch_label="$1"
  require_cmd flutter
  require_cmd go
  require_cmd powershell.exe

  mkdir -p "$ROOT_DIR/bin/bridge" "$OUTPUT_DIR"

  local release_dir archive_path installer_path
  case "$arch_label" in
    amd64)
      archive_path="$OUTPUT_DIR/$ARTIFACT_PREFIX-windows-amd64.zip"
      installer_path="$OUTPUT_DIR/$ARTIFACT_PREFIX-windows-amd64-installer.exe"
      ;;
    arm64)
      archive_path="$OUTPUT_DIR/$ARTIFACT_PREFIX-windows-arm64.zip"
      installer_path="$OUTPUT_DIR/$ARTIFACT_PREFIX-windows-arm64-installer.exe"
      ;;
    *)
      fail "Unsupported Windows arch: $arch_label"
      ;;
  esac

  (
    cd "$ROOT_DIR"
    local go_cc="${CC:-}"
    local go_cxx="${CXX:-}"
    if [[ -n "$go_cc" ]]; then
      go_cc="$(resolve_windows_toolchain_path "$go_cc")"
    fi
    if [[ -n "$go_cxx" ]]; then
      go_cxx="$(resolve_windows_toolchain_path "$go_cxx")"
    fi
    env \
      ${go_cc:+CC="$go_cc"} \
      ${go_cxx:+CXX="$go_cxx"} \
      go build -buildmode=c-shared -o bin/bridge/cloudplayer_bridge.dll ./bridge
    flutter build windows --release \
      --build-name "$VERSION" \
      --build-number "$BUILD_NUMBER"
  )

  release_dir="$(resolve_windows_release_dir "$arch_label")"
  local bridge_dll="$ROOT_DIR/bin/bridge/cloudplayer_bridge.dll"
  local vc_redist_url=""
  local vc_redist_file_name=""
  local vc_redist_path=""
  [[ -d "$release_dir" ]] || fail "Windows release directory not found: $release_dir"
  [[ -f "$bridge_dll" ]] || fail "Windows bridge was not built: $bridge_dll"
  cp "$bridge_dll" "$release_dir/cloudplayer_bridge.dll"

  case "$arch_label" in
    amd64)
      vc_redist_url="$WINDOWS_VC_REDIST_X64_URL"
      vc_redist_file_name="vc_redist.x64.exe"
      ;;
    arm64)
      vc_redist_url="$WINDOWS_VC_REDIST_ARM64_URL"
      vc_redist_file_name="vc_redist.arm64.exe"
      ;;
    *)
      fail "Unsupported Windows arch: $arch_label"
      ;;
  esac
  vc_redist_path="$ROOT_DIR/bin/prerequisites/$vc_redist_file_name"

  local release_dir_win archive_path_win
  release_dir_win="$(to_windows_path "$release_dir")"
  archive_path_win="$(to_windows_path "$archive_path")"
  powershell.exe -NoProfile -Command \
    "if (Test-Path '$archive_path_win') { Remove-Item '$archive_path_win' -Force }; Compress-Archive -Path '$release_dir_win\\*' -DestinationPath '$archive_path_win' -Force" >/dev/null
  [[ -f "$archive_path" ]] || fail "Windows archive was not created: $archive_path"

  # Bundle the VC++ redistributable with the installer so end users do not
  # have to discover and install the runtime manually.
  download_windows_file "$vc_redist_url" "$vc_redist_path"

  powershell.exe -NoProfile -ExecutionPolicy Bypass \
    -File "$(to_windows_path "$ROOT_DIR/scripts/build_windows_installer.ps1")" \
    -SourceDir "$release_dir_win" \
    -OutputDir "$(to_windows_path "$OUTPUT_DIR")" \
    -Version "$VERSION" \
    -Arch "$arch_label" \
    -VcRedistPath "$(to_windows_path "$vc_redist_path")" \
    -VcRedistFileName "$vc_redist_file_name" >/dev/null
  [[ -f "$installer_path" ]] || fail "Windows installer was not created: $installer_path"
}

build_macos_bridge_single() {
  local go_arch="$1"
  local clang_arch="$2"
  local output_path="$3"
  local min_version_flag
  local xcode_dir
  local clang_path
  local clangxx_path
  local sdk_path

  min_version_flag="-mmacosx-version-min=${MACOSX_DEPLOYMENT_TARGET:-11.0}"
  xcode_dir="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
  clang_path="$(DEVELOPER_DIR="$xcode_dir" xcrun --find clang)"
  clangxx_path="$(DEVELOPER_DIR="$xcode_dir" xcrun --find clang++)"
  sdk_path="$(DEVELOPER_DIR="$xcode_dir" xcrun --sdk macosx --show-sdk-path)"

  (
    cd "$ROOT_DIR"
    env \
      DEVELOPER_DIR="$xcode_dir" \
      SDKROOT="$sdk_path" \
      MACOSX_DEPLOYMENT_TARGET="${MACOSX_DEPLOYMENT_TARGET:-11.0}" \
      GOOS=darwin \
      GOARCH="$go_arch" \
      CGO_ENABLED=1 \
      CC="$clang_path" \
      CXX="$clangxx_path" \
      CGO_CFLAGS="-isysroot $sdk_path -arch $clang_arch $min_version_flag" \
      CGO_CXXFLAGS="-isysroot $sdk_path -arch $clang_arch $min_version_flag" \
      CGO_LDFLAGS="-isysroot $sdk_path -arch $clang_arch $min_version_flag -Wl,-no_warn_duplicate_libraries" \
      go build -buildmode=c-shared -o "$output_path" ./bridge
  )
}

build_macos_bridge() {
  local arch_label="$1"
  local bridge_dir="$ROOT_DIR/bin/bridge"
  local bridge_path=""
  local arm64_bridge=""
  local amd64_bridge=""

  mkdir -p "$bridge_dir"

  case "$arch_label" in
    arm64)
      bridge_path="$bridge_dir/libcloudplayer_bridge-arm64-release.dylib"
      rm -f "$bridge_path" "${bridge_path%.dylib}.h"
      build_macos_bridge_single arm64 arm64 "$bridge_path"
      ;;
    amd64)
      bridge_path="$bridge_dir/libcloudplayer_bridge-amd64-release.dylib"
      rm -f "$bridge_path" "${bridge_path%.dylib}.h"
      build_macos_bridge_single amd64 x86_64 "$bridge_path"
      ;;
    universal)
      arm64_bridge="$bridge_dir/libcloudplayer_bridge-arm64-release.dylib"
      amd64_bridge="$bridge_dir/libcloudplayer_bridge-amd64-release.dylib"
      bridge_path="$bridge_dir/libcloudplayer_bridge-universal-release.dylib"
      rm -f \
        "$arm64_bridge" "${arm64_bridge%.dylib}.h" \
        "$amd64_bridge" "${amd64_bridge%.dylib}.h" \
        "$bridge_path" "${bridge_path%.dylib}.h"
      build_macos_bridge_single arm64 arm64 "$arm64_bridge"
      build_macos_bridge_single amd64 x86_64 "$amd64_bridge"
      lipo -create -output "$bridge_path" "$arm64_bridge" "$amd64_bridge"
      ;;
    *)
      fail "Unsupported macOS arch: $arch_label"
      ;;
  esac

  MACOS_BRIDGE_OUTPUT="$bridge_path"
}

expected_macos_archs() {
  case "$1" in
    arm64)
      printf 'arm64\n'
      ;;
    amd64)
      printf 'x86_64\n'
      ;;
    universal)
      printf 'arm64 x86_64\n'
      ;;
    *)
      fail "Unsupported macOS arch: $1"
      ;;
  esac
}

normalize_archs() {
  tr ' ' '\n' <<<"$1" | sed '/^$/d' | sort | tr '\n' ' ' | sed 's/ $//'
}

create_macos_dmg() {
  local app_bundle="$1"
  local dmg_path="$2"
  local staging_dir

  staging_dir="$(mktemp -d)"
  rm -f "$dmg_path"
  cp -R "$app_bundle" "$staging_dir/"
  ln -s /Applications "$staging_dir/Applications"
  hdiutil create \
    -quiet \
    -volname "$APP_NAME" \
    -srcfolder "$staging_dir" \
    -ov \
    -format UDZO \
    "$dmg_path"
  rm -rf "$staging_dir"
}

build_macos() {
  local arch_label="$1"
  require_cmd flutter
  require_cmd go
  require_cmd ditto
  require_cmd codesign

  mkdir -p "$ROOT_DIR/bin/bridge" "$OUTPUT_DIR"

  local flutter_archs archive_stem
  case "$arch_label" in
    arm64)
      flutter_archs="arm64"
      archive_stem="$ARTIFACT_PREFIX-darwin-arm64"
      ;;
    amd64)
      flutter_archs="x86_64"
      archive_stem="$ARTIFACT_PREFIX-darwin-amd64"
      ;;
    universal)
      flutter_archs="arm64 x86_64"
      archive_stem="$ARTIFACT_PREFIX-darwin-universal"
      ;;
    *)
      fail "Unsupported macOS arch: $arch_label"
      ;;
  esac

  rm -rf "$ROOT_DIR/build/macos/Build/Products/Release/$APP_NAME.app"
  build_macos_bridge "$arch_label"
  (
    cd "$ROOT_DIR"
    FLUTTER_XCODE_ARCHS="$flutter_archs" \
      flutter build macos --release \
        --build-name "$VERSION" \
        --build-number "$BUILD_NUMBER"
  )

  local app_bundle="$ROOT_DIR/build/macos/Build/Products/Release/$APP_NAME.app"
  local bridge_dylib="$MACOS_BRIDGE_OUTPUT"
  local archive_name="$archive_stem.zip"
  local archive_path="$OUTPUT_DIR/$archive_name"
  local dmg_path="$OUTPUT_DIR/$archive_stem.dmg"
  local app_binary="$app_bundle/Contents/MacOS/$APP_NAME"
  local actual_app_archs actual_bridge_archs expected_archs
  local normalized_app_archs normalized_bridge_archs normalized_expected_archs

  [[ -d "$app_bundle" ]] || fail "macOS app bundle not found: $app_bundle"
  [[ -f "$bridge_dylib" ]] || fail "macOS bridge was not built: $bridge_dylib"
  cp "$bridge_dylib" "$app_bundle/Contents/MacOS/libcloudplayer_bridge.dylib"
  codesign --force --sign - --timestamp=none "$app_bundle/Contents/MacOS/libcloudplayer_bridge.dylib" >/dev/null
  codesign --force --deep --sign - --timestamp=none "$app_bundle" >/dev/null

  expected_archs="$(expected_macos_archs "$arch_label")"
  actual_app_archs="$(lipo -archs "$app_binary")"
  actual_bridge_archs="$(lipo -archs "$app_bundle/Contents/MacOS/libcloudplayer_bridge.dylib")"
  normalized_expected_archs="$(normalize_archs "$expected_archs")"
  normalized_app_archs="$(normalize_archs "$actual_app_archs")"
  normalized_bridge_archs="$(normalize_archs "$actual_bridge_archs")"
  [[ "$normalized_app_archs" == "$normalized_expected_archs" ]] || fail "macOS app arch mismatch: expected '$expected_archs', got '$actual_app_archs'"
  [[ "$normalized_bridge_archs" == "$normalized_expected_archs" ]] || fail "macOS bridge arch mismatch: expected '$expected_archs', got '$actual_bridge_archs'"

  rm -f "$archive_path"
  (
    cd "$(dirname "$app_bundle")"
    ditto -c -k --sequesterRsrc --keepParent "$(basename "$app_bundle")" "$archive_name"
    mv "$archive_name" "$archive_path"
  )
  [[ -f "$archive_path" ]] || fail "macOS archive was not created: $archive_path"
  create_macos_dmg "$app_bundle" "$dmg_path"
  [[ -f "$dmg_path" ]] || fail "macOS dmg was not created: $dmg_path"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      PLATFORM="${2:-}"
      shift 2
      ;;
    --arch)
      ARCH="${2:-}"
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
[[ -n "$ARCH" ]] || fail "--arch is required"
[[ -n "$VERSION" ]] || fail "--version is required"
OUTPUT_DIR="$(resolve_output_dir "$OUTPUT_DIR")"

case "$PLATFORM" in
  windows)
    build_windows "$ARCH"
    ;;
  macos)
    build_macos "$ARCH"
    ;;
  *)
    fail "Unsupported platform: $PLATFORM"
    ;;
esac
