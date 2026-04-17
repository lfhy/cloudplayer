//! 判断文本是否含 **带分:秒时间轴** 的 LRC 片段（与前端 `parseLrc` / amll 一致）。
//! 排除 `[!text]`、`[ti:]` 等仅以 `[` 开头但无时间戳的「伪 LRC」。

use regex::Regex;
use std::sync::OnceLock;

fn lrc_timestamp_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"\[\d+:\d{1,2}(?:[.,]\d{1,3})?\]").expect("lrc timestamp regex")
    })
}

/// 是否含至少一处 `[m…:ss]` / `[m…:ss.mmm]` 时间戳（分钟可为多位数）。
pub fn has_lrc_timestamp_tags(text: &str) -> bool {
    lrc_timestamp_regex().is_match(text)
}
