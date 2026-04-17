//! 歌词解析与载荷：统一 LRC 文本 + 可选逐字时间轴；播放页自动拉词见 [`crate::lyric_replace::fetch_song_lddc_enriched`]（QQ → 酷狗 → 网易云 → LRCLIB）。
//!
//! 自托管 [NeteaseCloudMusicApiEnhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced)
//! 时，在 `GET /lyric` 之前优先请求 `GET /lyric/new`：有 **YRC** 则逐字；否则若同包内已有行级 **lrc** 则直接使用，仅当仍无可用文本时再请求 `GET /lyric`。
//!
//! 在线试听等仍可用 [amll_lyric] 做 LRC/TTML 归一化；**QQ 音乐 QRC 解密后**在 [`crate::lddc_parse`] 中按 [LDDC](https://github.com/chenmozhijin/LDDC) 规则解析逐词，不经 amll YRC。

use std::io::Cursor;

use amll_lyric::lrc::{parse_lrc, stringify_lrc};
use amll_lyric::LyricLine;
use amll_lyric::ttml::parse_ttml;
use amll_lyric::yrc::parse_yrc;
use reqwest::Client;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, CONTENT_TYPE, REFERER, USER_AGENT};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::lrc_embedded::try_parse_embedded_word_lrc;
use crate::lrc_format::has_lrc_timestamp_tags;

fn lyrics_log(msg: impl AsRef<str>) {
    eprintln!("[lyrics] {}", msg.as_ref());
}

pub(crate) fn netease_portal_headers() -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert(
        USER_AGENT,
        HeaderValue::from_static(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ),
    );
    h.insert(REFERER, HeaderValue::from_static("https://music.163.com/"));
    h.insert(ACCEPT, HeaderValue::from_static("application/json, text/plain, */*"));
    h
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsFetchIn {
    /// 前端仍会带上；自动拉词已改走 LDDC 多源，不再使用曲库 id 拉词。
    #[allow(dead_code)]
    pub pjmp3_source_id: Option<String>,
    pub title: String,
    pub artist: String,
    #[allow(dead_code)]
    #[serde(default)]
    pub album: String,
    #[serde(default)]
    #[allow(dead_code)] // 预留：本地元数据歌词
    pub local_path: Option<String>,
    /// 秒，可选，用于 LRCLIB 匹配
    #[serde(default)]
    pub duration_seconds: Option<f64>,
}

/// 歌词载荷：统一 LRC 文本 + 可选逐字时间轴（毫秒，与 amll `LyricWord` 一致）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsPayload {
    pub lrc_text: String,
    pub word_lines: Option<Vec<WordLine>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WordLine {
    pub start_ms: u64,
    pub end_ms: u64,
    pub words: Vec<WordTiming>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WordTiming {
    pub start_ms: u64,
    pub end_ms: u64,
    pub text: String,
}

/// 从 amll 解析结果生成载荷；仅当至少一行含多个词时视为「逐字」可用（行级 LRC 为每行一词，不启用）。
pub(crate) fn lyric_lines_to_payload(lines: &[LyricLine<'_>]) -> LyricsPayload {
    let lrc_text = pack_lyrics_for_ui(stringify_lrc(lines));
    let has_word_timing = lines.iter().any(|l| l.words.len() > 1);
    let word_lines = if has_word_timing {
        Some(
            lines
                .iter()
                .map(|l| WordLine {
                    start_ms: l.start_time,
                    end_ms: l.end_time,
                    words: l
                        .words
                        .iter()
                        .map(|w| WordTiming {
                            start_ms: w.start_time,
                            end_ms: w.end_time,
                            text: w.word.to_string(),
                        })
                        .collect(),
                })
                .collect(),
        )
    } else {
        None
    };
    LyricsPayload {
        lrc_text,
        word_lines,
    }
}

pub(crate) fn line_only_payload(raw: String) -> LyricsPayload {
    if let Some(p) = try_parse_embedded_word_lrc(&raw) {
        return p;
    }
    LyricsPayload {
        lrc_text: pack_lyrics_for_ui(raw),
        word_lines: None,
    }
}

#[inline]
fn looks_like_lrc(text: &str) -> bool {
    has_lrc_timestamp_tags(text)
}

fn polish_lyrics_with_amll(input: &str) -> String {
    if let Some(p) = try_parse_embedded_word_lrc(input) {
        return p.lrc_text;
    }
    let lines = parse_lrc(input);
    if !lines.is_empty() {
        let s = stringify_lrc(&lines);
        if !s.trim().is_empty() {
            return s;
        }
    }
    let y_lines = parse_yrc(input);
    if !y_lines.is_empty() {
        let s = stringify_lrc(&y_lines);
        if !s.trim().is_empty() {
            return s;
        }
    }
    let trimmed = input.trim();
    if trimmed.starts_with("<?xml")
        || trimmed.contains("<tt ")
        || trimmed.contains("<ttml")
        || trimmed.contains("xmlns=\"http://www.w3.org/ns/ttml")
    {
        if let Ok(ttml) = parse_ttml(Cursor::new(input.as_bytes())) {
            if !ttml.lines.is_empty() {
                let s = stringify_lrc(&ttml.lines);
                if !s.trim().is_empty() {
                    return s;
                }
            }
        }
    }
    input.to_string()
}

/// 供前端 `parseLrc` 使用：经 amll_lyric 归一化为标准 LRC；无法解析时保留原文。
pub fn pack_lyrics_for_ui(raw: String) -> String {
    let polished = polish_lyrics_with_amll(&raw);
    if looks_like_lrc(&polished) {
        polished
    } else if looks_like_lrc(&raw) {
        raw
    } else {
        raw
    }
}

const LRC_CX_COVER: &str = "https://api.lrc.cx/cover";

/// Lrc.cx 封面：`GET https://api.lrc.cx/cover`（跟随重定向至 CDN 图片 URL）。
pub async fn fetch_lrc_cx_cover(
    client: &Client,
    title: &str,
    artist: &str,
    album: &str,
) -> Result<Option<String>, String> {
    let title = title.trim();
    let artist = artist.trim();
    let album = album.trim();
    let mut q: Vec<(&str, &str)> = Vec::new();
    if !title.is_empty() {
        q.push(("title", title));
    }
    if !artist.is_empty() {
        q.push(("artist", artist));
    }
    if !album.is_empty() {
        q.push(("album", album));
    }
    if q.is_empty() {
        return Ok(None);
    }
    let r = client
        .get(LRC_CX_COVER)
        .query(&q)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = r.status();
    let final_url = r.url().clone();
    let ct = r
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_lowercase();
    let body = r.bytes().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        lyrics_log(format!("lrc.cx cover http {}", status));
        return Ok(None);
    }
    let host = final_url.host_str().unwrap_or("");
    let path = final_url.path();
    if host == "api.lrc.cx" && path.contains("/cover") {
        lyrics_log("lrc.cx cover: no redirect off /cover");
        return Ok(None);
    }
    if ct.starts_with("image/") && !body.is_empty() {
        let u = final_url.to_string();
        lyrics_log(format!("lrc.cx cover ok (image) url={u}"));
        return Ok(Some(u));
    }
    if final_url.as_str().starts_with("http://") || final_url.as_str().starts_with("https://") {
        let u = final_url.to_string();
        if u.contains(".jpg")
            || u.contains(".jpeg")
            || u.contains(".png")
            || u.contains(".webp")
            || u.contains("music.126.net")
            || u.contains("/pic/")
        {
            lyrics_log(format!("lrc.cx cover ok url={u}"));
            return Ok(Some(u));
        }
    }
    lyrics_log("lrc.cx cover: unrecognized response");
    Ok(None)
}

/// 首行是否为 YRC / 部分 klyric 使用的 `[毫秒,毫秒]` 行头（区别于 `[mm:ss.xx]` LRC）。
fn first_line_looks_like_yrc_bracket(s: &str) -> bool {
    let first = s.trim().lines().next().unwrap_or("").trim_start();
    if !first.starts_with('[') {
        return false;
    }
    let Some(end) = first.find(']') else {
        return false;
    };
    let inside = &first[1..end];
    // 行级 LRC 时间戳含 `:`；YRC 行时间为纯数字与逗号
    if inside.contains(':') {
        return false;
    }
    inside.contains(',')
}

/// 从对象或裸字符串中取 `lyric` 字段或整段文本（YRC / 兼容 klyric 容器）。
fn try_value_yrc_like(node: &Value) -> Option<String> {
    let try_str = |s: &str| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    };
    if let Some(s) = node.as_str() {
        return try_str(s);
    }
    if let Some(s) = node.get("lyric").and_then(|x| x.as_str()) {
        return try_str(s);
    }
    None
}

/// 在一层 JSON 上尝试所有已知路径（`yrc` / `Yrc` / `result` 等）。
fn try_yrc_raw_from_lyric_new_layer(v: &Value) -> Option<String> {
    let try_str = |s: &str| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    };
    let try_value_yrc = |node: &Value| try_value_yrc_like(node);

    // 常见：字符串在固定路径上
    for ptr in [
        "/yrc/lyric",
        "/Yrc/lyric",
        "/body/yrc/lyric",
        "/body/Yrc/lyric",
        "/data/yrc/lyric",
        "/data/Yrc/lyric",
        "/result/yrc/lyric",
        "/result/Yrc/lyric",
        "/result/data/yrc/lyric",
        "/data/result/yrc/lyric",
        "/body/data/yrc/lyric",
        "/body/result/yrc/lyric",
        "/data/data/yrc/lyric",
    ] {
        if let Some(s) = v.pointer(ptr).and_then(|x| x.as_str()) {
            if let Some(t) = try_str(s) {
                return Some(t);
            }
        }
    }
    // 对象：根或嵌套下的 `yrc` / `Yrc`
    for key in ["yrc", "Yrc"] {
        if let Some(n) = v.get(key) {
            if let Some(t) = try_value_yrc(n) {
                return Some(t);
            }
        }
    }
    for ptr in [
        "/body/yrc",
        "/body/Yrc",
        "/data/yrc",
        "/data/Yrc",
        "/result/yrc",
        "/result/Yrc",
        "/body/data/yrc",
        "/body/data/Yrc",
        "/data/body/yrc",
        "/data/body/Yrc",
    ] {
        if let Some(n) = v.pointer(ptr) {
            if let Some(t) = try_value_yrc(n) {
                return Some(t);
            }
        }
    }
    // 部分上游把逐字放在 klyric，且内容为 YRC 括号格式（与行级 LRC 区分）
    for ptr in [
        "/klyric/lyric",
        "/body/klyric/lyric",
        "/data/klyric/lyric",
        "/result/klyric/lyric",
    ] {
        if let Some(s) = v.pointer(ptr).and_then(|x| x.as_str()) {
            if first_line_looks_like_yrc_bracket(s) {
                if let Some(t) = try_str(s) {
                    return Some(t);
                }
            }
        }
    }
    for ptr in ["/klyric", "/body/klyric", "/data/klyric", "/result/klyric"] {
        if let Some(n) = v.pointer(ptr) {
            if let Some(s) = try_value_yrc(n) {
                if first_line_looks_like_yrc_bracket(&s) {
                    return Some(s);
                }
            }
        }
    }
    None
}

/// 若 `body` / `data` / `result` / `payload` 为 JSON 字符串，解包后再解析一层（代理或网关常见）。
fn try_unwrap_json_string_child(v: &Value) -> Option<Value> {
    for key in ["body", "data", "result", "payload"] {
        if let Some(Value::String(s)) = v.get(key) {
            let t = s.trim();
            if t.starts_with('{') || t.starts_with('[') {
                if let Ok(inner) = serde_json::from_str::<Value>(t) {
                    return Some(inner);
                }
            }
        }
    }
    None
}

/// 从 `/lyric/new` 的 JSON 中取 YRC 原文（兼容 api-enhanced / Binaryify / 网关包装、大小写、部分 klyric）。
fn yrc_raw_from_lyric_new_json(v: &Value) -> Option<String> {
    fn depth(v: &Value, d: u8) -> Option<String> {
        if d > 4 {
            return None;
        }
        if let Some(t) = try_yrc_raw_from_lyric_new_layer(v) {
            return Some(t);
        }
        if let Some(inner) = try_unwrap_json_string_child(v) {
            if let Some(t) = depth(&inner, d + 1) {
                return Some(t);
            }
        }
        // `data` 为对象且内含 `body` 等 JSON 字符串时再剥一层
        if let Some(data_val) = v.get("data") {
            if let Some(inner) = try_unwrap_json_string_child(data_val) {
                if let Some(t) = depth(&inner, d + 1) {
                    return Some(t);
                }
            }
        }
        None
    }
    depth(v, 0)
}

/// 解析失败时打出简要诊断，便于对照自托管接口返回（官方常见 `nolyric` / `uncollected` / 空 `yrc.lyric`）。
fn log_lyric_new_yrc_miss(v: &Value) {
    let code = v.get("code").and_then(|x| x.as_i64());
    let nolyric = v.get("nolyric").and_then(|x| x.as_bool());
    let uncollected = v.get("uncollected").and_then(|x| x.as_bool());
    let yrc_status = match v.get("yrc") {
        None => "absent",
        Some(Value::Null) => "null",
        Some(Value::String(s)) if s.trim().is_empty() => "empty_str",
        Some(Value::String(_)) => "str_not_matched_by_parser",
        Some(obj) => {
            let has_lyric = obj.get("lyric").is_some();
            let lyric_empty = obj
                .get("lyric")
                .and_then(|x| x.as_str())
                .map(|s| s.trim().is_empty())
                .unwrap_or(true);
            match (has_lyric, lyric_empty) {
                (false, _) => "object_no_lyric_field",
                (true, true) => "object_lyric_empty",
                (true, false) => "object_lyric_nonempty_but_paths_failed",
            }
        }
    };
    lyrics_log(format!(
        "netease api lyric/new: no yrc text (code={code:?} nolyric={nolyric:?} uncollected={uncollected:?} top_yrc={yrc_status})"
    ));
    // REMOVE: temporary upstream dump for `/lyric/new` shape — delete this whole block once done.
    #[cfg(debug_assertions)]
    {
        const MAX: usize = 12_000;
        match serde_json::to_string(v) {
            Ok(s) if s.len() <= MAX => {
                lyrics_log(format!("netease api lyric/new: raw json (debug) {s}"));
            }
            Ok(s) => {
                let mut end = MAX.min(s.len());
                while end > 0 && !s.is_char_boundary(end) {
                    end -= 1;
                }
                lyrics_log(format!(
                    "netease api lyric/new: raw json (debug, truncated to {} of {} bytes) {}…",
                    end,
                    s.len(),
                    &s[..end]
                ));
            }
            Err(e) => lyrics_log(format!("netease api lyric/new: raw json (debug) serialize err {e}")),
        }
    }
}

/// 网易 `GET /lyric` 与 `GET /lyric/new` 响应里常见的行级 LRC 文本。
fn lrc_line_from_netease_lyric_value(v: &Value) -> Option<String> {
    let s = v
        .pointer("/lrc/lyric")
        .and_then(|x| x.as_str())
        .or_else(|| v.get("lrc").and_then(|x| x.as_str()))?;
    let t = s.trim();
    if t.is_empty() {
        None
    } else {
        Some(t.to_string())
    }
}

/// `GET {api_base}/lyric/new?id=`：优先 YRC 逐字；否则若同一份 JSON 里已有行级 `lrc`，直接使用（避免再请求 `GET /lyric`）。
async fn lyric_netease_api_lyric_new(
    client: &Client,
    api_base: &str,
    song_id: i64,
) -> Result<Option<LyricsPayload>, String> {
    let url = format!("{api_base}/lyric/new");
    lyrics_log(format!("netease api GET lyric/new id={song_id}"));
    let r = client
        .get(&url)
        .query(&[("id", song_id.to_string())])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !r.status().is_success() {
        lyrics_log(format!("netease api lyric/new http {}", r.status()));
        return Ok(None);
    }
    let v: Value = r.json::<Value>().await.map_err(|e| e.to_string())?;

    let yrc_raw = yrc_raw_from_lyric_new_json(&v);
    if let Some(ref raw) = yrc_raw {
        let lines = parse_yrc(raw);
        if !lines.is_empty() {
            let payload = lyric_lines_to_payload(&lines);
            if looks_like_lrc(&payload.lrc_text) {
                lyrics_log(format!(
                    "netease api yrc->lrc ok chars={} (from yrc chars={}) word_level={}",
                    payload.lrc_text.len(),
                    raw.len(),
                    payload.word_lines.is_some()
                ));
                return Ok(Some(payload));
            }
        }
        lyrics_log("netease api yrc: amll parse_yrc empty or not lrc-like, try line lrc in lyric/new");
    }

    if let Some(ly) = lrc_line_from_netease_lyric_value(&v) {
        if looks_like_lrc(&ly) {
            lyrics_log(format!(
                "netease api lyric/new: line lrc chars={} word_level=false (no usable yrc)",
                ly.len()
            ));
            return Ok(Some(line_only_payload(ly)));
        }
    }

    if yrc_raw.is_none() {
        log_lyric_new_yrc_miss(&v);
    }
    Ok(None)
}

/// 歌词替换：已知网易云歌曲 id（自托管 API 优先，否则门户单行 LRC）。
pub async fn fetch_netease_lyrics_by_song_id(
    client: &Client,
    api_base: Option<&str>,
    song_id: i64,
) -> Result<Option<LyricsPayload>, String> {
    if let Some(base) = api_base {
        let b = base.trim().trim_end_matches('/');
        if !b.is_empty() {
            match lyric_netease_api_lyric_new(client, b, song_id).await {
                Ok(Some(p)) => return Ok(Some(p)),
                Ok(None) => {}
                Err(e) => lyrics_log(format!("replace netease lyric/new: {e}")),
            }
            let lr = client
                .get(format!("{b}/lyric"))
                .query(&[("id", song_id.to_string())])
                .send()
                .await
                .map_err(|e| e.to_string())?;
            if lr.status().is_success() {
                let lj: Value = lr.json().await.map_err(|e| e.to_string())?;
                if let Some(ly) = lrc_line_from_netease_lyric_value(&lj) {
                    if looks_like_lrc(&ly) {
                        return Ok(Some(line_only_payload(ly)));
                    }
                }
            }
        }
    }
    let id_s = song_id.to_string();
    let lr = client
        .get("https://music.163.com/api/song/lyric")
        .headers(netease_portal_headers())
        .query(&[
            ("id", id_s.as_str()),
            ("lv", "-1"),
            ("kv", "-1"),
            ("tv", "-1"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !lr.status().is_success() {
        return Ok(None);
    }
    let lj: Value = lr.json().await.map_err(|e| e.to_string())?;
    if let Some(ly) = lrc_line_from_netease_lyric_value(&lj) {
        if looks_like_lrc(&ly) {
            return Ok(Some(line_only_payload(ly)));
        }
    }
    Ok(None)
}

/// LRCLIB：按内部 id 获取歌词。
pub async fn fetch_lrclib_by_id(client: &Client, lrclib_id: i64) -> Result<Option<LyricsPayload>, String> {
    let url = format!("https://lrclib.net/api/get/{lrclib_id}");
    let r = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !r.status().is_success() {
        return Ok(None);
    }
    let v: Value = r.json().await.map_err(|e| e.to_string())?;
    if let Some(s) = v.get("syncedLyrics").and_then(|x| x.as_str()) {
        if looks_like_lrc(s) {
            return Ok(Some(line_only_payload(s.to_string())));
        }
    }
    if let Some(s) = v.get("plainLyrics").and_then(|x| x.as_str()) {
        if looks_like_lrc(s) {
            return Ok(Some(line_only_payload(s.to_string())));
        }
    }
    Ok(None)
}
