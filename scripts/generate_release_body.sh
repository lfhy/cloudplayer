#!/usr/bin/env bash
set -euo pipefail

# Generate a GitHub release body by grouping commit subjects into two sections.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_TAG="${1:-${TARGET_TAG:-}}"
OUTPUT_FILE="${2:-${OUTPUT_FILE:-}}"

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"
}

previous_tag() {
  local tag="$1"
  local candidate
  candidate="$(git -C "$ROOT_DIR" describe --tags --abbrev=0 "${tag}^" 2>/dev/null || true)"
  printf '%s' "$candidate"
}

is_fix_subject() {
  local subject="$1"
  local lowered
  lowered="$(printf '%s' "$subject" | tr '[:upper:]' '[:lower:]')"
  [[ "$lowered" == *fix* ]]
}

collect_commits() {
  local range="$1"
  git -C "$ROOT_DIR" log --no-merges --format='%s%x09%h' "$range"
}

main() {
  [[ -n "$TARGET_TAG" ]] || fail "TARGET_TAG is required"
  [[ -n "$OUTPUT_FILE" ]] || fail "OUTPUT_FILE is required"
  require_cmd git

  local prev_tag=""
  prev_tag="$(previous_tag "$TARGET_TAG")"
  local range
  if [[ -n "$prev_tag" ]]; then
    range="$prev_tag..$TARGET_TAG"
  else
    range="$(git -C "$ROOT_DIR" rev-list --max-parents=0 "$TARGET_TAG")..$TARGET_TAG"
  fi

  local updates=""
  local fixes=""

  while IFS=$'\t' read -r subject hash; do
    [[ -n "${subject:-}" ]] || continue
    local entry="- \`$hash\` $subject"
    if is_fix_subject "$subject"; then
      fixes+="${entry}"$'\n'
      continue
    fi
    updates+="${entry}"$'\n'
  done < <(collect_commits "$range")

  {
    printf '# CloudPlayer %s\n\n' "$TARGET_TAG"
    printf '## 更新内容\n'
    if [[ -n "$updates" ]]; then
      printf '%s' "$updates"
    else
      printf '%s\n' '- 暂无。'
    fi
    printf '\n## 问题修复\n'
    if [[ -n "$fixes" ]]; then
      printf '%s' "$fixes"
    else
      printf '%s\n' '- 暂无。'
    fi
  } > "$OUTPUT_FILE"
}

main "$@"
