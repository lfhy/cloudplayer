#!/usr/bin/env bash
set -euo pipefail

# Publish prebuilt assets into the GitHub release for a tag, creating the
# release on demand so each architecture workflow can upload independently.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG=""
RELEASE_NAME=""
BODY_FILE=""
FILES=()

usage() {
  cat <<'EOF'
Usage: ./scripts/publish_release_assets.sh --tag <v1.2.3> --name <release name> --body-file <path> <files...>
EOF
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"
}

release_exists() {
  gh release view "$TAG" >/dev/null 2>&1
}

ensure_release() {
  if release_exists; then
    return
  fi

  if gh release create "$TAG" --title "$RELEASE_NAME" --notes-file "$BODY_FILE" >/dev/null; then
    return
  fi

  release_exists || fail "Unable to create or locate release for tag $TAG"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --name)
      RELEASE_NAME="${2:-}"
      shift 2
      ;;
    --body-file)
      BODY_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      FILES+=("$1")
      shift
      ;;
  esac
done

[[ -n "$TAG" ]] || fail "--tag is required"
[[ -n "$RELEASE_NAME" ]] || fail "--name is required"
[[ -n "$BODY_FILE" ]] || fail "--body-file is required"
[[ -f "$BODY_FILE" ]] || fail "Release body file not found: $BODY_FILE"
[[ "${#FILES[@]}" -gt 0 ]] || fail "At least one release asset is required"

require_cmd gh
cd "$ROOT_DIR"
ensure_release
gh release upload "$TAG" "${FILES[@]}" --clobber
