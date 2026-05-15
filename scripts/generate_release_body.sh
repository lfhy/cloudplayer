#!/usr/bin/env bash
set -euo pipefail

# Generate a Chinese GitHub release body from git commits between tags.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_TAG="${1:-${TARGET_TAG:-}}"
OUTPUT_FILE="${2:-${OUTPUT_FILE:-}}"
CHANGELOG_FILE="${CHANGELOG_FILE:-$ROOT_DIR/CHANGELOG.md}"

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"
}

has_unreleased_changelog() {
  [[ -f "$CHANGELOG_FILE" ]] || return 1
  awk '
    BEGIN {
      in_unreleased = 0
      has_content = 0
    }
    /^## Unreleased[[:space:]]*$/ {
      in_unreleased = 1
      next
    }
    /^## / && in_unreleased {
      exit
    }
    in_unreleased {
      if ($0 ~ /^[[:space:]]*$/) {
        next
      }
      if ($0 ~ /^### /) {
        next
      }
      if ($0 == "- 暂无。") {
        next
      }
      if ($0 ~ /^- /) {
        has_content = 1
      }
    }
    END {
      exit(has_content ? 0 : 1)
    }
  ' "$CHANGELOG_FILE"
}

extract_unreleased_changelog() {
  awk '
    BEGIN {
      in_unreleased = 0
    }
    /^## Unreleased[[:space:]]*$/ {
      in_unreleased = 1
      next
    }
    /^## / && in_unreleased {
      exit
    }
    in_unreleased {
      print
    }
  ' "$CHANGELOG_FILE"
}

# Normalize the leading commit token so release notes work with both
# conventional commits and plain-English subjects like "Add ..." or "Fix ...".
subject_token() {
  local subject="$1"
  subject="${subject%%:*}"
  subject="${subject%%(*}"
  subject="${subject%% *}"
  printf '%s' "$subject" | tr '[:upper:]' '[:lower:]'
}

previous_tag() {
  local tag="$1"
  local candidate
  candidate="$(git -C "$ROOT_DIR" describe --tags --abbrev=0 "${tag}^" 2>/dev/null || true)"
  printf '%s' "$candidate"
}

section_for_subject() {
  local subject="$1"
  case "$(subject_token "$subject")" in
    feat|feature|add) printf '重点变更' ;;
    fix|bugfix|hotfix) printf '修复' ;;
    docs|chore|build|ci|test|refactor|perf|style)
      printf '本次更新'
      ;;
    *)
      printf '本次更新'
      ;;
  esac
}

strip_prefix() {
  local subject="$1"
  local token
  token="$(subject_token "$subject")"
  case "$subject" in
    feat:*) printf '%s' "${subject#feat: }" ;;
    feat\(*:*) printf '%s' "${subject#*: }" ;;
    fix:*) printf '%s' "${subject#fix: }" ;;
    fix\(*:*) printf '%s' "${subject#*: }" ;;
    docs:*) printf '%s' "${subject#docs: }" ;;
    docs\(*:*) printf '%s' "${subject#*: }" ;;
    chore:*) printf '%s' "${subject#chore: }" ;;
    chore\(*:*) printf '%s' "${subject#*: }" ;;
    build:*) printf '%s' "${subject#build: }" ;;
    build\(*:*) printf '%s' "${subject#*: }" ;;
    ci:*) printf '%s' "${subject#ci: }" ;;
    ci\(*:*) printf '%s' "${subject#*: }" ;;
    test:*) printf '%s' "${subject#test: }" ;;
    test\(*:*) printf '%s' "${subject#*: }" ;;
    refactor:*) printf '%s' "${subject#refactor: }" ;;
    refactor\(*:*) printf '%s' "${subject#*: }" ;;
    perf:*) printf '%s' "${subject#perf: }" ;;
    perf\(*:*) printf '%s' "${subject#*: }" ;;
    style:*) printf '%s' "${subject#style: }" ;;
    style\(*:*) printf '%s' "${subject#*: }" ;;
    *) printf '%s' "$subject" ;;
  esac | {
    IFS= read -r stripped || true
    case "$token" in
      add|fix|docs|chore|build|ci|test|refactor|perf|style|feat|feature|bugfix|hotfix)
        if [[ "$stripped" == "$subject" && "$subject" == *" "* ]]; then
          printf '%s' "${subject#* }"
        else
          printf '%s' "$stripped"
        fi
        ;;
      *)
        printf '%s' "$stripped"
        ;;
    esac
  }
}

collect_commits() {
  local range="$1"
  git -C "$ROOT_DIR" log --no-merges --format='%s%x09%h' "$range"
}

main() {
  [[ -n "$TARGET_TAG" ]] || fail "TARGET_TAG is required"
  [[ -n "$OUTPUT_FILE" ]] || fail "OUTPUT_FILE is required"
  require_cmd git

  if has_unreleased_changelog; then
    {
      printf '# CloudPlayer 发布说明\n\n'
      extract_unreleased_changelog
      printf '\n## 附件说明\n'
      cat <<'EOF'
- Windows：`cloudplayer-windows-amd64.zip`
- Windows：`cloudplayer-windows-arm64.zip`
- Windows：`cloudplayer-windows-amd64-installer.exe`
- Windows：`cloudplayer-windows-arm64-installer.exe`
- macOS：`cloudplayer-darwin-amd64.dmg`
- macOS：`cloudplayer-darwin-arm64.dmg`
- macOS：`cloudplayer-darwin-universal.dmg`
EOF
    } > "$OUTPUT_FILE"
    return
  fi

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
    if [[ -n "$highlights" ]]; then
      printf '\n## 重点变更\n'
      printf '%s' "$highlights"
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
