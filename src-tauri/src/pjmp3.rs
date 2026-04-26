//! pjmp3.com 搜索与试听解析，行为对齐 Python `services/search_service.py`。

use std::collections::HashSet;
use std::error::Error;
use std::fs;
use std::path::PathBuf;
use std::time::Duration;

/// reqwest 的 `Display` 往往只有「error sending request」；把 `source()` 链拼上便于 Android logcat 区分 DNS/TLS/超时。
fn reqwest_err_chain(e: reqwest::Error) -> String {
    let mut s = e.to_string();
    let mut src: Option<&(dyn Error + 'static)> = e.source();
    while let Some(err) = src {
        s.push_str(": ");
        s.push_str(&err.to_string());
        src = err.source();
    }
    s
}

use log::{info, warn};
use regex::Regex;
use scraper::{ElementRef, Html, Selector};
use serde::Serialize;

use crate::config::BASE_URL;

const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/// 日志里截断 URL，避免单行过长。
fn truncate_url_160(s: &str) -> String {
    let t: String = s.chars().take(160).collect();
    if s.len() > 160 {
        format!("{t}…")
    } else {
        t
    }
}

fn log_extracted_urls_summary(sid: &str, urls: &[String]) {
    let n = urls.len();
    let er_sycdn = urls
        .iter()
        .filter(|u| u.to_ascii_lowercase().contains("er-sycdn"))
        .count();
    let sycdn = urls.iter().filter(|u| {
        let l = u.to_ascii_lowercase();
        l.contains("sycdn.kuwo.cn") && !l.contains("er-sycdn")
    }).count();
    let preview: Vec<String> = urls.iter().take(3).map(|u| truncate_url_160(u)).collect();
    info!(
        target: "pj-play",
        "extracted_urls sid={} count={} er_sycdn={} sycdn_other={} preview={:?}",
        sid,
        n,
        er_sycdn,
        sycdn,
        preview
    );
}

#[derive(Serialize, Clone, Debug)]
pub struct SearchResultDto {
    pub source_id: String,
    pub title: String,
    pub artist: String,
    #[serde(default)]
    pub album: String,
    pub cover_url: Option<String>,
}

pub fn normalize_image_url(url: Option<&str>) -> Option<String> {
    let u = url?.trim();
    if u.is_empty() {
        return None;
    }
    if u.starts_with("//") {
        return Some(format!("https:{u}"));
    }
    if u.starts_with('/') {
        return Some(format!("{}{}", BASE_URL.trim_end_matches('/'), u));
    }
    if u.starts_with("http://") || u.starts_with("https://") {
        return Some(u.to_string());
    }
    Some(format!("{}/{}", BASE_URL.trim_end_matches('/'), u.trim_start_matches('/')))
}

fn split_title_speed_suffix(title: &str) -> Option<(String, String)> {
    let re = Regex::new(r"^(.+?)\s*\([^)]*[xX×][^)]*\)\s*(.+)$").ok()?;
    let c = re.captures(title.trim())?;
    let a = c.get(1)?.as_str().trim();
    let b = c.get(2)?.as_str().trim();
    if a.is_empty() || b.is_empty() {
        return None;
    }
    Some((a.to_string(), b.to_string()))
}

fn split_glued_pure_cjk(title: &str) -> Option<(String, String)> {
    let t: String = title.chars().filter(|c| !c.is_whitespace()).collect();
    let n = t.chars().count();
    if !(5..=14).contains(&n) {
        return None;
    }
    if !t.chars().all(|c| ('\u{4e00}'..='\u{9fff}').contains(&c)) {
        return None;
    }
    let cut = if n % 2 == 1 { (n - 1) / 2 } else { n / 2 };
    if cut < 2 || n - cut < 2 {
        return None;
    }
    let (left, right) = t.split_at(cut);
    Some((left.to_string(), right.to_string()))
}

fn parse_modern_cards(document: &Html) -> Vec<SearchResultDto> {
    let card_sel = match Selector::parse(r#"a.search-result-list-item[href*="song.php"]"#) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    let song_sel = Selector::parse(".search-result-list-item-left-song").unwrap();
    let singer_sel = Selector::parse(".search-result-list-item-left-singer").unwrap();
    let img_sel = Selector::parse(".search-result-list-item-img img").unwrap();
    let re = Regex::new(r"(?i)song\.php\?id=(\d+)").unwrap();

    let mut seen = HashSet::new();
    let mut out = Vec::new();

    for a in document.select(&card_sel) {
        let href = a.value().attr("href").unwrap_or("").replace('\\', "/");
        let Some(caps) = re.captures(&href) else {
            continue;
        };
        let sid = caps.get(1).unwrap().as_str().to_string();
        if !seen.insert(sid.clone()) {
            continue;
        }

        let title = a
            .select(&song_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        if title.is_empty() {
            continue;
        }
        let artist = a
            .select(&singer_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        let cover_url = a.select(&img_sel).next().and_then(|img| {
            let src = img
                .value()
                .attr("src")
                .or_else(|| img.value().attr("data-src"))
                .or_else(|| img.value().attr("data-original"))
                .unwrap_or("")
                .trim();
            normalize_image_url(Some(src))
        });

        out.push(SearchResultDto {
            source_id: sid,
            title,
            artist,
            album: String::new(),
            cover_url,
        });
    }
    out
}

fn parse_legacy_table(document: &Html) -> Vec<SearchResultDto> {
    let tr_sel = Selector::parse("tr").unwrap();
    let a_sel = Selector::parse(r#"a[href*="song.php"]"#).unwrap();
    let re = Regex::new(r"song\.php\?id=(\d+)").unwrap();
    let td_sel = Selector::parse("td").unwrap();

    let mut seen = HashSet::new();
    let mut out = Vec::new();

    for tr in document.select(&tr_sel) {
        for a in tr.select(&a_sel) {
            let href = a.value().attr("href").unwrap_or("");
            let Some(caps) = re.captures(href) else {
                continue;
            };
            let sid = caps.get(1).unwrap().as_str().to_string();
            if !seen.insert(sid.clone()) {
                continue;
            }

            let mut title = a.text().collect::<String>().trim().to_string();
            if title.is_empty() {
                continue;
            }
            let low = title.to_ascii_lowercase();
            if low == "下载" || low == "播放" || low == "试听" {
                continue;
            }

            let mut artist = String::new();
            let mut album = String::new();

            let cells: Vec<ElementRef<'_>> = tr.select(&td_sel).collect();
            let needle = format!("song.php?id={sid}");
            let needle_l = needle.to_ascii_lowercase();
            let li = cells
                .iter()
                .position(|td| td.html().to_ascii_lowercase().contains(&needle_l));
            if let Some(li) = li {
                let n = cells.len();
                if li + 1 < n {
                    artist = cells[li + 1].text().collect::<String>().trim().to_string();
                }
                if li + 2 < n {
                    album = cells[li + 2].text().collect::<String>().trim().to_string();
                }
                let mut texts_after: Vec<String> = Vec::new();
                for j in (li + 1)..n {
                    let t = cells[j].text().collect::<String>().trim().to_string();
                    if t.is_empty() || t.chars().all(|c| c.is_ascii_digit()) {
                        continue;
                    }
                    if t == title {
                        continue;
                    }
                    texts_after.push(t);
                }
                if artist.is_empty() {
                    if let Some(f) = texts_after.first() {
                        artist.clone_from(f);
                    }
                }
                if album.is_empty() && texts_after.len() >= 2 {
                    album.clone_from(&texts_after[1]);
                }
                if album.is_empty() && texts_after.len() >= 3 {
                    album.clone_from(&texts_after[2]);
                }
            }

            let mut best: Option<String> = None;
            for im in tr.select(&Selector::parse("img").unwrap()) {
                let src = im
                    .value()
                    .attr("src")
                    .or_else(|| im.value().attr("data-src"))
                    .or_else(|| im.value().attr("data-original"))
                    .or_else(|| im.value().attr("data-lazy-src"))
                    .unwrap_or("")
                    .trim();
                if src.is_empty() || src.to_ascii_lowercase().ends_with(".svg") {
                    continue;
                }
                let Some(au) = normalize_image_url(Some(src)) else {
                    continue;
                };
                let low_u = au.to_ascii_lowercase();
                if low_u.contains("blank") || low_u.contains("spacer") {
                    continue;
                }
                if best.is_none() {
                    best = Some(au.clone());
                }
                if low_u.contains("albumcover") || low_u.contains("/cover") || low_u.contains("pic") {
                    best = Some(au);
                    break;
                }
            }
            let cover_url = best;

            if artist.is_empty() {
                for sep in [" - ", " – ", " — ", " · ", " / ", "|", "／"] {
                    if let Some(pos) = title.find(sep) {
                        let tmp = title.clone();
                        let t0 = tmp[..pos].trim();
                        let t1 = tmp[pos + sep.len()..].trim();
                        if !t0.is_empty() && !t1.is_empty() {
                            title = t0.to_string();
                            artist = t1.to_string();
                            break;
                        }
                    }
                }
            }
            if artist.is_empty() && title.chars().any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c)) {
                if let Ok(re_sp) = Regex::new(r"^(.+?)[\s\u{3000}]+(.+)$") {
                    let tc = title.clone();
                    if let Some(c) = re_sp.captures(&tc) {
                        let t0 = c.get(1).map(|m| m.as_str().trim()).unwrap_or("");
                        let t1 = c.get(2).map(|m| m.as_str().trim()).unwrap_or("");
                        if !t0.is_empty() && !t1.is_empty() && t0.len() <= 64 {
                            title = t0.to_string();
                            artist = t1.to_string();
                        }
                    }
                }
            }
            if artist.is_empty() {
                if let Some((t, ar)) = split_title_speed_suffix(&title) {
                    title = t;
                    artist = ar;
                }
            }
            if artist.is_empty() {
                if let Some((t, ar)) = split_glued_pure_cjk(&title) {
                    title = t;
                    artist = ar;
                }
            }

            out.push(SearchResultDto {
                source_id: sid,
                title,
                artist,
                album,
                cover_url,
            });
        }
    }
    out
}

fn detect_next_page(html: &str, current_page: u32, n_results: usize) -> bool {
    let re_page = Regex::new(r"[?&]page=(\d+)").unwrap();
    let document = Html::parse_document(html);
    let a_sel = Selector::parse("a[href]").unwrap();
    for a in document.select(&a_sel) {
        let href = a.value().attr("href").unwrap_or("").replace('\\', "/");
        let Some(caps) = re_page.captures(&href) else {
            continue;
        };
        let Ok(p) = caps.get(1).unwrap().as_str().parse::<u32>() else {
            continue;
        };
        if p > current_page
            && (href.to_ascii_lowercase().contains("search")
                || href.starts_with('?')
                || href.contains("keyword="))
        {
            return true;
        }
    }
    n_results >= 12
}

/// 带页码的检测（与 Python `SearchService.search` 一致）。
pub fn parse_search_html_page(html: &str, page: u32) -> Result<(Vec<SearchResultDto>, bool), String> {
    let document = Html::parse_document(html);
    let modern = parse_modern_cards(&document);
    if !modern.is_empty() {
        let has_next = detect_next_page(html, page, modern.len());
        return Ok((modern, has_next));
    }
    let legacy = parse_legacy_table(&document);
    let has_next = detect_next_page(html, page, legacy.len());
    Ok((legacy, has_next))
}

pub async fn search_pjmp3(
    client: &reqwest::Client,
    keyword: &str,
    page: u32,
) -> Result<(Vec<SearchResultDto>, bool), String> {
    let url = format!("{}/search.php", BASE_URL.trim_end_matches('/'));
    let page_s = page.to_string();
    let body = client
        .get(&url)
        .query(&[("keyword", keyword), ("page", page_s.as_str())])
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .header("Referer", format!("{}/", BASE_URL))
        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
        .send()
        .await
        .map_err(reqwest_err_chain)?
        .error_for_status()
        .map_err(reqwest_err_chain)?
        .text()
        .await
        .map_err(reqwest_err_chain)?;

    parse_search_html_page(&body, page)
}

/// 临时目录：供 WebView 通过 `convertFileSrc` 本地播放（避免直连外链触发 NotSupportedError）。
pub fn preview_audio_cache_dir() -> PathBuf {
    std::env::temp_dir().join("cloudplayer_tauri_audio")
}

/// 与 `cache_preview_audio_file` 落盘扩展名一致（曾仅为 .mp3，现含 aac/m4a 等）。
const PREVIEW_CACHE_EXTS: &[&str] = &[".mp3", ".m4a", ".aac", ".flac", ".ogg", ".wav"];

/// 若已有非空试听缓存文件，返回路径。
pub fn preview_cache_path_if_exists(song_id: &str) -> Option<PathBuf> {
    let sid = song_id.trim();
    if sid.is_empty() {
        return None;
    }
    let safe: String = sid.chars().filter(|c| c.is_ascii_digit()).collect();
    let name = if safe.is_empty() {
        "unknown".to_string()
    } else {
        safe
    };
    let dir = preview_audio_cache_dir();
    for ext in PREVIEW_CACHE_EXTS {
        let path = dir.join(format!("preview_{name}{ext}"));
        if let Ok(meta) = std::fs::metadata(&path) {
            if meta.is_file() && meta.len() > 0 {
                return Some(path);
            }
        }
    }
    None
}

pub async fn fetch_song_page_html(client: &reqwest::Client, song_id: &str) -> Result<String, String> {
    let sid = song_id.trim();
    let url = format!(
        "{}/song.php?id={}",
        BASE_URL.trim_end_matches('/'),
        sid
    );
    let resp = match client
        .get(&url)
        .header("User-Agent", BROWSER_UA)
        .header("Referer", format!("{}/", BASE_URL))
        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            let msg = reqwest_err_chain(e);
            warn!(target: "pj-play", "song_page send_err sid={} err={}", sid, msg);
            return Err(msg);
        }
    };
    let status = resp.status();
    let resp = match resp.error_for_status() {
        Ok(r) => r,
        Err(e) => {
            let msg = reqwest_err_chain(e);
            warn!(
                target: "pj-play",
                "song_page http_err sid={} status={} err={}",
                sid,
                status.as_u16(),
                msg
            );
            return Err(msg);
        }
    };
    let text = match resp.text().await {
        Ok(t) => t,
        Err(e) => {
            let msg = reqwest_err_chain(e);
            warn!(target: "pj-play", "song_page text_err sid={} err={}", sid, msg);
            return Err(msg);
        }
    };
    info!(
        target: "pj-play",
        "song_page ok sid={} status={} body_len={}",
        sid,
        status.as_u16(),
        text.len()
    );
    Ok(text)
}

fn normalize_media_url(raw: &str) -> String {
    let u = raw.replace("\\/", "/").trim().trim_end_matches('\\').to_string();
    if u.starts_with("//") {
        return format!("https:{u}");
    }
    u
}

/// 与 Py `pjmp3_stream_parse.extract_stream_url_from_song_html` 对齐：试听链可能是 mp3/aac/m4a 等，非仅 mp3。
fn is_excluded_stream_url(url: &str) -> bool {
    let low = url.to_ascii_lowercase();
    if low.contains("albumcover") || low.contains("/star/albumcover") {
        return true;
    }
    let path_only = url.split('?').next().unwrap_or(url);
    let pl = path_only.to_ascii_lowercase();
    pl.ends_with(".jpg")
        || pl.ends_with(".jpeg")
        || pl.ends_with(".png")
        || pl.ends_with(".webp")
        || pl.ends_with(".gif")
        || pl.ends_with(".css")
        || pl.ends_with(".js")
}

fn push_stream_candidate(out: &mut Vec<String>, seen: &mut HashSet<String>, raw: String) {
    let u = normalize_media_url(&raw);
    if u.is_empty() || !u.starts_with("http") {
        return;
    }
    if is_excluded_stream_url(&u) {
        return;
    }
    if seen.insert(u.clone()) {
        out.push(u);
    }
}

/// 从 song.php HTML 收集试听直链（顺序与页面出现顺序一致，供依次重试）。
pub fn extract_stream_urls_from_song_html(html: &str) -> Vec<String> {
    let text = html.replace("\\/", "/");
    let mut out: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    // 1) 主正则：.mp3|.aac|.m4a|.wav|.ogg|.flac（与 Py audio_ext 一致）
    if let Ok(re) = Regex::new(
        r#"(?i)https?://[^\s"'<>]+\.(?:mp3|aac|m4a|wav|ogg|flac)(?:\?[^\s"'<>]*)?"#,
    ) {
        for m in re.find_iter(&text) {
            push_stream_candidate(&mut out, &mut seen, m.as_str().to_string());
        }
    }

    // 2) 仅 .mp3 的备用（Py：主正则无匹配时再试）
    if out.is_empty() {
        if let Ok(re) = Regex::new(r#"(?i)https?://[^\s"'<>]+\.mp3[^\s"'<>]*"#) {
            for m in re.find_iter(&text) {
                push_stream_candidate(&mut out, &mut seen, m.as_str().to_string());
            }
        }
    }

    // 3)(4) 标签兜底（Py：仍无时再解析 audio、source）
    if out.is_empty() {
        if let Ok(re) = Regex::new(r#"(?i)<audio[^>]+src\s*=\s*["']([^"']+)["']"#) {
            for cap in re.captures_iter(&text) {
                if let Some(g) = cap.get(1) {
                    push_stream_candidate(&mut out, &mut seen, g.as_str().to_string());
                }
            }
        }
        if let Ok(re) = Regex::new(r#"(?i)<source[^>]+src\s*=\s*["']([^"']+)["']"#) {
            for cap in re.captures_iter(&text) {
                if let Some(g) = cap.get(1) {
                    push_stream_candidate(&mut out, &mut seen, g.as_str().to_string());
                }
            }
        }
    }

    out
}

/// 页面中可能出现的试听直链（mp3/aac/m4a 等），与 Py `extract_stream_url_from_song_html` 行为对齐。
pub fn extract_mp3_urls(html: &str) -> Vec<String> {
    extract_stream_urls_from_song_html(html)
}

/// 根据 URL 路径选择缓存文件扩展名，便于 WebView 按类型播放。
fn preview_file_extension_for_url(url: &str) -> &'static str {
    let path = url.split('?').next().unwrap_or(url);
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".m4a") {
        return ".m4a";
    }
    if lower.ends_with(".aac") {
        return ".aac";
    }
    if lower.ends_with(".flac") {
        return ".flac";
    }
    if lower.ends_with(".ogg") {
        return ".ogg";
    }
    if lower.ends_with(".wav") {
        return ".wav";
    }
    if lower.ends_with(".mp3") {
        return ".mp3";
    }
    ".mp3"
}

/// 同一试听 URL 的变体（酷我 `er-sycdn` 常返回 410，可换 `sycdn` 再试）。
fn expand_mp3_url_candidates(url: &str) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    let mut push = |s: String| {
        if seen.insert(s.clone()) {
            out.push(s);
        }
    };
    push(url.to_string());
    let low = url.to_ascii_lowercase();
    if low.contains("er-sycdn.kuwo.cn") {
        push(url.replace("er-sycdn.kuwo.cn", "sycdn.kuwo.cn"));
    }
    out
}

/// 多组 Referer/Origin，尽量贴近浏览器从 pjmp3 嵌套酷我试听的行为。
///
/// Android 实测：酷我 CDN 对「带 pjmp3/kuwo Referer」的请求在部分 IP/线路下会直接 403/410，
/// 而 WebView 直连（不带 Referer）却能返回 32s teaser。所以在末尾保留一组
/// 「完全不带 Referer / Origin」的兜底 attempt，尽量与 WebView 行为一致。
async fn download_mp3_bytes(
    client: &reqwest::Client,
    mp3_url: &str,
    song_page: &str,
) -> Result<Vec<u8>, String> {
    let base = BASE_URL.trim_end_matches('/');
    let ref_home = format!("{}/", base);

    let attempts: Vec<(Option<String>, Option<&str>)> = vec![
        (Some(song_page.to_string()), Some(base)),
        (Some(song_page.to_string()), None),
        (Some("https://www.kuwo.cn/".to_string()), Some("https://www.kuwo.cn")),
        (Some(ref_home.clone()), Some(base)),
        (Some(song_page.to_string()), Some("https://www.kuwo.cn")),
        // 兜底：WebView 直连也能拉到（至少 32s teaser），Rust 这里同样覆盖该路径
        (None, None),
    ];

    let mut last_err = String::from("未知错误");
    for (attempt_idx, (referer, origin)) in attempts.into_iter().enumerate() {
        let t0 = std::time::Instant::now();
        let ref_log = referer
            .as_ref()
            .map(|s| truncate_url_160(s.as_str()))
            .unwrap_or_else(|| "(none)".to_string());
        let origin_log = origin.unwrap_or("(none)");
        let mut req = client
            .get(mp3_url)
            .header("User-Agent", BROWSER_UA)
            .header("Accept", "*/*");
        if let Some(r) = referer {
            req = req.header("Referer", r);
        }
        if let Some(o) = origin {
            req = req.header("Origin", o);
        }
        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                last_err = reqwest_err_chain(e);
                warn!(
                    target: "pj-play",
                    "download_mp3_bytes attempt={} send_err url={} ref={} origin={} elapsed_ms={} err={}",
                    attempt_idx,
                    truncate_url_160(mp3_url),
                    ref_log,
                    origin_log,
                    t0.elapsed().as_millis(),
                    last_err
                );
                continue;
            }
        };
        let status = resp.status();
        let code = status.as_u16();
        let cl_hdr = resp
            .headers()
            .get(reqwest::header::CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("-")
            .to_string();
        let ct_hdr = resp
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("-")
            .to_string();
        if code == 410 || code == 403 || code == 404 {
            last_err = format!("HTTP {code}");
            warn!(
                target: "pj-play",
                "download_mp3_bytes attempt={} bad_status url={} http={} content_length_hdr={} content_type={} ref={} origin={} elapsed_ms={}",
                attempt_idx,
                truncate_url_160(mp3_url),
                code,
                cl_hdr,
                ct_hdr,
                ref_log,
                origin_log,
                t0.elapsed().as_millis()
            );
            continue;
        }
        if !status.is_success() {
            last_err = format!("HTTP {status}");
            warn!(
                target: "pj-play",
                "download_mp3_bytes attempt={} non_success url={} http={} content_length_hdr={} content_type={} ref={} origin={} elapsed_ms={}",
                attempt_idx,
                truncate_url_160(mp3_url),
                code,
                cl_hdr,
                ct_hdr,
                ref_log,
                origin_log,
                t0.elapsed().as_millis()
            );
            continue;
        }
        let bytes = match resp.bytes().await {
            Ok(b) => b,
            Err(e) => {
                last_err = reqwest_err_chain(e);
                warn!(
                    target: "pj-play",
                    "download_mp3_bytes attempt={} body_err url={} ref={} origin={} elapsed_ms={} err={}",
                    attempt_idx,
                    truncate_url_160(mp3_url),
                    ref_log,
                    origin_log,
                    t0.elapsed().as_millis(),
                    last_err
                );
                continue;
            }
        };
        let n = bytes.len();
        info!(
            target: "pj-play",
            "download_mp3_bytes attempt={} ok url={} http={} bytes_len={} content_length_hdr={} content_type={} ref={} origin={} elapsed_ms={}",
            attempt_idx,
            truncate_url_160(mp3_url),
            code,
            n,
            cl_hdr,
            ct_hdr,
            ref_log,
            origin_log,
            t0.elapsed().as_millis()
        );
        return Ok(bytes.to_vec());
    }
    Err(last_err)
}

fn validate_audio_bytes(bytes: &[u8]) -> Result<(), String> {
    if bytes.len() < 64 {
        warn!(
            target: "pj-play",
            "validate_audio_bytes reject too_short len={}",
            bytes.len()
        );
        return Err("音频数据过短或无效".to_string());
    }
    let first = bytes.iter().copied().find(|b| !b.is_ascii_whitespace());
    if first == Some(b'<') {
        let prefix: Vec<u8> = bytes.iter().copied().take(16).collect();
        let hex: String = prefix.iter().map(|b| format!("{:02x}", b)).collect();
        warn!(
            target: "pj-play",
            "validate_audio_bytes reject html_like len={} first16_hex={}",
            bytes.len(),
            hex
        );
        return Err("试链接返回了网页而非音频".to_string());
    }
    Ok(())
}

/// 多次拉取 song 页、遍历所有 MP3 链接；遇 410/403 等会换链接或重新解析（酷我链易过期）。
pub async fn cache_preview_audio_file(client: &reqwest::Client, song_id: &str) -> Result<PathBuf, String> {
    let sid = song_id.trim();
    if sid.is_empty() {
        return Err("无效的歌曲 ID".to_string());
    }

    let dir = preview_audio_cache_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe: String = sid.chars().filter(|c| c.is_ascii_digit()).collect();
    let name = if safe.is_empty() { "unknown".to_string() } else { safe };

    let song_page = format!("{}/song.php?id={}", BASE_URL.trim_end_matches('/'), sid);

    const ROUNDS: u32 = 6;
    let mut last_attempt_err = String::new();
    let mut tried_any = false;
    let mut html_fetch_err: Option<String> = None;
    for round in 0..ROUNDS {
        info!(
            target: "pj-play",
            "cache_preview_audio_file round_begin sid={} round={}/{}",
            sid,
            round + 1,
            ROUNDS
        );
        // 每轮重新请求 song 页，更新 Cookie 并解析试听链（含 aac/m4a 等，与 Py 一致）
        let html = match fetch_song_page_html(client, sid).await {
            Ok(h) => h,
            Err(e) => {
                html_fetch_err = Some(e.clone());
                warn!(
                    target: "pj-play",
                    "cache_preview_audio_file round_fetch_html_fail sid={} round={} err={}",
                    sid,
                    round + 1,
                    e
                );
                if round + 1 < ROUNDS {
                    tokio::time::sleep(Duration::from_millis(240)).await;
                }
                continue;
            }
        };
        let mut urls = extract_mp3_urls(&html);
        urls.sort_by(|a, b| {
            let ae = a.to_lowercase().contains("er-sycdn");
            let be = b.to_lowercase().contains("er-sycdn");
            ae.cmp(&be)
        });
        log_extracted_urls_summary(sid, &urls);
        if urls.is_empty() {
            warn!(
                target: "pj-play",
                "cache_preview_audio_file round_no_urls sid={} round={}",
                sid,
                round + 1
            );
            if round + 1 < ROUNDS {
                tokio::time::sleep(Duration::from_millis(220)).await;
            }
            continue;
        }

        for mp3_url in urls {
            let ext = preview_file_extension_for_url(&mp3_url);
            let path = dir.join(format!("preview_{name}{ext}"));
            for candidate in expand_mp3_url_candidates(&mp3_url) {
                tried_any = true;
                match download_mp3_bytes(client, &candidate, &song_page).await {
                    Ok(bytes) => {
                        let n = bytes.len();
                        if let Err(e) = validate_audio_bytes(&bytes) {
                            last_attempt_err = format!("{e}（{candidate}）");
                            warn!(
                                target: "pj-play",
                                "cache_preview_audio_file validate_fail sid={} candidate={} bytes_len={} err={}",
                                sid,
                                truncate_url_160(&candidate),
                                n,
                                e
                            );
                            continue;
                        }
                        fs::write(&path, &bytes).map_err(|e| e.to_string())?;
                        let (dur_ms, _) = crate::download_meta::probe_audio_file(&path);
                        info!(
                            target: "pj-play",
                            "cache_preview_audio_file ok sid={} path={} bytes={} duration_ms={} url={}",
                            sid,
                            path.display(),
                            n,
                            dur_ms,
                            truncate_url_160(&candidate)
                        );
                        return Ok(path);
                    }
                    Err(e) => {
                        last_attempt_err = format!("{e}（{candidate}）");
                        warn!(
                            target: "pj-play",
                            "cache_preview_audio_file download_fail sid={} candidate={} err={}",
                            sid,
                            truncate_url_160(&candidate),
                            e
                        );
                        continue;
                    }
                }
            }
        }

        if round + 1 < ROUNDS {
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    }

    if !tried_any {
        if let Some(e) = html_fetch_err {
            warn!(
                target: "pj-play",
                "cache_preview_audio_file give_up sid={} reason=html_fetch err={}",
                sid,
                e
            );
            return Err(format!("无法下载试听：song 页请求失败 - {e}"));
        }
        warn!(
            target: "pj-play",
            "cache_preview_audio_file give_up sid={} reason=no_urls_parsed",
            sid
        );
        return Err("无法下载试听：未从 song 页解析到试听直链，稍后再试".to_string());
    }
    warn!(
        target: "pj-play",
        "cache_preview_audio_file give_up sid={} last_err={}",
        sid,
        last_attempt_err
    );
    Err(format!(
        "无法下载试听：站点返回的试听链暂时不可用（多为酷我 CDN 410/403）。最后一次失败：{last_attempt_err}"
    ))
}

pub async fn fetch_preview_url(client: &reqwest::Client, song_id: &str) -> Result<Option<String>, String> {
    let html = fetch_song_page_html(client, song_id).await?;
    Ok(extract_mp3_urls(&html).into_iter().next())
}

/// 从 song 页 HTML 中收集 `.lrc` 外链（与 MP3 提取方式类似）。
pub fn extract_lrc_urls(html: &str) -> Vec<String> {
    let Ok(re) = Regex::new(r#"(?i)https?://[^"'\s<>]+\.lrc[^"'\s<>]*"#) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for m in re.find_iter(html) {
        let u = m.as_str().replace("\\/", "/");
        if seen.insert(u.clone()) {
            out.push(u);
        }
    }
    out
}


async fn download_text_with_song_referer(
    client: &reqwest::Client,
    url: &str,
    song_page: &str,
) -> Result<String, String> {
    let base = BASE_URL.trim_end_matches('/');
    let attempts: Vec<(String, Option<&str>)> = vec![
        (song_page.to_string(), Some(base)),
        (song_page.to_string(), None),
        (format!("{}/", base), Some(base)),
    ];
    let mut last_err = String::from("未知错误");
    for (referer, origin) in attempts {
        let mut req = client
            .get(url)
            .header("User-Agent", BROWSER_UA)
            .header("Accept", "text/plain,*/*;q=0.8")
            .header("Referer", referer);
        if let Some(o) = origin {
            req = req.header("Origin", o);
        }
        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                last_err = reqwest_err_chain(e);
                continue;
            }
        };
        if !resp.status().is_success() {
            last_err = format!("HTTP {}", resp.status());
            continue;
        }
        let bytes = match resp.bytes().await {
            Ok(b) => b,
            Err(e) => {
                last_err = reqwest_err_chain(e);
                continue;
            }
        };
        let text = String::from_utf8_lossy(&bytes).into_owned();
        return Ok(text);
    }
    Err(last_err)
}

/// 拉取歌曲页并尝试下载 LRC 文本；站点无外链或失败时返回 `None`。
pub async fn fetch_song_lrc_text(client: &reqwest::Client, song_id: &str) -> Result<Option<String>, String> {
    let sid = song_id.trim();
    if sid.is_empty() {
        eprintln!("[lyrics] pjmp3 fetch_song_lrc_text: empty song id");
        return Err("无效的歌曲 ID".to_string());
    }
    eprintln!("[lyrics] pjmp3 fetch_song_lrc_text song_id={sid}");
    let song_page = format!("{}/song.php?id={}", BASE_URL.trim_end_matches('/'), sid);
    let html = fetch_song_page_html(client, sid).await?;
    let urls = extract_lrc_urls(&html);
    eprintln!("[lyrics] pjmp3 extracted {} .lrc url(s)", urls.len());
    for u in urls {
        match download_text_with_song_referer(client, &u, &song_page).await {
            Ok(t) if crate::lrc_format::has_lrc_timestamp_tags(&t) => {
                eprintln!("[lyrics] pjmp3 downloaded lrc chars={} url={u}", t.len());
                return Ok(Some(t));
            }
            Ok(t) => {
                eprintln!(
                    "[lyrics] pjmp3 skip url (not lrc-like) chars={} url={u}",
                    t.len()
                );
                continue;
            }
            Err(e) => {
                eprintln!("[lyrics] pjmp3 download failed url={u} err={e}");
                continue;
            }
        }
    }
    eprintln!("[lyrics] pjmp3: no valid lrc from song page");
    Ok(None)
}

// --- 与 Py `pjmp3_stream_parse.extract_album_from_song_html` / `extract_duration_ms_from_song_html` 对齐 ---

/// 从 song.php HTML 尽力提取专辑名（不拉试听链）。
pub fn extract_album_from_song_html(html: &str) -> Option<String> {
    let pats: &[&str] = &[
        r"所属专辑\s*《([^》]{1,200})》",
        r"所属专辑\s*[\[【]([^\]}】]{1,200})[\]】]",
        r"专辑\s*《([^》]{1,200})》",
        r#""album"\s*:\s*"([^"\\]+)"#,
        r#""albumName"\s*:\s*"([^"\\]+)"#,
        r#""zhuanji"\s*:\s*"([^"\\]+)"#,
    ];
    for pat in pats {
        if let Ok(re) = Regex::new(pat) {
            if let Some(c) = re.captures(html) {
                let s = c.get(1).map(|m| m.as_str().trim()).unwrap_or("");
                if !s.is_empty()
                    && s.len() < 300
                    && !matches!(s.to_ascii_lowercase().as_str(), "null" | "undefined" | "none")
                {
                    return Some(s.to_string());
                }
            }
        }
    }
    let re_line = Regex::new(r"专辑\s*[：:]\s*([^\n\r<]{1,200})").ok()?;
    if let Some(c) = re_line.captures(html) {
        let s0 = c.get(1).map(|m| m.as_str()).unwrap_or("");
        let s = s0.lines().next().unwrap_or("").trim();
        if !s.is_empty() && s.len() < 300 {
            return Some(s.to_string());
        }
    }
    None
}

/// 从 song.php HTML 提取时长（毫秒）；与 Py `extract_duration_ms_from_song_html` 一致。
pub fn extract_duration_ms_from_song_html(html: &str) -> i64 {
    if let Ok(re) = Regex::new(r"时长\s*[：:]\s*(\d{1,2})\s*:\s*(\d{2})") {
        if let Some(c) = re.captures(html) {
            let a: i64 = c.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
            let b: i64 = c.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
            if a < 120 && b < 60 {
                return (a * 60 + b) * 1000;
            }
        }
    }
    if let Ok(re) = Regex::new(r"时长\s*[：:]\s*(\d+)\s*[:\：]\s*(\d{1,2})\s*[:\：]\s*(\d{2})") {
        if let Some(c) = re.captures(html) {
            let h: i64 = c.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
            let m_: i64 = c.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
            let s: i64 = c.get(3).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
            if m_ < 60 && s < 60 {
                return ((h * 60 + m_) * 60 + s) * 1000;
            }
        }
    }
    let Ok(re_time) = Regex::new(r"\b(\d{1,2}):(\d{2})\b") else {
        return 0;
    };
    let mut best: i64 = 0;
    for c in re_time.captures_iter(html) {
        let a: i64 = c.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(99);
        let b: i64 = c.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(99);
        if a >= 60 || b >= 60 {
            continue;
        }
        let ms = (a * 60 + b) * 1000;
        if (1_000..=3_600_000).contains(&ms) {
            best = best.max(ms);
        }
    }
    best
}
