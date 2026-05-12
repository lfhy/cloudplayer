# CloudPlayer Wails

CloudPlayer Wails 是基于 Wails 3 的桌面音乐播放器，聚焦 macOS 桌面体验，同时保留在线曲库、歌词、下载、歌单导入、桌面歌词和快捷键等能力。

## 下载使用

- 前往 [GitHub Releases](https://github.com/lfhy/cloudplayer/releases) 下载对应平台安装包或压缩包。
- Windows 提供 `.zip` 便携版和 `installer.exe` 安装版，优先使用安装版；macOS 可下载 `.dmg` 或 `.zip` 版本。
- Windows 主窗口现在使用系统原生标题栏和透明系统背景，不再渲染自绘顶栏，并会跟随应用当前的浅色/暗色主题模式同步标题栏颜色。
- 开发、构建、发布和调试说明请参考 `DEV.md`。
- macOS 首次打开若提示“已损坏”，先执行：`xattr -dr com.apple.quarantine /Applications/CloudPlayer.app`

## 功能概览

- 在线曲库搜索与播放
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
- 在线模式：歌单、歌单内容和音乐源切到酷狗云端，并支持 12 小时缓存与手动刷新
- 播放状态持久化：播放队列、播放位置、歌曲时长和歌词进度可在重启后恢复，启动时进度会优先恢复显示
- 托盘、快捷键、窗口管理和主题设置

## 开发指南

- 环境要求、开发启动、构建命令、发布流程、目录结构和迁移说明请参考 `DEV.md`

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
