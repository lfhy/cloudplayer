//! 下载落盘后探测本地音频时长与专辑（用于「下载歌曲」列表）。
use std::path::Path;

use lofty::prelude::*;

/// 返回 `(duration_ms, album)`；读取失败时 `(0, "")`。
pub fn probe_audio_file(path: &Path) -> (i64, String) {
    let Ok(file) = lofty::read_from_path(path) else {
        return (0, String::new());
    };
    let d = file.properties().duration();
    let dur_ms = d.as_millis().min(i64::MAX as u128) as i64;
    let album = file
        .tags()
        .iter()
        .find_map(|t| t.album().map(|a| a.to_string()))
        .unwrap_or_default();
    (dur_ms, album)
}
