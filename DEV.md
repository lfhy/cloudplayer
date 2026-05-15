# CloudPlayer Wails 开发指南

面向开发者的环境准备、启动方式、构建发布和目录说明统一放在这里。普通用户下载与使用请参考 `README.md`。

## 环境要求

- Go `1.25.0`
- Node.js 和 npm
- Wails 3 CLI

安装 Wails 3 CLI：

```bash
go install github.com/wailsapp/wails/v3/cmd/wails3@latest
```

确保 `wails3` 已经在命令行可用。

## 快速开始

1. 克隆仓库：

```bash
git clone https://github.com/lfhy/cloudplayer.git
cd cloudplayer/src-wails
```

2. 安装前端依赖：

```bash
cd frontend
npm install
cd ..
```

3. 启动开发模式：

```bash
node ./scripts/dev-with-port.mjs
```

如果希望使用项目内封装好的任务，也可以直接运行：

```bash
task dev
```

## 常用命令

开发模式：

```bash
node ./scripts/dev-with-port.mjs
```

这个包装脚本会优先使用 `9245`，如果端口已被占用，就自动顺延到下一个空闲端口，并把同一个端口同时传给 `wails3 dev` 和 Vite，避免 `vite --strictPort` 直接报错退出。

开发构建：

```bash
wails3 build DEV=true
```

前端开发构建：

```bash
cd frontend
npm run build:dev -q
```

Go 后端构建：

```bash
go build -o bin/codex-smoke-test .
rm -f bin/codex-smoke-test
```

Task 任务入口：

```bash
task dev
task build
task package
wails3 task release:desktop
wails3 task release:github
```

## 发布与打包

桌面多平台发布包：

```bash
./scripts/build_desktop_packages.sh
```

默认会输出以下目标：

- `windows/amd64`
- `windows/arm64`
- `macos/amd64`
- `macos/arm64`

产物会整理到 `bin/releases/` 下，Windows 默认生成 NSIS 安装包，macOS 会保留 `.app`，并额外输出 `.zip` 与 `.dmg`。macOS 的 `.zip` 和 `.dmg` 内都会附带 `fix_cloudplayer_quarantine.command`，双击后可执行 `xattr -dr com.apple.quarantine /Applications/CloudPlayer.app`。

当目标同时包含 `windows/amd64` 和 `windows/arm64` 时，脚本还会额外生成一个双架构 NSIS 安装包：

- `bin/releases/windows/dual/cloudplayer-windows-amd64-arm64-installer.exe`

当命令包含 `--include-macos-universal` 时，还会额外生成一套 macOS universal 产物：

- `bin/releases/macos/universal/cloudplayer-darwin-universal.dmg`
- `bin/releases/macos/universal/cloudplayer-darwin-universal.zip`

常见示例：

```bash
# 只打 macOS 双架构
./scripts/build_desktop_packages.sh --targets macos/amd64,macos/arm64

# 只打 Windows 双架构
./scripts/build_desktop_packages.sh --targets windows/amd64,windows/arm64

# 只打 Windows 双架构，但跳过 combined installer
./scripts/build_desktop_packages.sh --targets windows/amd64,windows/arm64 --skip-windows-dual

# 同时额外生成 macOS universal 包
./scripts/build_desktop_packages.sh --include-macos-universal

# 直接生成适合 GitHub Releases 上传的一整套桌面产物
wails3 task release:github

# 只打印将执行的命令
wails3 task release:desktop:dry-run
```

GitHub Actions 自动发布：

- Workflow 文件：`.github/workflows/release-desktop.yml`
- 触发方式：推送 `v*` tag，或手动触发并填写 `tag_name`
- 发布内容：Windows `amd64` / `arm64` 的 `.zip` 与 `installer.exe`，以及 macOS `amd64` / `arm64` / `universal` 的 `.dmg`
- 发布正文：优先读取 `CHANGELOG.md` 里的 `## Unreleased` 区块；如果该区块还是模板占位，再回退为按 tag 范围里的提交信息自动生成中文更新日志
- macOS 首次打开若提示“已损坏”，release 正文会优先提示用户双击包内的 `fix_cloudplayer_quarantine.command`，并保留手动 `xattr -dr com.apple.quarantine /Applications/CloudPlayer.app` 作为备用方案

建议流程：

1. 日常开发时，把准备发版的内容持续补到 `CHANGELOG.md` 的 `## Unreleased` 下。
2. 准备推 tag 前，检查 `本次更新 / 重点变更 / 修复 / 已知问题` 四段内容是否齐全。
3. tag 发布完成后，运行 `./scripts/archive_unreleased_changelog.sh vX.Y.Z` 把这段内容归档到对应版本小节，并重置 `## Unreleased` 模板。

Windows 打包前需要安装 `makensis`；如果在非 macOS 主机上构建 macOS 包，则还需要 Docker 和 `wails-cross` 镜像：

```bash
wails3 task setup:docker
```

补充说明：

- Windows 版本现在使用纯 Go 的 SQLite 驱动，不再依赖 CGO 才能正常启动。
- Windows 安装器默认目录为 `C:\Program Files\CloudPlayer`。

## 目录结构

```text
.
├── main.go
├── backend/
├── frontend/
├── build/
├── bin/
└── Taskfile.yml
```

### Backend

后端已经按职责拆分，不再使用旧的 `internal/cloudplayer` 或 `backend/core/cloudplayer` 结构。

- `backend/app`
  Wails 应用壳层、生命周期、前端绑定入口和按功能拆分的服务方法。
- `backend/state`
  应用共享状态、播放状态和运行时上下文。
- `backend/cache`
  搜索、歌词等缓存能力。
- `backend/desktop`
  桌面歌词窗口、托盘和桌面相关能力。
- `backend/hotkeys`
  全局快捷键注册与调度。
- `backend/model`
  共享数据模型。
- `backend/config`
  本地配置和用户偏好持久化。
- `backend/db`
  SQLite 初始化、迁移和访问。
- `backend/download`
  下载任务调度和 provider 集成。
- `backend/lyrics`
  歌词解析、聚合、过滤、缓存。
- `backend/musicsource`
  在线曲库 provider 抽象和实现。
- `backend/importplaylist`
  导入歌单解析。
- `backend/importenrich`
  导入结果补全和 enrich 流程。
- `backend/sharelink`
  分享链接解析。
- `backend/httpclient`
  网络访问封装。
- `backend/systemproxy`
  系统代理能力。
- `backend/captcha`
  验证码相关支持。
- `backend/pjmp3`
  PJMP3 相关能力。
- `backend/ratelimiter`
  限流工具。

### Frontend

前端遵循“按类型优先，再按功能拆分”的组织方式：

- `frontend/src/app`
  应用入口、运行时接线和基础辅助模块。
- `frontend/src/pages`
  页面级结构。
- `frontend/src/components`
  通用组件。
- `frontend/src/features`
  按业务能力拆分的前端逻辑，例如 `player`、`lyrics`、`search`、`library`、`settings`、`download`。
- `frontend/src/windows`
  独立窗口逻辑，例如桌面歌词和换歌词窗口。
- `frontend/src/styles`
  按核心、布局、页面、窗口和组件拆分的样式。
- `frontend/src/wails`
  Wails 绑定与事件桥接。

## 开发约定

- 手写代码文件尽量保持单一职责，接近 300 行就继续拆分。
- 后端按功能拆 service 和 helper，不再堆在单个大文件里。
- 前端入口文件保持轻量，页面和窗口逻辑尽量下沉到模块。
- 构建产物不要写到仓库根目录，使用 `bin/` 或工具默认目录。
- 新增 feature 时，同步更新 `README.md`，保证功能说明与当前实现一致。

## 迁移说明

如果你看到旧文档、旧讨论或旧分支里提到下面这些路径，它们都已经过时：

- `internal/cloudplayer/...`
- `backend/core/cloudplayer/...`
- 根目录下的 `cloudplayer_service_*.go`

当前代码已经改为 `backend/*` 多包拆分结构。
