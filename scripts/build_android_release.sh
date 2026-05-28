#!/usr/bin/env bash
set -euo pipefail

# Build an Android arm64 release APK after compiling the Go bridge and syncing
# it into the Gradle jniLibs input tree used by the Flutter Android app.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/dist/android/arm64-v8a"
VERSION=""
BUILD_NUMBER="1"
NDK_VERSION="${ANDROID_NDK_VERSION:-28.2.13676358}"
APP_NAME="${APP_NAME:-cloudplayer}"
ARTIFACT_PREFIX="${ARTIFACT_PREFIX:-cloudplayer}"
TEMP_SIGNING_DIR=""

usage() {
  cat <<'EOF'
Usage: ./scripts/build_android_release.sh --version <x.y.z> [options]

Options:
  --version <x.y.z>        Release version passed to flutter build apk
  --build-number <num>     Build number passed to flutter build apk
  --output-dir <path>      Output directory for the release APK
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

detect_ndk_host_tag() {
  case "$(uname -s)" in
    Darwin)
      printf 'darwin-x86_64\n'
      ;;
    Linux)
      printf 'linux-x86_64\n'
      ;;
    MINGW*|MSYS*|CYGWIN*)
      printf 'windows-x86_64\n'
      ;;
    *)
      fail "Unsupported host platform for Android NDK toolchain: $(uname -s)"
      ;;
  esac
}

build_android_bridge() {
  require_cmd go
  [[ -n "${ANDROID_HOME:-}" ]] || fail "ANDROID_HOME is required"

  local ndk_host_tag ndk_bin bridge_dir bridge_out jni_dir
  ndk_host_tag="$(detect_ndk_host_tag)"
  ndk_bin="${ANDROID_HOME}/ndk/${NDK_VERSION}/toolchains/llvm/prebuilt/${ndk_host_tag}/bin"
  [[ -d "$ndk_bin" ]] || fail "Android NDK toolchain not found: $ndk_bin"

  bridge_dir="$ROOT_DIR/bin/bridge/android"
  bridge_out="$bridge_dir/libcloudplayer_bridge.so"
  jni_dir="$bridge_dir/jniLibs/arm64-v8a"

  mkdir -p "$bridge_dir" "$jni_dir"
  rm -f "$bridge_out" "${bridge_out%.so}.h" "$jni_dir/libcloudplayer_bridge.so"

  (
    cd "$ROOT_DIR"
    env \
      CGO_ENABLED=1 \
      GOOS=android \
      GOARCH=arm64 \
      CC="$ndk_bin/aarch64-linux-android24-clang" \
      CXX="$ndk_bin/aarch64-linux-android24-clang++" \
      AR="$ndk_bin/llvm-ar" \
      go build -buildmode=c-shared -o "$bridge_out" ./bridge
  )

  cp "$bridge_out" "$jni_dir/libcloudplayer_bridge.so"
}

prepare_android_release_signing() {
  if [[ -z "${CP_ANDROID_KEYSTORE_PATH:-}" && -n "${CP_ANDROID_KEYSTORE_BASE64:-}" ]]; then
    TEMP_SIGNING_DIR="$(mktemp -d)"
    CP_ANDROID_KEYSTORE_PATH="$TEMP_SIGNING_DIR/cloudplayer-release.keystore"
    export CP_ANDROID_KEYSTORE_PATH
    printf '%s' "$CP_ANDROID_KEYSTORE_BASE64" | base64 --decode > "$CP_ANDROID_KEYSTORE_PATH"
  fi

  if [[ "${REQUIRE_ANDROID_RELEASE_SIGNING:-0}" != "1" ]]; then
    return
  fi

  [[ -n "${CP_ANDROID_KEYSTORE_PATH:-}" ]] || fail "CP_ANDROID_KEYSTORE_PATH or CP_ANDROID_KEYSTORE_BASE64 is required for release signing"
  [[ -n "${CP_ANDROID_KEYSTORE_PASSWORD:-}" ]] || fail "CP_ANDROID_KEYSTORE_PASSWORD is required for release signing"
  [[ -n "${CP_ANDROID_KEY_ALIAS:-}" ]] || fail "CP_ANDROID_KEY_ALIAS is required for release signing"
  [[ -n "${CP_ANDROID_KEY_PASSWORD:-}" ]] || fail "CP_ANDROID_KEY_PASSWORD is required for release signing"
}

build_android_release() {
  require_cmd flutter
  prepare_android_release_signing
  build_android_bridge

  mkdir -p "$OUTPUT_DIR"
  (
    cd "$ROOT_DIR"
    flutter pub get
    flutter build apk \
      --release \
      --target-platform android-arm64 \
      --split-per-abi \
      --build-name "$VERSION" \
      --build-number "$BUILD_NUMBER"
  )

  local source_apk="$ROOT_DIR/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk"
  local target_apk="$OUTPUT_DIR/${ARTIFACT_PREFIX}-android-arm64-v8a.apk"
  [[ -f "$source_apk" ]] || fail "Android APK was not created: $source_apk"
  cp "$source_apk" "$target_apk"
}

cleanup() {
  if [[ -n "$TEMP_SIGNING_DIR" && -d "$TEMP_SIGNING_DIR" ]]; then
    rm -rf "$TEMP_SIGNING_DIR"
  fi
}

trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
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

[[ -n "$VERSION" ]] || fail "--version is required"
OUTPUT_DIR="$(resolve_output_dir "$OUTPUT_DIR")"
build_android_release
