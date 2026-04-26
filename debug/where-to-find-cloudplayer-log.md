# 如何获取 `cloudplayer.log`（诊断在线播放）

本版本在 Rust（`target: pj-play`）与前端 WebView（`log_play_event`）都会写入同一份 **`cloudplayer.log`**。

**应用标识（`src-tauri/tauri.conf.json` → `identifier`）是 `com.cloudplayer.app`（末尾是 `.app`，不是 `.com`）。**

## 先读你桌面日志里这一行的含义

若出现类似：

`resolve_online_play ok sid=206095113 via=download ... path_prefix=C:\Users\...\Music\CloudPlayer\鲸语 - 刘至佳.mp3`

表示 **`resolve_online_play` 优先命中了「下载目录里已有同名文件」**，走的是 **本地文件播放**，**不是**「纯在线解析直链」那条路。要和手机「只在线、未下载」对齐排障时，请任选其一：

- 临时**改名或移走** `Music\CloudPlayer` 里对应歌曲，再点在线播放；或  
- 换一首**从未下载过**的在线曲做对照。

否则桌面与手机的解析路径不一致，日志无法对比。

---

## 应用内查询确切路径（推荐）

任意端安装包启动后，后端提供命令 **`get_app_log_path`**，返回当前进程里 `cloudplayer.log` 的**绝对路径**（与启动时 `CloudPlayer x.x.x logging to ...` 那一行一致）。

在已连接调试的 WebView 控制台或临时测试按钮里调用即可；路径以设备上实际解析为准。

---

## Android（真机 / 模拟器 / 已 root）

Tauri 2 在 Android 上 `app_log_dir()` 解析为**应用数据分区下的 `logs` 目录**，真机日志里第一行会写明，例如：

```text
CloudPlayer 1.3.0 logging to /data/user/0/com.cloudplayer.app/logs/cloudplayer.log
```

**请以启动时这一行为准**（也可用命令 **`get_app_log_path`** 取当前设备的绝对路径）。

### 主路径（已与真机对照）

- **`/data/user/0/com.cloudplayer.app/logs/cloudplayer.log`**

说明：`/data/user/0/` 是用户 0 的应用数据根；**不是** `.../files/logs/`（之前文档写错，在此更正）。

**已 root / adb**：

```bash
adb shell su -c "ls -la /data/user/0/com.cloudplayer.app/logs/"
adb shell su -c "cat /data/user/0/com.cloudplayer.app/logs/cloudplayer.log"
adb pull /data/user/0/com.cloudplayer.app/logs/cloudplayer.log .
```

部分系统上 `/data/data/com.cloudplayer.app` 与 `/data/user/0/com.cloudplayer.app` 为同一路径的符号链接，但 **`logs` 在包目录下**，仍不在 `files/` 子目录里。

### 外置存储（不一定存在，仅作备选）

个别机型/权限下可能还有：

- `/sdcard/Android/data/com.cloudplayer.app/...`

若与上面 `logging to` 不一致，**以内部路径为准**。

### 仍没有文件时

- 确认安装的是**带文件日志**的版本（启动后日志里应出现 `logging to ...`）。  
- 若进程启动时创建日志目录失败，可能只有 logcat，需抓 `adb logcat` 里 Rust / `pj-play` 相关行。

确认包名：

```bash
adb shell pm list packages | grep -i cloud
```

---

## Windows 桌面

Tauri 2 的 `app_log_dir()` 在 Windows 上落在 **本机应用数据（Local）**，不在 `AppData` 根目录，也不在 **Roaming**。

- **`%LOCALAPPDATA%\com.cloudplayer.app\logs\cloudplayer.log`**
- 例：`C:\Users\<用户名>\AppData\Local\com.cloudplayer.app\logs\cloudplayer.log`

进入 **`AppData` → `Local`** → **`com.cloudplayer.app`** → **`logs`**。

若目录不存在：请先**安装并至少启动一次** CloudPlayer；成功初始化后才会创建 `cloudplayer.log`。

---

## 对照排障时请提供

1. **同一首歌**：在**排除本地下载命中**的前提下，桌面在线播一次 + 手机在线播一次，各一份 `cloudplayer.log`（或失败时刻前后各 ~200 行）。  
2. 日志中搜索：`pj-play`、`webview`、`resolve_online_play`、`download_mp3_bytes`。
