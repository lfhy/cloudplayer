#!/usr/bin/env bash

# Double-click helper for clearing Gatekeeper quarantine from the standard install path.
set -euo pipefail

APP_PATH="/Applications/CloudPlayer.app"

if [[ ! -d "$APP_PATH" ]]; then
  osascript -e 'display dialog "未找到 /Applications/CloudPlayer.app，请先把 CloudPlayer.app 拖到“应用程序”目录后再运行这个脚本。" buttons {"好"} default button "好" with icon caution'
  exit 1
fi

xattr -dr com.apple.quarantine "$APP_PATH"
osascript -e 'display dialog "已执行 xattr -dr com.apple.quarantine /Applications/CloudPlayer.app" buttons {"好"} default button "好" with icon note'
