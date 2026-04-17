//! 酷狗歌词：complexsearch 搜索 + lyrics.kugou.com 候选与下载 KRC。

use std::collections::BTreeMap;

use amll_lyric::lrc::parse_lrc;
use flate2::read::ZlibDecoder;
use md5::{Digest, Md5};
use regex::Regex;
use reqwest::Client;
use serde_json::Value;

use crate::lyrics::{line_only_payload, lyric_lines_to_payload, LyricsPayload, WordLine, WordTiming};

const KG_SIGN_PREFIX: &str = "LnT6xpN3khm36zse0QzvmgTZ3waWdRSA";
const KRC_KEY: &[u8] = b"@Gaw^2tGQ61-\xce\xd2ni";

fn md5_hex(s: &str) -> String {
    let mut h = Md5::new();
    h.update(s.as_bytes());
    format!("{:x}", h.finalize())
}

fn krc_decrypt(raw: &[u8]) -> Result<String, String> {
    if raw.len() < 4 {
        return Err("krc too short".into());
    }
    let dec: Vec<u8> = raw[4..]
        .iter()
        .enumerate()
        .map(|(i, &b)| b ^ KRC_KEY[i % KRC_KEY.len()])
        .collect();
    let mut r = ZlibDecoder::new(&dec[..]);
    let mut out = Vec::new();
    std::io::Read::read_to_end(&mut r, &mut out).map_err(|e| e.to_string())?;
    String::from_utf8(out).map_err(|e| e.to_string())
}

fn kg_mid() -> String {
    md5_hex(&chrono::Utc::now().timestamp_millis().to_string())
}

fn kg_headers(module: &str) -> reqwest::header::HeaderMap {
    let mut h = reqwest::header::HeaderMap::new();
    h.insert(
        reqwest::header::USER_AGENT,
        reqwest::header::HeaderValue::from_str(&format!(
            "Android14-1070-11070-201-0-{module}-wifi"
        ))
        .unwrap(),
    );
    h.insert("KG-Rec", reqwest::header::HeaderValue::from_static("1"));
    h.insert("KG-RC", reqwest::header::HeaderValue::from_static("1"));
    h.insert(
        "KG-CLIENTTIMEMS",
        reqwest::header::HeaderValue::from_str(&chrono::Utc::now().timestamp_millis().to_string())
            .unwrap(),
    );
    h
}

fn kg_signature(params: &BTreeMap<String, String>, body: &str) -> String {
    let joined: String = params
        .iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect();
    md5_hex(&format!("{KG_SIGN_PREFIX}{joined}{body}{KG_SIGN_PREFIX}"))
}

async fn kg_get(
    client: &Client,
    url: &str,
    extra: BTreeMap<String, String>,
    module: &str,
    extra_header: Option<(&str, &str)>,
) -> Result<Value, String> {
    let mid = kg_mid();
    let mut params: BTreeMap<String, String> = BTreeMap::new();
    params.insert("userid".into(), "0".into());
    params.insert("appid".into(), "3116".into());
    params.insert("token".into(), "".into());
    params.insert(
        "clienttime".into(),
        chrono::Utc::now().timestamp().to_string(),
    );
    params.insert("iscorrection".into(), "1".into());
    params.insert("uuid".into(), "-".into());
    params.insert("mid".into(), mid.clone());
    params.insert("dfid".into(), "-".into());
    params.insert("clientver".into(), "11070".into());
    params.insert("platform".into(), "AndroidFilter".into());
    for (k, v) in extra {
        params.insert(k, v);
    }
    let body = "";
    let sig = kg_signature(&params, body);
    params.insert("signature".into(), sig);
    let mut req = client.get(url).headers(kg_headers(module));
    if let Some((k, v)) = extra_header {
        req = req.header(k, v);
    }
    req = req.header("mid", mid.as_str());
    for (k, v) in &params {
        req = req.query(&[(k.as_str(), v.as_str())]);
    }
    let r = req.send().await.map_err(|e| e.to_string())?;
    if !r.status().is_success() {
        return Err(format!("kg http {}", r.status()));
    }
    let v: Value = r.json().await.map_err(|e| e.to_string())?;
    let err = v.get("error_code").and_then(|x| x.as_i64()).unwrap_or(0);
    if err != 0 && err != 200 {
        let msg = v
            .get("error_msg")
            .and_then(|x| x.as_str())
            .unwrap_or("?");
        return Err(format!("kg err {err}: {msg}"));
    }
    Ok(v)
}

async fn kg_lyric_get(
    client: &Client,
    url: &str,
    extra: BTreeMap<String, String>,
) -> Result<Value, String> {
    let mid = kg_mid();
    let mut p: BTreeMap<String, String> = BTreeMap::new();
    p.insert("appid".into(), "3116".into());
    p.insert("clientver".into(), "11070".into());
    for (k, v) in extra {
        p.insert(k, v);
    }
    p.insert("mid".into(), mid.clone());
    let body = "";
    let sig = kg_signature(&p, body);
    p.insert("signature".into(), sig);
    let mut req = client.get(url).headers(kg_headers("Lyric"));
    for (k, v) in &p {
        req = req.query(&[(k.as_str(), v.as_str())]);
    }
    let r = req.send().await.map_err(|e| e.to_string())?;
    if !r.status().is_success() {
        return Err(format!("kg lyric http {}", r.status()));
    }
    let v: Value = r.json().await.map_err(|e| e.to_string())?;
    let err = v.get("error_code").and_then(|x| x.as_i64()).unwrap_or(0);
    if err != 0 && err != 200 {
        return Err(format!("kg lyric err {err}"));
    }
    Ok(v)
}

#[derive(Debug, Clone)]
pub struct KgSearchHit {
    pub album_audio_id: String,
    pub file_hash: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: i64,
}

const KG_COMPLEX_SEARCH: &str = "https://complexsearch.kugou.com/v2/search/song";

fn album_audio_id_from_item(it: &Value) -> Option<String> {
    for key in ["Scid", "ID", "AlbumAudioID"] {
        if let Some(v) = it.get(key) {
            if let Some(n) = v.as_i64() {
                if n != 0 {
                    return Some(n.to_string());
                }
            }
            if let Some(n) = v.as_u64() {
                if n != 0 {
                    return Some(n.to_string());
                }
            }
            if let Some(s) = v.as_str() {
                let t = s.trim();
                if !t.is_empty() && t != "0" {
                    return Some(t.to_string());
                }
            }
        }
    }
    None
}

fn file_hash_from_item(it: &Value) -> String {
    for key in ["FileHash", "HQFileHash", "SQFileHash"] {
        if let Some(s) = it.get(key).and_then(|x| x.as_str()) {
            if !s.is_empty() {
                return s.to_string();
            }
        }
    }
    String::new()
}

fn parse_search_lists(v: &Value) -> Vec<KgSearchHit> {
    let lists = v
        .pointer("/data/lists")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = Vec::new();
    for it in lists {
        let Some(id) = album_audio_id_from_item(&it) else {
            continue;
        };
        let hash = file_hash_from_item(&it);
        let title = it
            .get("SongName")
            .or_else(|| it.get("FileName"))
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let album = it
            .get("AlbumName")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let mut artists = Vec::new();
        if let Some(arr) = it.get("Singers").and_then(|x| x.as_array()) {
            for s in arr {
                if let Some(n) = s.get("name").and_then(|x| x.as_str()) {
                    if !n.is_empty() {
                        artists.push(n.to_string());
                    }
                }
            }
        }
        let artist = if artists.is_empty() {
            it.get("SingerName")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string()
        } else {
            artists.join("、")
        };
        let duration_ms = it.get("Duration").and_then(|x| x.as_i64()).unwrap_or(0) * 1000;
        out.push(KgSearchHit {
            album_audio_id: id,
            file_hash: hash,
            title,
            artist,
            album,
            duration_ms,
        });
    }
    out
}

/// 酷狗 complexsearch：HTTPS + 兼容字段；无结果时用歌名/逆序关键词重试（与「艺人 歌名」搜索习惯对齐）。
pub async fn search_songs(client: &Client, keyword: &str, page: i64) -> Result<Vec<KgSearchHit>, String> {
    let mut attempts: Vec<String> = vec![keyword.trim().to_string()];
    let kw = keyword.trim();
    if let Some(last) = kw.split_whitespace().last() {
        if last.len() >= 2 && last != kw {
            attempts.push(last.to_string());
        }
    }
    let parts: Vec<&str> = kw.split_whitespace().collect();
    if parts.len() >= 2 {
        let rev = parts.iter().rev().copied().collect::<Vec<_>>().join(" ");
        if rev != kw {
            attempts.push(rev);
        }
    }
    let mut last_err: Option<String> = None;
    let mut saw_ok = false;
    for attempt in attempts {
        let mut params = BTreeMap::new();
        params.insert("sorttype".into(), "0".into());
        params.insert("keyword".into(), attempt.clone());
        params.insert("pagesize".into(), "20".into());
        params.insert("page".into(), page.to_string());
        match kg_get(
            client,
            KG_COMPLEX_SEARCH,
            params,
            "SearchSong",
            Some(("x-router", "complexsearch.kugou.com")),
        )
        .await
        {
            Ok(v) => {
                saw_ok = true;
                let out = parse_search_lists(&v);
                if !out.is_empty() {
                    if attempt != keyword.trim() {
                        eprintln!(
                            "[lyric_kugou] search: keyword {:?} → {} hit(s), retry_kw={:?}",
                            keyword,
                            out.len(),
                            attempt
                        );
                    }
                    return Ok(out);
                }
            }
            Err(e) => last_err = Some(e),
        }
    }
    if !saw_ok {
        return Err(last_err.unwrap_or_else(|| "kugou: search failed".into()));
    }
    Ok(vec![])
}

fn kugou_candidates_array(v: &Value) -> Option<&Vec<Value>> {
    v.get("candidates")
        .and_then(|x| x.as_array())
        .or_else(|| v.pointer("/data/candidates").and_then(|x| x.as_array()))
}

fn kugou_candidate_count(v: &Value) -> usize {
    kugou_candidates_array(v).map(|a| a.len()).unwrap_or(0)
}

fn json_num_or_str_id(v: &Value) -> Option<String> {
    if let Some(n) = v.as_i64() {
        return Some(n.to_string());
    }
    if let Some(n) = v.as_u64() {
        return Some(n.to_string());
    }
    if let Some(f) = v.as_f64() {
        if f.is_finite() {
            return Some((f as i64).to_string());
        }
    }
    let s = v.as_str()?.trim();
    if s.is_empty() {
        return None;
    }
    Some(s.to_string())
}

fn kugou_candidate_id_str(c: &Value) -> Option<String> {
    for key in ["id", "Id", "ID"] {
        if let Some(v) = c.get(key) {
            if let Some(s) = json_num_or_str_id(v) {
                return Some(s);
            }
        }
    }
    None
}

fn kugou_candidate_accesskey_str(c: &Value) -> Option<String> {
    for key in ["accesskey", "AccessKey", "access_key"] {
        if let Some(v) = c.get(key) {
            if let Some(s) = v.as_str() {
                let t = s.trim();
                if !t.is_empty() {
                    return Some(t.to_string());
                }
            }
        }
    }
    None
}

/// 在搜索 JSON 中找第一个同时含可解析 `id` 与 `accesskey` 的候选（服务端可能用字符串 id 或首条为占位）。
fn first_kugou_lyric_download_pair(search_json: &Value) -> Option<(String, String)> {
    let arr = kugou_candidates_array(search_json)?;
    for c in arr {
        if let (Some(id), Some(ak)) = (kugou_candidate_id_str(c), kugou_candidate_accesskey_str(c)) {
            return Some((id, ak));
        }
    }
    None
}

/// `lyrics.kugou.com` 搜索：带签名。部分歌曲在 `man=no`、空 hash 或与曲库不一致的 `album_audio_id` 下会返回空 `candidates`，
/// 需回退为仅 keyword+duration（与 LyricsKit / 常见脚本一致）。
async fn kugou_lyric_search_response(
    client: &Client,
    base_url: &str,
    params: BTreeMap<String, String>,
) -> Result<Option<Value>, String> {
    let v = kg_lyric_get(client, base_url, params).await?;
    if kugou_candidate_count(&v) == 0 {
        return Ok(None);
    }
    Ok(Some(v))
}

pub async fn fetch_lyrics(client: &Client, hit: &KgSearchHit) -> Result<LyricsPayload, String> {
    let dur_ms = if hit.duration_ms > 0 {
        hit.duration_ms
    } else {
        999_000
    };
    let kw_dash = format!("{} - {}", hit.artist, hit.title);
    let kw_space = format!("{} {}", hit.artist, hit.title);

    let mut attempts: Vec<BTreeMap<String, String>> = Vec::new();

    // 1) 完整参数；`man=yes` 更易出候选；空 hash 不传（避免服务端严格匹配失败）
    {
        let mut p = BTreeMap::new();
        p.insert("album_audio_id".into(), hit.album_audio_id.clone());
        p.insert("duration".into(), dur_ms.to_string());
        if !hit.file_hash.is_empty() {
            p.insert("hash".into(), hit.file_hash.clone());
        }
        p.insert("keyword".into(), kw_dash.clone());
        p.insert("lrctxt".into(), "1".into());
        p.insert("man".into(), "yes".into());
        attempts.push(p);
    }
    // 2) 不用 album_audio_id，仅 hash+keyword（部分 ID 与歌词库不一致）
    if !hit.file_hash.is_empty() {
        let mut p = BTreeMap::new();
        p.insert("duration".into(), dur_ms.to_string());
        p.insert("hash".into(), hit.file_hash.clone());
        p.insert("keyword".into(), kw_dash.clone());
        p.insert("lrctxt".into(), "1".into());
        p.insert("man".into(), "yes".into());
        attempts.push(p);
    }
    // 3) LyricsKit 式：仅 keyword + duration + client + ver + man（无 hash / 无 album）
    for kw in [kw_dash.clone(), kw_space.clone(), hit.title.clone()] {
        let mut p = BTreeMap::new();
        p.insert("keyword".into(), kw);
        p.insert("duration".into(), dur_ms.to_string());
        p.insert("client".into(), "pc".into());
        p.insert("ver".into(), "1".into());
        p.insert("man".into(), "yes".into());
        attempts.push(p);
    }

    let urls = [
        "https://lyrics.kugou.com/v1/search",
        "http://lyrics.kugou.com/search",
    ];

    let mut pair: Option<(String, String)> = None;
    let mut last_err: Option<String> = None;
    'outer: for p in attempts {
        for url in urls {
            match kugou_lyric_search_response(client, url, p.clone()).await {
                Ok(Some(v)) => {
                    if let Some((id, ak)) = first_kugou_lyric_download_pair(&v) {
                        pair = Some((id, ak));
                        break 'outer;
                    }
                }
                Ok(None) => {}
                Err(e) => last_err = Some(e),
            }
        }
    }

    let (id, accesskey) = match pair {
        Some(p) => p,
        None => {
            return Err(
                last_err.unwrap_or_else(|| "kg: no lyric candidates after all search attempts".into()),
            );
        }
    };
    let mut dlp = BTreeMap::new();
    dlp.insert("accesskey".into(), accesskey);
    dlp.insert("charset".into(), "utf8".into());
    dlp.insert("client".into(), "mobi".into());
    dlp.insert("fmt".into(), "krc".into());
    dlp.insert("id".into(), id);
    dlp.insert("ver".into(), "1".into());
    let dl = kg_lyric_get(client, "http://lyrics.kugou.com/download", dlp).await?;
    let content = dl
        .get("content")
        .and_then(|x| x.as_str())
        .ok_or_else(|| "kg: no content".to_string())?;
    let ct = dl.get("contenttype").and_then(|x| x.as_i64()).unwrap_or(0);
    if ct == 2 {
        use base64::Engine;
        let raw = base64::engine::general_purpose::STANDARD
            .decode(content)
            .map_err(|e| e.to_string())?;
        let s = String::from_utf8(raw).map_err(|e| e.to_string())?;
        let lines = parse_lrc(&s);
        if lines.is_empty() {
            return Ok(line_only_payload(s));
        }
        return Ok(lyric_lines_to_payload(&lines));
    }
    use base64::Engine;
    let raw = base64::engine::general_purpose::STANDARD
        .decode(content)
        .map_err(|e| e.to_string())?;
    let plain = krc_decrypt(&raw)?;
    krc_plain_to_payload(&plain)
}

/// KRC 明文：`[lineStart,lineDur]<off,dur,0>text ...`
fn krc_plain_to_payload(s: &str) -> Result<LyricsPayload, String> {
    let line_re = Regex::new(r"(?m)^\[(\d+),(\d+)\](.*)$").map_err(|e| e.to_string())?;
    let word_re = Regex::new(r"<(\d+),(\d+),\d+>").map_err(|e| e.to_string())?;
    let mut word_lines: Vec<WordLine> = Vec::new();
    let mut lrc_lines: Vec<String> = Vec::new();
    for cap in line_re.captures_iter(s) {
        let ls: u64 = cap[1].parse().map_err(|e: std::num::ParseIntError| e.to_string())?;
        let ld: u64 = cap[2].parse().map_err(|e: std::num::ParseIntError| e.to_string())?;
        let rest = cap[3].trim_end();
        let le = ls + ld;
        let mut words = Vec::new();
        let mut display = String::new();
        for wm in word_re.captures_iter(rest) {
            let wo: u64 = wm[1].parse().map_err(|e: std::num::ParseIntError| e.to_string())?;
            let wd: u64 = wm[2].parse().map_err(|e: std::num::ParseIntError| e.to_string())?;
            let mwhole = wm.get(0).unwrap();
            let text_start = mwhole.end();
            let text_end = rest[text_start..]
                .find('<')
                .map(|i| text_start + i)
                .unwrap_or(rest.len());
            let text = rest[text_start..text_end].to_string();
            let w_start = ls + wo;
            let w_end = w_start + wd;
            display.push_str(&text);
            words.push(WordTiming {
                start_ms: w_start,
                end_ms: w_end,
                text,
            });
        }
        if words.is_empty() {
            let t = rest.to_string();
            words.push(WordTiming {
                start_ms: ls,
                end_ms: le,
                text: t.clone(),
            });
            display = t;
        }
        word_lines.push(WordLine {
            start_ms: ls,
            end_ms: le,
            words,
        });
        let sec = ls / 1000;
        let ms_part = (ls % 1000) as u32;
        let m = sec / 60;
        let s = sec % 60;
        lrc_lines.push(format!(
            "[{:02}:{:02}.{:03}]{}",
            m,
            s,
            ms_part,
            display.trim_end()
        ));
    }
    if word_lines.is_empty() {
        let lines = parse_lrc(s);
        if !lines.is_empty() {
            return Ok(lyric_lines_to_payload(&lines));
        }
        return Ok(line_only_payload(s.to_string()));
    }
    let lrc_text = crate::lyrics::pack_lyrics_for_ui(lrc_lines.join("\n"));
    // KRC 含逐字时间轴；若每行仅一个 `<>`，与行级 LRC 等价，仍交给前端作逐字轨道（与 LDDC 展示一致）
    Ok(LyricsPayload {
        lrc_text,
        word_lines: Some(word_lines),
    })
}
