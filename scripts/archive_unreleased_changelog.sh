#!/usr/bin/env bash
set -euo pipefail

# Archive CHANGELOG.md's Unreleased section into a versioned release entry.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHANGELOG_FILE="${CHANGELOG_FILE:-$ROOT_DIR/CHANGELOG.md}"
RELEASE_TAG="${1:-${RELEASE_TAG:-}}"
RELEASE_DATE="${2:-${RELEASE_DATE:-$(date +%F)}}"

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"
}

has_unreleased_entries() {
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
      if ($0 ~ /^[[:space:]]*$/) next
      if ($0 ~ /^### /) next
      if ($0 == "- 暂无。") next
      if ($0 ~ /^- /) has_content = 1
    }
    END {
      exit(has_content ? 0 : 1)
    }
  ' "$CHANGELOG_FILE"
}

archive_with_python() {
  python3 - "$CHANGELOG_FILE" "$RELEASE_TAG" "$RELEASE_DATE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
tag = sys.argv[2]
release_date = sys.argv[3]
text = path.read_text(encoding="utf-8")
marker = "## Unreleased"
start = text.find(marker)
if start == -1:
    raise SystemExit("Error: Missing '## Unreleased' section")
after_marker = start + len(marker)
next_section = text.find("\n## ", after_marker)
if next_section == -1:
    unreleased_body = text[after_marker:].strip("\n")
    suffix = ""
else:
    unreleased_body = text[after_marker:next_section].strip("\n")
    suffix = text[next_section:].lstrip("\n")
header = text[:start].rstrip()
template = """## Unreleased

### 本次更新

- 暂无。

### 重点变更

- 暂无。

### 修复

- 暂无。

### 已知问题

- 暂无。"""
release_section = f"""## {tag} - {release_date}

{unreleased_body}""".rstrip()
parts = [header, "", template, "", release_section]
if suffix:
    parts.extend(["", suffix.rstrip()])
path.write_text("\n".join(parts) + "\n", encoding="utf-8")
PY
}

main() {
  [[ -n "$RELEASE_TAG" ]] || fail "Release tag is required"
  [[ -f "$CHANGELOG_FILE" ]] || fail "Missing changelog file: $CHANGELOG_FILE"
  require_cmd python3

  has_unreleased_entries || fail "Unreleased section has no entries to archive"
  archive_with_python
  printf 'Archived CHANGELOG.md Unreleased into %s - %s\n' "$RELEASE_TAG" "$RELEASE_DATE"
}

main "$@"
