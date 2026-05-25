# CloudPlayer Flutter

CloudPlayer Flutter 是 CloudPlayer 的 Flutter 客户端仓库，当前沿用旧 `cloudplayer-wails` 的 Go 后端能力，通过 Flutter 重建主界面与播放器交互。现阶段仍以 macOS / Windows 桌面体验为主，同时已经补齐 Android 平台工程与移动端安全启动路径，为后续 Android bridge 迁移预留入口。

## 下载使用

- 当前 Flutter 版仓库已经补齐 `v*` tag 触发的桌面 GitHub Actions 发布流，可产出 `macOS amd64 / arm64 / universal` 的 `zip + dmg`，以及 `Windows amd64` 的 `zip + installer.exe`。
- 发布入口位于 [`.github/workflows/release-desktop.yml`](./.github/workflows/release-desktop.yml)，推送版本标签后会并行构建各平台产物，并在同一条发布流里统一汇总到 GitHub Release。
- macOS 本地开发和构建依赖完整 `Xcode.app`，如果系统默认 `xcode-select` 仍指向 Command Line Tools，请显式指定 `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`。
- 当前仓库更偏向开发中的 Flutter 重构版本；如果你只是想直接使用成熟版本，建议同时关注旧 Wails 版仓库的 release 节奏。

## 功能概览

- 在线曲库搜索与播放。
- 首页、搜索、每日推荐、最近播放、歌单、导入、设置、下载管理等主页面已经接通。
- 歌单、每日推荐、最近播放和搜索结果复用统一曲目表格，支持点击歌手名或专辑名直接发起搜索。
- 曲目列表和底部播放区支持直接切换「我喜欢」，并同步内建歌单状态。
- 歌单详情支持批量模式，可多选并从当前歌单移除。
- 本地歌单、导入歌单、每日推荐保存为歌单，以及导入后补全播放信息。
- 导入流程已接通本地目录、分享链接、纯文本和酷狗歌单导入。
- 播放状态持久化已经恢复，播放队列、当前曲目、播放位置和时长可在重启后继续恢复。
- 沉浸模式、同窗口 `Mini` 模式和 macOS 原生桌面歌词已经接回。
- 桌面歌词已恢复旧版时间锚点和逐字高亮语义，逐字插值由 macOS 原生层完成。
- 偏好设置支持亮色 / 暗色主题切换、桌面歌词颜色设置和常用播放偏好。
- macOS 托盘已恢复左键显示主界面、右键菜单播放控制，以及跟随主题变化的默认封面占位。
- Windows 平台工程已经补齐，桥接层和发布脚本可直接参与 Windows 构建。
- Android 平台工程已经加入仓库，移动端会进入独立预览壳层，避免误触发桌面窗口、托盘和桌面歌词逻辑。

## 当前状态

- Flutter 前端位于 `lib/`，Go 业务后端位于 `backend/`，两者通过 `bridge/` 下的 `c-shared` 动态库桥接。
- Android 端当前只完成平台工程与移动端壳层适配；完整播放、搜索、歌单等能力仍需后续补齐 Android `.so` 打包与 bridge 装载链路。
- 当前主验证路径是 macOS，仓库规则要求最终集成验证使用 `flutter run -d macos`。
- 旧 Wails 版的大部分核心使用路径已经迁入，但下载实时事件流、部分子窗口流程和若干细节交互仍在继续补齐。

## 开发指南

### 环境要求

- Flutter 3.44+
- Go 1.23+
- macOS 可用的完整 Xcode.app
- CocoaPods
- Android 本机调试代理建议放在仓库根目录 `.env.local`；`make android-emulator` 和 `make android-run` 会自动加载它。

### 常用命令

```bash
make bridge
make smoke
make analyze
make test
make run
make android-emulator
make android-run
flutter analyze
dart run tool/bridge_smoke.dart
go test ./...
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer flutter run -d macos
flutter run -d android
```

其中：

- `make bridge` 会默认重建 macOS 通用版 Go `c-shared` bridge 动态库。
- `make bridge-universal` 会分别构建 `arm64` / `amd64` bridge，并用 `lipo` 合成 macOS 通用动态库。
- `make smoke` 会重建 bridge，并输出动态库路径、媒体代理基址和数据库状态。
- `make analyze` 会执行 `flutter analyze`。
- `make test` 会执行 `go test ./...`。
- `make run` 会先重建 bridge，再启动 Flutter macOS 桌面端。
- `make android-emulator` 会加载 `~/.zshrc` 和仓库根目录 `.env.local`，然后启动 `CloudPlayer_API_36` 模拟器。
- `make android-run` 会加载 `~/.zshrc` 和仓库根目录 `.env.local`，然后以 debug 模式启动 `emulator-5554`。
- `flutter run -d android` 当前会进入 Android 预览壳层，用于验证移动端工程、主题和平台分支是否正常。

### 目录结构

- `backend/`: 复用旧版 CloudPlayer 的 Go 业务实现。
- `bridge/`: Go `c-shared` 桥接层，导出给 Dart FFI 使用。
- `lib/`: Flutter 页面、状态管理、播放器、主题和窗口逻辑。
- `macos/Runner/`: macOS 原生窗口、托盘、桌面歌词等平台侧实现。
- `android/`: Android 原生工程与 Flutter Android embedding 入口。
- `tool/bridge_smoke.dart`: Dart 直连 Go bridge 的 smoke 验证脚本。
- `scripts/`: 发布和打包辅助脚本。

## GitHub 发布

- 推送 `v*` tag 后，GitHub Actions 会触发一条 `desktop-release` 工作流，并行构建 `macOS amd64`、`macOS arm64`、`macOS universal` 和 `Windows amd64` 产物。
- macOS 每个目标都会产出对应架构的 `zip + dmg`；Windows 会产出 `amd64` 的 `zip + installer.exe`。
- 所有成功构建出的资源会在最后一个 `publish` job 里统一汇总并发布到同一个 GitHub Release；也可以手动触发 workflow，并传入 `tag_name` 发布指定标签。

## 项目截图

### 主界面

![CloudPlayer 主界面](docs/screenshots/main-window.png)

## 当前限制

- 当前 Flutter 版仍在持续对齐旧 Wails 版的细节体验，部分子窗口流程和边角交互还没有完全做到 1:1。
- Android 端当前还是桌面优先架构下的预览适配模式，尚未接通 Go bridge 的移动端动态库打包与完整业务能力。
- 下载管理目前仍以前端镜像队列为主，旧版下载实时事件流尚未完整接回。
- 桌面歌词已经迁到 macOS 原生浮层，但围绕歌词的个别旧版独立窗口流程还没有全部恢复。

## 交流群

QQ群：`572532027`
