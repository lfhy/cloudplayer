# CloudPlayer Wails

- Dev helper: `node ./scripts/free-port.mjs <port> [more-ports...]` releases occupied IPv4, IPv6, loopback, and wildcard listeners on Windows and macOS before you rerun `wails3 dev`.
- Search now fails over to the next music source automatically when the active provider is unavailable.


CloudPlayer Wails 是基于 Wails 3 的桌面音乐播放器，聚焦 macOS 桌面体验，同时保留在线曲库、歌词、下载、歌单导入、桌面歌词和快捷键等能力。

## 下载使用

- 前往 [GitHub Releases](https://github.com/lfhy/cloudplayer/releases) 下载对应平台安装包或压缩包。
- Windows 提供 `.zip` 便携版和 `installer.exe` 安装版，优先使用安装版；macOS 可下载 `.dmg` 或 `.zip` 版本。
- macOS 发布包内现在附带 `fix_cloudplayer_quarantine.command`，双击后会执行 `xattr -dr com.apple.quarantine /Applications/CloudPlayer.app`。
- 发布说明草稿现在统一维护在 `CHANGELOG.md` 的 `## Unreleased` 区块，推 tag 时会优先用这段内容生成 release body；发版后可运行 `./scripts/archive_unreleased_changelog.sh vX.Y.Z` 归档。
- Windows 主窗口现在使用系统原生标题栏和透明系统背景，不再渲染自绘顶栏，并会跟随应用当前的浅色/暗色主题模式同步标题栏颜色。
- 开发、构建、发布和调试说明请参考 `DEV.md`。
- 开发模式现在会自动为 Vite 退避到下一个空闲端口，避免固定 `9245` 被占用时直接启动失败。
- macOS 首次打开若提示“已损坏”，先执行：`xattr -dr com.apple.quarantine /Applications/CloudPlayer.app`

## 功能概览

- 在线曲库搜索与播放
- 播放与暂停支持轻量淡入淡出，切换状态时更顺滑
- 设置页默认在线曲库渠道改为酷狗概念版，仍可手动切回泡椒音乐源
- 歌单详情支持批量模式，和搜索页保持一致的多选交互
- 本地歌单、云歌单、导入歌单与播放信息补全
- 歌单、每日推荐、最近播放和搜索结果复用统一曲目表格，支持点击歌手或专辑发起搜索
- 曲目列表和底部播放控件支持直接切换「我喜欢」，并与内建歌单状态同步
- 下载管理
- 边听边存：可在设置中开启播放在线歌曲时自动加入缓存下载队列
- 搜索首页支持按音乐风格快速检索，卡片每次随机展示 7 个并固定保留“随便听听”
- 歌词聚合、替换、缓存和桌面歌词显示
- 酷狗相关登录与歌单导入能力
- 三态歌单模式：
  `离线模式` 使用本地歌单与本地「我喜欢」；
  `在线模式` 直接使用酷狗云端歌单与云端「我喜欢」并支持 12 小时缓存；
  `混合模式` 会把云歌单 fork 到本地，刷新时继续从云端拉新歌，写入类操作优先回写云端，失败时保留本地副本
- 播放状态持久化：播放队列、播放位置、歌曲时长和歌词进度可在重启后恢复，启动时进度会优先恢复显示
- 托盘、快捷键、窗口管理和主题设置
- 主窗口关闭确认现在会弹出独立子窗口，而不是覆盖在主界面里的拟态框
- 登录账号子窗口会根据当前内容状态自动收缩尺寸，避免登录后留下大块空白
- 登录账号子窗口现在可直接执行导入歌单、退出登录，以及切换离线 / 在线 / 混合三种歌单模式
- 登录账号、关闭主窗口、在线模式确认和统一消息提示这些独立子窗口弹出时，会自动居中到主窗口附近，并在主窗口上加灰色遮罩直到子窗口消失
- 在线模式下如果歌曲不属于酷狗云端，添加到云歌单或写入「我喜欢」失败时会弹出统一消息子窗口，直接说明失败原因
- Mini 模式回到主窗口内布局，同时保留独立的 Mini 置顶偏好
- 歌单详情、搜索结果、每日推荐、最近播放和首页列表会同步高亮当前曲目；再次点击当前曲目时会直接切换播放或暂停
- 前端内置思源黑体 SC，尽量统一 Windows 和 macOS 的文字观感

## 开发指南

- 环境要求、开发启动、构建命令、发布流程、目录结构和迁移说明请参考 `DEV.md`
- 图标调色可直接打开本地工具页 `build/icon-color-lab.html`

## 项目截图

### 主界面

![CloudPlayer 主界面](docs/screenshots/image1.png)

### 沉浸模式

![CloudPlayer 沉浸模式](docs/screenshots/image2.png)

### Mini 模式

![CloudPlayer Mini 模式](docs/screenshots/image3.png)

### 歌单列表

![CloudPlayer 歌单列表](docs/screenshots/image4.png)

### 桌面歌词与菜单歌词

![CloudPlayer 桌面歌词与菜单歌词](docs/screenshots/image5.png)

### 交流群

QQ群：`572532027`

![CloudPlayer 交流群二维码](docs/screenshots/qrcode.jpg)
## Playback diagnostics

- Remote media proxy now uses a streaming HTTP client without the shared 45s total timeout, which prevents long audio playback from being cut off mid-stream.
- App logs now capture remote media fetch start/status/copy failures and richer audio-element diagnostics, making Windows playback failures easier to trace.
- Each desktop app launch now also writes a separate `session-YYYYMMDD-HHMMSS-pid.log`, so support traces still exist even if the shared `cloudplayer.log` is not updated.
- Track switches now update the player to the next song immediately, only show `加载中...` if the source resolution lingers, and surface playback failure reasons inline in the player subtitle instead of opening a native alert.

## Windows window chrome

- Windows now runs the main window and standard child windows with a shared custom titlebar, so the native caption buttons are hidden and replaced by the in-app controls.
- The main window keeps minimize / maximize / close, while standard child windows now only keep a close button in the custom titlebar.
- macOS keeps the existing native titlebar behavior, while Windows child windows such as account center, close confirm, online-mode confirm, and lyrics replace now use the same frameless top bar.
- Windows custom-chrome windows now keep the native Win11 outer frame styling, so the app surface gets a visible rounded-corner silhouette instead of only rounding inner panels.
- Windows main and child windows now also use a Fluent-style Mica/Acrylic surface treatment, so the shell, account-login window, and compact dialogs share the same glassier Win11 look.

## Kugou playback recovery

- Kugou login status now auto-runs the daily listen-song / VIP refresh path when the saved session is still valid, with a cooldown to avoid hammering the API after a failed attempt.
- Kugou playback no longer treats one-minute preview URLs as normal full-track playback. When a real full-track URL is unavailable, CloudPlayer falls back to a PJMP3 match instead of staying stuck on the expired Kugou source.
- Switching the default source, toggling online mode, logging into Kugou, or logging out of Kugou now clears the persisted playback queue and resume snapshot so stale online `source_id` values do not poison later playback attempts.

## Recent plays and dock polish

- Failed track switches now clear the previous seek state before loading the target source, so a broken next track does not keep showing the last song's progress.
- Recent plays can now be cleared from both the home screen and the recent page, and the action removes the persisted `recent_plays` history instead of only clearing the current session list.
- The main dock volume slider now uses a thicker track and thumb so it is easier to grab on desktop.

## Netease source and playback fallback

- CloudPlayer now includes a built-in `netease` music source provider implemented locally, based on the request flow of `chaunsin/netease-cloud-music` without importing that library directly.
- Preferences now let you choose `kugou`, `pjmp3`, or `netease` as the default online source, and also configure the playback fallback chain order visually.
- When the current source cannot resolve a playable track, CloudPlayer now retries other configured providers in order instead of failing immediately on the first source.
- Playback failure messages shown in the main player now prefer a short Chinese summary, while detailed provider-level failure reasons are written to the desktop app logs.
- Preferences now include a `查看详细日志` entry that opens the app log location directly for diagnostics.
