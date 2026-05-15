# CloudPlayer Changelog

使用方式：

- 日常开发时，把准备发版的内容持续补到 `## Unreleased` 下。
- 推 tag 触发 release 时，发布脚本会优先读取这个区块生成 release body。
- 发版完成后，运行 `./scripts/archive_unreleased_changelog.sh vX.Y.Z` 归档 `## Unreleased`，再继续在模板里累积下一版内容。

## Unreleased

### 本次更新

- 新增统一消息子窗口，在线模式下添加非酷狗云端歌曲到歌单时不再只弹浏览器式失败提示，而会展示明确原因。

### 重点变更

- 暂无。

### 修复

- 统一了前端请求失败提示入口，失败时会优先显示实际错误内容，再回退到通用提示。

### 已知问题

- 暂无。
