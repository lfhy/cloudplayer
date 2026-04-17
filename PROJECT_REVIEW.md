# CloudPlayer Tauri 项目审查报告

- 审查日期：2026-04-15
- 最近更新：2026-04-16（第二轮冗余代码优化已合并）
- 审查范围：前端（`src/`）、Tauri 配置与权限（`src-tauri/tauri.conf.json`、`src-tauri/permissions/`）、后端命令与核心模块（`src-tauri/src/`）
- 审查方式：静态代码审查 + 本地构建验证尝试

## 结论摘要

当前项目功能结构清晰、模块边界基本合理，但存在 1 个高风险安全配置问题和 2 个中风险功能/稳定性问题，建议优先处理安全配置与 ACL 缺口。

## 主要发现（按严重级别）

### 1) 高风险：Tauri 安全面过宽（`csp: null` + 资产协议全路径）

- 证据：`src-tauri/tauri.conf.json:23`、`src-tauri/tauri.conf.json:26`
- 现状：
  - `"csp": null`
  - `assetProtocol.scope` 包含 `"**"`（同时包含 `$HOME/**`）
- 影响：一旦渲染层出现注入点（或第三方资源被污染），攻击面将显著扩大，可能触达本地文件资源与高权限 IPC 能力。
- 建议：
  - 启用并收紧 CSP（至少限制脚本来源为 `self`，避免内联脚本执行）。
  - 将 `assetProtocol.scope` 缩小到最小必要目录（例如仅缓存/下载目录），移除 `"**"`。

### 2) 中风险：主窗口 ACL 缺少已调用命令，导致功能静默失效

- 证据：
  - 前端调用：`src/main.js:2177`（`invoke("fetch_lrc_cx_cover")`）
  - 命令已注册：`src-tauri/src/lib.rs:141`
  - ACL 未放行：`src-tauri/permissions/main-app.toml:4`
- 现状：`allow-main-app` 的 `commands.allow` 中缺少 `fetch_lrc_cx_cover`。
- 影响：播放时自动补封面逻辑会因为权限拒绝失败，前端仅 `console.warn`，用户侧表现为“偶发无封面”。
- 建议：在 `allow-main-app` 增加 `"fetch_lrc_cx_cover"`，并在前端对权限拒绝错误给出可观测提示（可选）。

### 3) 中风险：下载实现并未流式写盘，存在高内存占用风险

- 证据：`src-tauri/src/download.rs:357`、`src-tauri/src/download.rs:375`
- 现状：使用 `resp.bytes().await` 一次性读入完整音频，再 `write_all` 落盘。
- 影响：大文件（尤其 FLAC）下载时内存峰值高，可能导致卡顿或失败；同时进度反馈不够精细。
- 建议：改为 `bytes_stream()` 分块写入文件，边下边写并更新进度。

### 4) 低风险：README 与实际打包配置不一致

- 证据：
  - 文档写法：`README.md:75`（示例为 `bundle.active = false`、`targets = all`）
  - 实际配置：`src-tauri/tauri.conf.json:31`（`active = true`）、`src-tauri/tauri.conf.json:32`（`targets = nsis`）
- 影响：发布流程说明容易误导维护者。
- 建议：同步更新 README 的“当前配置”片段。

## 构建验证结果

以下命令已尝试，但受当前环境限制未完成：

1. `npm run build`
- 结果：失败（`spawn EPERM`，esbuild 子进程拉起失败）

2. `cargo check --manifest-path src-tauri/Cargo.toml`
- 结果：失败（`src-tauri/target/debug/.cargo-lock` 打开被拒绝，`os error 5`）

## 审查备注

- 本次为静态审查，未执行端到端 UI 回归。
- 建议先修复第 1、2 项后再进行一次完整构建与功能回归（搜索、播放、封面补全、下载）。

## 第二轮冗余优化（2026-04-16，已实施）

本轮已直接在 `src/main.js` 做无行为变化重构，目标是减少重复代码、降低后续维护成本。

### A) 表格提示行渲染去重（空态/加载态/错误态）

- 新增公共函数：`src/main.js:517` `setTableMutedMessage(tbody, colSpan, message)`
- 已替换页面：
  - 歌单详情空态：`src/main.js:1680`
  - 搜索页空态/加载态/错误态：`src/main.js:2073`、`src/main.js:2109`、`src/main.js:2117`
  - 下载队列空态：`src/main.js:2337`
  - 最近播放空态：`src/main.js:2386`
  - 本地曲库加载态/空态/错误态：`src/main.js:2404`、`src/main.js:2410`、`src/main.js:2426`

### B) 歌单列表读取复用现有缓存函数

- `refreshPlaylistSelect` 改为复用 `listPlaylistsCached`，移除重复 `invoke + try/catch`。
- 位置：`src/main.js:646`、`src/main.js:1582`、`src/main.js:1590`

### C) 桌面歌词样式同步调用去重

- `loadSettings` 中的重复 `broadcastDesktopLyricsLock/Colors` 调用改为复用已有 `scheduleDesktopLyricsStyleSync`。
- 位置：`src/main.js:1444`、`src/main.js:2796`

### D) 本轮验证

- 已执行：`node --check src/main.js`
- 结果：通过（语法无报错）

## QQ QRC 逐字歌词解密修复（2026-04-16，已实施）

### 问题现象

播放"王铮亮 - 旅人"时，酷狗源能返回逐字（word-level）歌词，但 QQ 音乐源只返回行级（line-only）歌词。经 LDDC 对比确认，两个源实际拥有相同的逐字歌词数据。

### 根因分析

QQ 音乐的 QRC 格式使用 Hex 编码 → **自定义 Triple-DES 解密** → Zlib 解压 → XML 的流程。

最初使用 Rust `des` crate（标准 DES 实现）进行解密，始终产出损坏的数据（zlib: corrupt deflate stream）。经逐步添加日志定位到 3DES 解密环节后，深入分析 LDDC 源码（`tripledes.py`，移植自 [QQMusicDecoder](https://github.com/WXRIW/QQMusicDecoder) C#）发现：

1. **S-box 被篡改**：QRC 使用的 S-box 与标准 DES 不同，至少 S-box 2（第 2 行第 8 位：标准 `14`，QRC `15`）和 S-box 4（第 4 行第 6 位：标准 `1`，QRC `10`）存在差异。
2. **字节序非标准**：`bitnum()` 函数以 `[3,2,1,0,7,6,5,4]` 的顺序（每 4 字节反转）访问输入字节，而非标准的 `[0,1,2,3,4,5,6,7]`。

这两处改动意味着**标准 DES 库无论如何无法正确解密 QRC**，单纯翻转输入/输出字节也不行。

### 修复方案

将 LDDC 的自定义 3DES 完整移植为 Rust 原生实现：

| 变更文件 | 说明 |
|---|---|
| `src-tauri/src/qrc_des.rs`（**新增**） | 完整实现 QRC 专用 3DES：非标准 S-box、非标准字节序 `bitnum`、16 轮 Feistel 网络、EDE3 密钥调度 |
| `src-tauri/src/lyric_qq.rs` | `qrc_decrypt_hex()` 改用 `qrc_des::QrcTripleDes` 替代标准 `des` crate；移除 `cipher`/`des` 相关 import |
| `src-tauri/src/lddc_parse.rs` | `extract_lyric_content_attr_first` → `extract_all_lyric_content_attrs`（返回所有 `LyricContent` 匹配），`try_lddc_qq_lyrics_plain` 遍历全部匹配并优先返回含逐字结果 |
| `src-tauri/src/lib.rs` | 注册 `mod qrc_des` |
| `src-tauri/Cargo.toml` | 移除不再需要的 `cipher = "0.4"` 和 `des = "0.8"` 依赖 |

### 调试过程时间线

1. **初次修复**：重构 `LyricContent` XML 提取逻辑（从取第一个改为遍历所有匹配），未解决问题。
2. **添加日志**：在 `lyric_qq.rs` 关键路径添加 `[lyric_qq]` 前缀日志，确认 `is_hex=true` 但 `qrc_decrypt_hex FAILED: zlib: corrupt deflate stream`。
3. **尝试字节翻转**：参考 LDDC `bitnum` 函数加入 `swap4` 字节翻转，`first4` 变化但仍非合法 zlib header。
4. **发现 S-box 差异**：逐字对比 LDDC `tripledes.py` 与标准 DES S-box，确认 QRC 使用修改版 S-box，标准 DES 库无法适用。
5. **完整移植**：将 LDDC 自定义 3DES 移植为 `qrc_des.rs`，解密成功。

### 验证结果

```
[lyric_qq] qrc decrypt ok chars=7068
  preview="<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<QrcInfos>..."
[lyric_qq] qrc_plain_to_payload → word-level OK
[lyric_qq] QRC request → payload word_level=true
[lyric_replace] auto verify qq: fetch ok lrc_chars=1696 word_level=true word_lines_rows=Some(37)
[lyric_replace] auto verify: RETURN word-level from qq
```

QQ 源成功返回 37 行逐字歌词，与酷狗源一致。
