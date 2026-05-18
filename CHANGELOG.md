# CloudPlayer Changelog

- Added `scripts/free-port.mjs` to release occupied listening ports on Windows and macOS during local development.

- Windows buttons now avoid gradient fills and use flatter surfaces aligned with the native shell.
- Search now fails over to the next music source automatically when the current provider is unavailable.
- Search provider retries now use short per-attempt timeouts so a stalled source does not block failover.
- Search provider failover now waits up to 10 seconds per source before moving to the next provider.
- Search now keeps pulling lazy-loaded provider chunks until each app-side results page is filled to 30 rows when possible.
- Search now ignores cached empty first pages from the current provider and still falls through to the next source, which restores queries such as `民谣` when Kugou returns zero rows.
- Hybrid-mode favorites now reuse and deduplicate the built-in `我喜欢` playlist when the Kugou cloud favorites fork is attached, so repeated likes stop creating extra playlists with the same name.
- Standalone child windows no longer dim the main window while they are open.
- Main-window child-window masking no longer blurs the background while standalone dialogs are open.
- Dev port helpers now detect IPv4, IPv6, loopback, and wildcard listeners consistently so `wails3 dev` port conflicts can be cleared or avoided correctly.

使用方式：

- 日常开发时，把准备发版的内容持续补到 `## Unreleased` 下。
- 推 tag 触发 release 时，发布脚本会优先读取这个区块生成 release body。
- 发版完成后，运行 `./scripts/archive_unreleased_changelog.sh vX.Y.Z` 归档 `## Unreleased`，再继续在模板里累积下一版内容。

## Unreleased

### 本次更新

- 新增统一消息子窗口，在线模式下添加非酷狗云端歌曲到歌单时不再只弹浏览器式失败提示，而会展示明确原因。
- 偏好设置和登录账号子窗口的布尔“在线模式”已改为三态歌单模式：离线 / 在线 / 混合。
- 混合模式下会把酷狗云歌单 fork 到本地，刷新时继续从云端拉取新内容；新增、重命名、追加歌曲和「我喜欢」会优先回写云端，失败时保留本地。

### 重点变更

- 在线模式继续保持纯云端约束；混合模式则放宽前端限制，由后端统一处理云端失败后的本地兜底。

### 修复

- Windows 现在对消息提示和在线模式确认走原生系统弹窗，避免自绘子窗口底部圆角/按钮裁切，并让播放失败提示只显示错误消息正文，不再展示完整运行时 JSON。
- Windows 主窗口和自绘子窗口现在统一改成更接近 Fluent Design 的 Mica/Acrylic 视觉，主界面、登录窗口和确认类子窗口都使用新的玻璃化表面、按钮和标题栏样式。
- Windows 子窗口现在保留原生标题栏与关闭按钮，但不再强制使用半透明 Acrylic 背景，避免 `wails.localhost` 子页出现 502。
- 修复了桌面歌词窗口上下两行字号不一致的问题，两行现在会保持一致的主要字号。
- 统一了前端请求失败提示入口，失败时会优先显示实际错误内容，再回退到通用提示。

### 已知问题

- 暂无。
