//! LDDC / 增强 LRC：一行内多个 `[mm:ss.xxx]` 时间戳（逐词/逐字），避免被当成单行文本。
//!
//! 与 `amll_lyric::lrc::parse_lrc` 行级解析不同：本模块按时间戳切分为 [`WordTiming`]，再组装为 [`WordLine`]。

use regex::Regex;
use std::sync::OnceLock;

use crate::lyrics::{LyricsPayload, WordLine, WordTiming};

fn lrc_ts_regex() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(r"\[(\d+):(\d{1,2})(?:[.,](\d{1,3}))?\]").expect("lrc ts regex")
    })
}

fn cap_to_ms(cap: &regex::Captures<'_>) -> u64 {
    let min: u64 = cap.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
    let sec: u64 = cap.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
    let frac_ms: u64 = cap
        .get(3)
        .map(|m| {
            let s = m.as_str();
            let mut pad = format!("{:0<3}", s);
            pad.truncate(3);
            pad.parse().unwrap_or(0)
        })
        .unwrap_or(0);
    min * 60_000 + sec * 1_000 + frac_ms
}

/// 若文本中**至少有一行**含两个及以上 LRC 时间戳，则视为 LDDC 式逐词 LRC 并解析；否则返回 `None`。
pub fn try_parse_embedded_word_lrc(raw: &str) -> Option<LyricsPayload> {
    let re = lrc_ts_regex();
    let mut word_lines: Vec<WordLine> = Vec::new();
    let mut simple_lrc_lines: Vec<String> = Vec::new();
    let mut saw_embedded = false;

    let lines: Vec<&str> = raw.lines().collect();
    let line_count = lines.len();

    for (li, line) in lines.iter().enumerate() {
        let line = line.trim_end();
        if line.is_empty() {
            continue;
        }
        let caps: Vec<regex::Captures<'_>> = re.captures_iter(line).collect();
        if caps.is_empty() {
            continue;
        }

        if caps.len() >= 2 {
            saw_embedded = true;
            let mut words: Vec<WordTiming> = Vec::new();
            for i in 0..caps.len() {
                let m0 = caps[i].get(0).unwrap();
                let w_start = cap_to_ms(&caps[i]);
                let text_end = if i + 1 < caps.len() {
                    caps[i + 1].get(0).unwrap().start()
                } else {
                    line.len()
                };
                let text = line[m0.end()..text_end].to_string();
                let w_end = if i + 1 < caps.len() {
                    cap_to_ms(&caps[i + 1])
                } else {
                    next_line_first_start_ms(&lines, li + 1, line_count, re).unwrap_or(w_start + 1_500)
                };
                if text.is_empty() && i + 1 < caps.len() {
                    continue;
                }
                if w_end < w_start {
                    continue;
                }
                words.push(WordTiming {
                    start_ms: w_start,
                    end_ms: w_end,
                    text,
                });
            }
            if words.is_empty() {
                continue;
            }
            let line_start = words.first().map(|w| w.start_ms).unwrap_or(0);
            let line_end = words.last().map(|w| w.end_ms).unwrap_or(line_start);
            let display: String = words.iter().map(|w| w.text.as_str()).collect();
            simple_lrc_lines.push(fmt_lrc_line(line_start, &display));
            word_lines.push(WordLine {
                start_ms: line_start,
                end_ms: line_end,
                words,
            });
            continue;
        }

        // 单行仅一个时间戳：行内不再含其它 `[分:秒]` 时间标签
        let m0 = caps[0].get(0).unwrap();
        let after = line[m0.end()..].trim_end();
        if after.contains('[') && re.is_match(after) {
            // 理论上应由 caps.len()>=2 覆盖；若正则漏检则跳过
            continue;
        }
        let w_start = cap_to_ms(&caps[0]);
        let w_end = next_line_first_start_ms(&lines, li + 1, line_count, re).unwrap_or(w_start + 5_000);
        let text = after.to_string();
        simple_lrc_lines.push(fmt_lrc_line(w_start, &text));
        word_lines.push(WordLine {
            start_ms: w_start,
            end_ms: w_end,
            words: vec![WordTiming {
                start_ms: w_start,
                end_ms: w_end,
                text,
            }],
        });
    }

    if !saw_embedded {
        return None;
    }
    if word_lines.is_empty() {
        return None;
    }

    let lrc_text = simple_lrc_lines.join("\n");
    Some(LyricsPayload {
        lrc_text,
        word_lines: Some(word_lines),
    })
}

fn next_line_first_start_ms(
    lines: &[&str],
    from: usize,
    line_count: usize,
    re: &Regex,
) -> Option<u64> {
    for j in from..line_count {
        let s = lines[j].trim_end();
        if s.is_empty() {
            continue;
        }
        let cap = re.captures(s)?;
        return Some(cap_to_ms(&cap));
    }
    None
}

fn fmt_lrc_line(start_ms: u64, text: &str) -> String {
    let sec = start_ms / 1000;
    let ms_part = (start_ms % 1000) as u32;
    let m = sec / 60;
    let s = sec % 60;
    format!("[{:02}:{:02}.{:03}]{}", m, s, ms_part, text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn lddc_sample_line_has_word_level() {
        let raw = r#"[00:16.769]你[00:16.929]掌[00:17.129]心[00:17.657]的[00:17.905]温[00:18.361]度"#;
        let p = try_parse_embedded_word_lrc(raw).expect("embedded");
        assert!(p.word_lines.is_some());
        let wl = p.word_lines.as_ref().unwrap();
        assert_eq!(wl.len(), 1);
        assert!(wl[0].words.len() > 1, "multiple syllables");
        assert!(p.lrc_text.contains("[00:16.769]"));
        assert!(!p.lrc_text.contains("[00:16.929]"));
    }

    #[test]
    fn lddc_repo_sample_file_if_present() {
        let p = Path::new(env!("CARGO_MANIFEST_DIR")).join("../王铮亮 - 旅人 (785079213).lrc");
        if !p.exists() {
            return;
        }
        let raw = std::fs::read_to_string(p).expect("read lrc");
        let pl = try_parse_embedded_word_lrc(&raw).expect("parse embedded");
        let wl = pl.word_lines.as_ref().expect("word_lines");
        assert!(
            wl.len() >= 30,
            "expected many lyric lines with word timing, got {}",
            wl.len()
        );
        assert!(
            wl.iter().any(|line| line.words.len() > 1),
            "expected at least one line with multiple word timings"
        );
    }
}
