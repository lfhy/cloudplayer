#!/usr/bin/env bash
set -euo pipefail

# Generate a Chinese GitHub release body from git commits between tags.
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

section_for_subject() {
  local subject="$1"
  case "$subject" in
    feat:*) printf '重点变更' ;;
    fix:*) printf '修复' ;;
    docs:*|chore:*|build:*|ci:*|test:*|refactor:*|perf:*|style:*)
      printf '本次更新'
      ;;
    *)
      printf '本次更新'
      ;;
  esac
}

strip_prefix() {
  local subject="$1"
  case "$subject" in
    feat:*) printf '%s' "${subject#feat: }" ;;
    fix:*) printf '%s' "${subject#fix: }" ;;
    docs:*) printf '%s' "${subject#docs: }" ;;
    chore:*) printf '%s' "${subject#chore: }" ;;
    build:*) printf '%s' "${subject#build: }" ;;
    ci:*) printf '%s' "${subject#ci: }" ;;
    test:*) printf '%s' "${subject#test: }" ;;
    refactor:*) printf '%s' "${subject#refactor: }" ;;
    perf:*) printf '%s' "${subject#perf: }" ;;
    style:*) printf '%s' "${subject#style: }" ;;
    *) printf '%s' "$subject" ;;
  esac
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

  local all_updates=""
  local highlights=""
  local fixes=""

  while IFS=$'\t' read -r subject hash; do
    [[ -n "${subject:-}" ]] || continue
    local section
    section="$(section_for_subject "$subject")"
    local entry
    entry="- \`$hash\` $(strip_prefix "$subject")"
    all_updates+="${entry}"$'\n'
    case "$section" in
      重点变更) highlights+="${entry}"$'\n' ;;
      修复) fixes+="${entry}"$'\n' ;;
    esac
  done < <(collect_commits "$range")

  {
    printf '# CloudPlayer 发布说明\n\n'
    printf '## 本次更新\n'
    if [[ -n "$all_updates" ]]; then
      printf '%s' "$all_updates"
    else
      printf '%s\n' '- 暂无新增提交。'
    fi
    printf '\n## 重点变更\n'
    if [[ -n "$highlights" ]]; then
      printf '%s' "$highlights"
    else
      printf '%s\n' '- 暂无重点变更。'
    fi
    printf '\n## 修复\n'
    if [[ -n "$fixes" ]]; then
      printf '%s' "$fixes"
    else
      printf '%s\n' '- 暂无修复项。'
    fi
    printf '\n## 已知问题\n'
    cat <<'EOF'
- macOS 版本当前未做 Apple notarization，首次打开如果出现“`CloudPlayer` 已损坏，无法打开。你应该将它移到废纸篓。”，可先执行：
  - 先把 `CloudPlayer.app` 拖到“应用程序”目录
  - 再双击发布包内附带的 `fix_cloudplayer_quarantine.command`
  - 如果你没有使用脚本，也可以手动执行：`xattr -dr com.apple.quarantine /Applications/CloudPlayer.app`
- 如果仍被系统拦截，可在“系统设置 → 隐私与安全性”里允许本次打开

EOF
    cat <<'EOF'
## 附件说明
- Windows：`cloudplayer-windows-amd64.zip`
- Windows：`cloudplayer-windows-arm64.zip`
- Windows：`cloudplayer-windows-amd64-installer.exe`
- Windows：`cloudplayer-windows-arm64-installer.exe`
- macOS：`cloudplayer-darwin-amd64.dmg`
- macOS：`cloudplayer-darwin-arm64.dmg`
- macOS：`cloudplayer-darwin-universal.dmg`
EOF
  } > "$OUTPUT_FILE"
}

main "$@"
