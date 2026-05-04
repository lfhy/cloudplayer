# CloudPlayer Wails

CloudPlayer Wails 是基于 Wails 3 重构的桌面音乐播放器版本，聚焦 macOS 桌面体验、歌词能力、在线曲库接入与本地/导入歌单管理。

本仓库当前内容以 `src-wails` 为独立项目根目录维护，和上游 Tauri 版本分离演进。

## 上游基线

- Upstream 项目：`blackchoice/cloudplayer-tauri`
- Upstream 仓库：<https://github.com/blackchoice/cloudplayer-tauri>
- 当前参考基线：`blackchoice/cloudplayer-tauri@01ac13eada3b0e67f050e2cf79336e9c073f6959`
- Wails 版本：`github.com/wailsapp/wails/v3 v3.0.0-alpha.74`

说明：本仓库不会继续作为 GitHub fork 关系同步，而是独立维护 Wails 版本实现；上游 Tauri 仓库主要作为功能迁移与交互参考来源。

## 项目特点

- 基于 Wails 3 的桌面端实现，聚焦 macOS 使用体验
- 独立的主窗口、桌面歌词窗口、换歌词窗口、托盘播放器窗口
- 支持在线曲库搜索、本地歌单、导入歌单、下载管理
- 支持酷狗概念版登录、酷狗歌单导入与在线能力接入
- 支持歌词聚合、歌词替换、歌词持久化缓存与桌面歌词显示
- 支持主题、代理、快捷键、桌面歌词样式等偏好设置

## 项目架构

### 后端

- `main.go`
  - 应用入口与 Wails 生命周期绑定
- `cloudplayer_service_*.go`
  - 按领域拆分的服务层，对前端暴露绑定接口
  - 例如播放、设置、歌词、歌单、酷狗登录、下载等
- `internal/cloudplayer/`
  - `config/`：本地配置与登录态持久化
  - `db/`：SQLite 初始化与迁移
  - `download/`：下载调度与 provider 分发
  - `lyrics/`：歌词聚合、过滤、解析、缓存相关实现
  - `musicsource/`：在线曲库 provider 抽象与 Kugou/PJMP3 实现
  - `importplaylist/` / `importenrich/`：导入歌单解析与补全
  - `sharelink/`：分享链接解析
  - `httpclient/` / `systemproxy/`：代理与网络访问能力

### 前端

前端遵循“按类型优先、按功能拆分”的结构：

- `frontend/src/pages`
  - 页面模板与页面级结构
- `frontend/src/components`
  - 通用组件
- `frontend/src/features`
  - 以业务功能拆分的控制器与状态逻辑
  - 例如 `player/`、`lyrics/`、`search/`、`library/`、`settings/`
- `frontend/src/windows`
  - 独立窗口逻辑
  - 当前包含 `desktopLyrics/` 与 `lyricsReplace/`
- `frontend/src/styles`
  - 按 `core/layout/components/pages/windows` 分层组织样式
- `frontend/src/wails`
  - Wails 绑定与事件桥接

### 数据与缓存

- 本地数据库：SQLite
- 歌词缓存：内存缓存 + 持久化缓存
- 搜索缓存：后端统一缓存，支持 TTL
- 远程媒体代理：统一通过后端代理访问封面、头像与音频资源

## 开发说明

### 环境要求

- Go `1.25.0`
- Node.js / npm
- Wails 3 CLI

### 常用命令

开发模式：

```bash
wails3 dev
```

构建：

```bash
wails3 build DEV=true
```

仅构建前端：

```bash
cd frontend
npm run build:dev -q
```

## 目录约束

- 所有手写代码文件尽量保持在 300 行以内
- 前端按类型分目录、按功能拆文件
- 后端按职责拆分服务与 helper
- 生成文件目录如 `frontend/bindings`、`frontend/dist`、`frontend/node_modules` 不纳入手写文件约束

## 交流

欢迎加入 QQ 群交流：`572532027`

群名称如果后续有调整，以仓库最新 README 为准。
