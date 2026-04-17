//! QQ 音乐解密后歌词：优先 [LDDC](https://github.com/chenmozhijin/LDDC) `qrc.py` / `yrc.py`；正文常为 **任意属性顺序** 的 `LyricContent="…"`。
//! 若仍无法识别，再回退 **amll `parse_yrc`**（QQ 客户端 YRC 与 LDDC 毫秒行格式不完全一致时仍能出逐字）。

use amll_lyric::lrc::stringify_lrc;
use amll_lyric::yrc::parse_yrc;
use regex::Regex;
use std::sync::OnceLock;

use crate::lrc_embedded::try_parse_embedded_word_lrc;
use crate::lyrics::{line_only_payload, lyric_lines_to_payload, LyricsPayload, WordLine, WordTiming};

fn re_qrc_lyric1() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(r#"<Lyric_1\s+LyricType="1"\s+LyricContent="(?s)(?P<c>.*?)"\s*/>"#)
            .expect("qrc lyric1")
    })
}

fn re_line_ms_pair() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"^\[(\d+),(\d+)\](.*)$").expect("line ms pair"))
}

fn re_qrc_word_ts() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"\((\d+),(\d+)\)").expect("qrc word"))
}

fn re_yrc_word_ts() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"\((\d+),(\d+),(\d+)\)").expect("yrc word"))
}

fn re_word_only_line() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"^\((\d+),(\d+)\)$").expect("word only"))
}

/// 任意顺序的 `LyricContent="..."`：返回 **所有** 匹配，调用方按需筛选。
fn extract_all_lyric_content_attrs(xml: &str) -> Vec<String> {
    let Some(re) = Regex::new(r#"(?is)LyricContent\s*=\s*"([^"]*)""#).ok() else {
        return Vec::new();
    };
    re.captures_iter(xml)
        .filter_map(|c| {
            let raw = c.get(1)?.as_str();
            let s = unescape_qrc_attr(raw);
            let t = s.trim().to_string();
            if t.is_empty() {
                None
            } else {
                Some(t)
            }
        })
        .collect()
}

fn unescape_qrc_attr(s: &str) -> String {
    s.replace("&quot;", "\"")
        .replace("&#10;", "\n")
        .replace("&#13;", "\r")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
}

fn fmt_lrc_line_ms(start_ms: u64, text: &str) -> String {
    let sec = start_ms / 1000;
    let ms_part = (start_ms % 1000) as u32;
    let m = sec / 60;
    let s = sec % 60;
    format!("[{:02}:{:02}.{:03}]{}", m, s, ms_part, text)
}

fn payload_from_word_lines(word_lines: Vec<WordLine>) -> Option<LyricsPayload> {
    if word_lines.is_empty() {
        return None;
    }
    let lrc_text: String = word_lines
        .iter()
        .map(|wl| {
            let display: String = wl.words.iter().map(|w| w.text.as_str()).collect();
            fmt_lrc_line_ms(wl.start_ms, &display)
        })
        .collect::<Vec<_>>()
        .join("\n");
    Some(LyricsPayload {
        lrc_text,
        word_lines: Some(word_lines),
    })
}

/// QRC 正文：`字(起始ms,时长ms)`，与 LDDC `qrc.py` 的 `_WORD_SPLIT_PATTERN` 一致。
fn qrc_line_to_words(line_content: &str, line_start: u64, line_end: u64) -> Vec<WordTiming> {
    let re = re_qrc_word_ts();
    let matches: Vec<_> = re.find_iter(line_content).collect();
    if matches.is_empty() {
        let t = line_content.to_string();
        if t.trim().is_empty() {
            return Vec::new();
        }
        return vec![WordTiming {
            start_ms: line_start,
            end_ms: line_end,
            text: t,
        }];
    }
    let mut words = Vec::new();
    let mut prev = 0usize;
    for m in &matches {
        let content = line_content[prev..m.start()].to_string();
        let caps = re.captures(m.as_str()).expect("qrc word caps");
        let w_start: u64 = caps[1].parse().unwrap_or(0);
        let w_dur: u64 = caps[2].parse().unwrap_or(0);
        if content != "\r" {
            words.push(WordTiming {
                start_ms: w_start,
                end_ms: w_start + w_dur,
                text: content,
            });
        }
        prev = m.end();
    }
    if words.is_empty() && !line_content.trim().is_empty() {
        words.push(WordTiming {
            start_ms: line_start,
            end_ms: line_end,
            text: line_content.to_string(),
        });
    }
    words
}

/// YRC 正文：`(起始ms,时长ms,0)正文`，与 LDDC `yrc.py` 的 `_WORD_SPLIT_PATTERN` 一致。
fn yrc_line_to_words(line_content: &str, line_start: u64, line_end: u64) -> Vec<WordTiming> {
    let re = re_yrc_word_ts();
    let matches: Vec<_> = re.find_iter(line_content).collect();
    if matches.is_empty() {
        let t = line_content.to_string();
        if t.trim().is_empty() {
            return Vec::new();
        }
        return vec![WordTiming {
            start_ms: line_start,
            end_ms: line_end,
            text: t,
        }];
    }
    let mut words = Vec::new();
    for i in 0..matches.len() {
        let m = matches[i];
        let caps = re.captures(m.as_str()).expect("yrc word caps");
        let w_start: u64 = caps[1].parse().unwrap_or(0);
        let w_dur: u64 = caps[2].parse().unwrap_or(0);
        let text_end = if i + 1 < matches.len() {
            matches[i + 1].start()
        } else {
            line_content.len()
        };
        let text = line_content[m.end()..text_end].to_string();
        words.push(WordTiming {
            start_ms: w_start,
            end_ms: w_start + w_dur,
            text,
        });
    }
    words
}

/// 公开版本：从 `lyric_qq` 中对整段解密明文直接按 QRC 正文行解析（不走 XML 提取）。
pub fn try_parse_qrc_inner_body_pub(s: &str) -> Option<LyricsPayload> {
    parse_qrc_inner_body(s)
}

fn parse_qrc_inner_body(inner: &str) -> Option<LyricsPayload> {
    let line_re = re_line_ms_pair();
    let word_only = re_word_only_line();
    let mut word_lines: Vec<WordLine> = Vec::new();
    let mut any = false;
    for raw_line in inner.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        let Some(cap) = line_re.captures(line) else {
            continue;
        };
        let Ok(line_start) = cap[1].parse::<u64>() else {
            continue;
        };
        let Ok(line_dur) = cap[2].parse::<u64>() else {
            continue;
        };
        let line_content = cap[3].to_string();
        let line_end = line_start + line_dur;
        any = true;
        if word_only.is_match(line_content.trim()) {
            word_lines.push(WordLine {
                start_ms: line_start,
                end_ms: line_end,
                words: vec![],
            });
            continue;
        }
        let words = qrc_line_to_words(&line_content, line_start, line_end);
        if words.is_empty() {
            continue;
        }
        word_lines.push(WordLine {
            start_ms: line_start,
            end_ms: line_end,
            words,
        });
    }
    if !any {
        return None;
    }
    payload_from_word_lines(word_lines)
}

fn parse_yrc_body(text: &str) -> Option<LyricsPayload> {
    let line_re = re_line_ms_pair();
    let mut word_lines: Vec<WordLine> = Vec::new();
    let mut any = false;
    for raw_line in text.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        if !line.starts_with('[') {
            continue;
        }
        let Some(cap) = line_re.captures(line) else {
            continue;
        };
        let Ok(line_start) = cap[1].parse::<u64>() else {
            continue;
        };
        let Ok(line_dur) = cap[2].parse::<u64>() else {
            continue;
        };
        let line_content = cap[3].to_string();
        let line_end = line_start + line_dur;
        any = true;
        let words = yrc_line_to_words(&line_content, line_start, line_end);
        if words.is_empty() {
            continue;
        }
        word_lines.push(WordLine {
            start_ms: line_start,
            end_ms: line_end,
            words,
        });
    }
    if !any {
        return None;
    }
    payload_from_word_lines(word_lines)
}

fn try_amll_yrc_payload(s: &str) -> Option<LyricsPayload> {
    let t = s.trim();
    if !t.contains('[') {
        return None;
    }
    let lines = parse_yrc(t);
    if lines.is_empty() {
        return None;
    }
    let payload = lyric_lines_to_payload(&lines);
    if payload.word_lines.is_some() {
        return Some(payload);
    }
    let polished = stringify_lrc(&lines);
    try_parse_embedded_word_lrc(&polished).or_else(|| {
        if crate::lrc_format::has_lrc_timestamp_tags(&polished) {
            Some(line_only_payload(polished))
        } else {
            None
        }
    })
}

/// 对单段已提取的 `LyricContent` 正文尝试 QRC → YRC → 增强 LRC → amll YRC。
fn try_parse_lyric_content_body(u: &str) -> Option<LyricsPayload> {
    if u.is_empty() {
        return None;
    }
    if let Some(p) = parse_qrc_inner_body(u) {
        return Some(p);
    }
    if let Some(p) = parse_yrc_body(u) {
        return Some(p);
    }
    if let Some(p) = try_parse_embedded_word_lrc(u) {
        return Some(p);
    }
    try_amll_yrc_payload(u)
}

/// QQ 解密/明文字符串：LDDC QRC/YRC → 增强 LRC → amll YRC（QQ 实际格式回退）。
pub fn try_lddc_qq_lyrics_plain(s: &str) -> Option<LyricsPayload> {
    let t = s.trim();
    if t.is_empty() {
        return None;
    }
    // 手机/新版 QRC XML 常含多个 `LyricContent`（如 QrcHeadInfo 空属性 + Lyric_1 正文）。
    // 遍历所有匹配，优先返回含逐字的结果。
    if t.contains("LyricContent") {
        let attrs = extract_all_lyric_content_attrs(t);
        let mut line_only_fallback: Option<LyricsPayload> = None;
        for inner in &attrs {
            if let Some(p) = try_parse_lyric_content_body(inner) {
                if p.word_lines.is_some() {
                    return Some(p);
                }
                if line_only_fallback.is_none() {
                    line_only_fallback = Some(p);
                }
            }
        }
        if let Some(fb) = line_only_fallback {
            return Some(fb);
        }
    }
    if t.contains("Lyric_1") && t.contains("LyricContent") {
        if let Some(cap) = re_qrc_lyric1().captures(t) {
            let inner = unescape_qrc_attr(cap.name("c").map(|m| m.as_str()).unwrap_or(""));
            if let Some(p) = parse_qrc_inner_body(inner.trim()) {
                return Some(p);
            }
        }
    }
    if t.lines().any(|l| {
        let x = l.trim();
        x.starts_with('[')
            && x
                .trim_start_matches('[')
                .split(']')
                .next()
                .is_some_and(|h| h.contains(',') && !h.contains(':'))
    }) {
        if let Some(p) = parse_yrc_body(t) {
            return Some(p);
        }
        if let Some(p) = parse_qrc_inner_body(t) {
            return Some(p);
        }
    }
    try_parse_embedded_word_lrc(t)
        .or_else(|| try_amll_yrc_payload(t))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn yrc_one_line_lddc_shape() {
        let s = "[1000,5000](100,200,0)你(300,400,0)好";
        let p = parse_yrc_body(s).expect("yrc");
        assert_eq!(p.word_lines.as_ref().unwrap().len(), 1);
        assert!(p.word_lines.as_ref().unwrap()[0].words.len() >= 2);
    }

    #[test]
    fn qrc_xml_with_empty_head_lyric_content() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?><QrcInfos><QrcHeadInfo SaveTime="1" Version="1" LyricContent=""/><LyricInfo><Lyric_1 LyricType="1" LyricContent="[16769,6624]你(16929,200)掌(17129,528)心(17657,248)的(17905,456)温(18361,896)度(19257,736)" /></LyricInfo></QrcInfos>"#;
        let p = try_lddc_qq_lyrics_plain(xml).expect("parse qrc xml");
        assert!(p.word_lines.is_some(), "should have word_lines");
        let wl = p.word_lines.as_ref().unwrap();
        assert_eq!(wl.len(), 1);
        assert!(wl[0].words.len() > 1, "should have multiple words");
    }

    #[test]
    fn qrc_body_direct_parse() {
        let body = "[16769,6624]你(16929,200)掌(17129,528)心(17657,248)";
        let p = parse_qrc_inner_body(body).expect("qrc inner");
        assert!(p.word_lines.is_some());
        let wl = p.word_lines.as_ref().unwrap();
        assert_eq!(wl[0].words.len(), 3);
        assert_eq!(wl[0].words[0].text, "你");
        assert_eq!(wl[0].words[1].text, "掌");
        assert_eq!(wl[0].words[2].text, "心");
    }
}
