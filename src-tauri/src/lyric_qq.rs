//! QQ 音乐歌词：`musicu.fcg` 搜索 + `GetPlayLyricInfo` 取 QRC，解密后解析为 [`LyricsPayload`]。

use base64::Engine;
use flate2::read::ZlibDecoder;
use rand::Rng;
use regex::Regex;
use reqwest::Client;
use serde_json::{json, Value};

use crate::lyrics::{line_only_payload, LyricsPayload};

const QRC_KEY: &[u8; 24] = b"!@#)(*$%123ZXC!@!@#)(NHL";
const MUSICU_URL: &str = "https://u.y.qq.com/cgi-bin/musicu.fcg";

/// Prefix of `s` with at most `max_chars` Unicode scalar values (never splits UTF-8).
fn utf8_prefix_chars(s: &str, max_chars: usize) -> &str {
    if max_chars == 0 {
        return "";
    }
    match s.char_indices().nth(max_chars) {
        None => s,
        Some((idx, _)) => &s[..idx],
    }
}

fn qrc_decrypt_hex(encrypted_hex: &str) -> Result<String, String> {
    let encrypted_hex = encrypted_hex.trim();
    if encrypted_hex.is_empty() {
        return Err("empty qrc".into());
    }
    let buf = hex::decode(encrypted_hex).map_err(|e| format!("hex decode: {e}"))?;
    if buf.len() % 8 != 0 {
        return Err(format!("qrc len not multiple of 8: {}", buf.len()));
    }
    let des = crate::qrc_des::QrcTripleDes::new_decrypt(QRC_KEY);
    let mut dec = Vec::with_capacity(buf.len());
    for chunk in buf.chunks(8) {
        dec.extend_from_slice(&des.decrypt_block(chunk));
    }
    let mut decoder = ZlibDecoder::new(&dec[..]);
    let mut out = Vec::new();
    std::io::Read::read_to_end(&mut decoder, &mut out)
        .map_err(|e| format!("zlib: {e} (first4={:02x?})", &dec[..dec.len().min(4)]))?;
    String::from_utf8(out).map_err(|e| format!("utf8: {e}"))
}

fn try_decode_lyric_content(s: &str) -> String {
    let t = s.trim();
    if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(t) {
        if let Ok(u) = String::from_utf8(bytes) {
            if u.contains('[') || u.contains('<') {
                return u;
            }
        }
    }
    t.to_string()
}

fn extract_yrc_body(s: &str) -> Option<String> {
    let re = Regex::new(r"(?s)<Lyric[^>]*>(.*)</Lyric>").ok()?;
    re.captures(s).and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
}

/// 从解密后的 QRC 文本生成载荷（与 LDDC `qrc.py` / `yrc.py` 及增强 LRC 一致，不经 amll YRC）。
fn qrc_plain_to_payload(s: &str) -> Option<LyricsPayload> {
    let trimmed = s.trim();
    if let Some(p) = crate::lddc_parse::try_lddc_qq_lyrics_plain(trimmed) {
        return Some(p);
    }
    if let Some(body) = extract_yrc_body(trimmed) {
        if let Some(p) = crate::lddc_parse::try_lddc_qq_lyrics_plain(body.trim()) {
            return Some(p);
        }
    }
    if let Some(cap) = Regex::new(r#"LyricContent\s*=\s*"([^"]*)"#)
        .ok()
        .and_then(|re| re.captures(trimmed))
    {
        let inner = cap.get(1)?.as_str();
        let decoded = try_decode_lyric_content(inner);
        if let Some(pl) = qrc_plain_to_payload(&decoded) {
            return Some(pl);
        }
        if crate::lrc_format::has_lrc_timestamp_tags(&decoded) {
            return Some(line_only_payload(decoded));
        }
    }
    if let Some(cap) = Regex::new(r"(?s)<!\[CDATA\[(.*?)\]\]>")
        .ok()
        .and_then(|re| re.captures(trimmed))
    {
        let inner = cap.get(1)?.as_str();
        return qrc_plain_to_payload(inner).or_else(|| {
            if crate::lrc_format::has_lrc_timestamp_tags(inner) {
                Some(line_only_payload(inner.to_string()))
            } else {
                None
            }
        });
    }
    None
}

fn qq_headers() -> reqwest::header::HeaderMap {
    let mut h = reqwest::header::HeaderMap::new();
    h.insert(
        reqwest::header::COOKIE,
        reqwest::header::HeaderValue::from_static("tmeLoginType=-1;"),
    );
    h.insert(
        reqwest::header::CONTENT_TYPE,
        reqwest::header::HeaderValue::from_static("application/json"),
    );
    h.insert(
        reqwest::header::USER_AGENT,
        reqwest::header::HeaderValue::from_static("okhttp/3.14.9"),
    );
    h
}

fn qq_comm_base() -> Value {
    json!({
        "ct": 11,
        "cv": "1003006",
        "v": "1003006",
        "os_ver": "15",
        "phonetype": "24122RKC7C",
        "rom": "Redmi/miro/miro:15/AE3A.240806.005/OS2.0.105.0.VOMCNXM:user/release-keys",
        "tmeAppID": "qqmusiclight",
        "nettype": "NETWORK_WIFI",
        "udid": "0",
    })
}

async fn qq_musicu(
    client: &Client,
    comm: &Value,
    method: &str,
    module: &str,
    param: &Value,
) -> Result<Value, String> {
    let body = json!({
        "comm": comm,
        "request": { "method": method, "module": module, "param": param }
    });
    let r = client
        .post(MUSICU_URL)
        .headers(qq_headers())
        .body(body.to_string())
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !r.status().is_success() {
        return Err(format!("qq http {}", r.status()));
    }
    let v: Value = r.json().await.map_err(|e| e.to_string())?;
    let code = v.get("code").and_then(|x| x.as_i64()).unwrap_or(-1);
    let req_code = v
        .pointer("/request/code")
        .and_then(|x| x.as_i64())
        .unwrap_or(-1);
    if code != 0 || req_code != 0 {
        return Err(format!("qq api code {code} request {req_code}"));
    }
    v.pointer("/request/data")
        .cloned()
        .ok_or_else(|| "qq: missing request.data".to_string())
}

async fn qq_comm_with_session(client: &Client) -> Result<Value, String> {
    let param = json!({"caller": 0, "uid": "0", "vkey": 0});
    let data = qq_musicu(
        client,
        &qq_comm_base(),
        "GetSession",
        "music.getSession.session",
        &param,
    )
    .await?;
    let session = data
        .get("session")
        .ok_or_else(|| "qq: no session".to_string())?;
    let mut comm = qq_comm_base();
    if let Some(o) = comm.as_object_mut() {
        o.insert(
            "uid".into(),
            session.get("uid").cloned().unwrap_or(json!("0")),
        );
        o.insert(
            "sid".into(),
            session.get("sid").cloned().unwrap_or(json!("")),
        );
        o.insert(
            "userip".into(),
            session.get("userip").cloned().unwrap_or(json!("")),
        );
    }
    Ok(comm)
}

/// 搜索单曲。
pub async fn search_songs(client: &Client, keyword: &str, page: i64) -> Result<Vec<QqSearchHit>, String> {
    let comm = qq_comm_with_session(client).await?;
    let ts = chrono::Utc::now().timestamp_millis();
    let r: u128 = rand::thread_rng().gen();
    let search_id = format!(
        "{}",
        (r % 1_000_000_000_000_000_000) as i128 + ((ts % 86400000) * 1_000_000) as i128
    );
    let param = json!({
        "search_id": search_id,
        "remoteplace": "search.android.keyboard",
        "query": keyword,
        "search_type": 0,
        "num_per_page": 20,
        "page_num": page,
        "highlight": 0,
        "nqc_flag": 0,
        "page_id": 1,
        "grp": 1,
    });
    let data = qq_musicu(
        client,
        &comm,
        "DoSearchForQQMusicLite",
        "music.search.SearchCgiService",
        &param,
    )
    .await?;
    let items = data
        .pointer("/body/item_song")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = Vec::new();
    for it in items {
        let id = it.get("id").and_then(|x| x.as_i64()).unwrap_or(0);
        let mid = it.get("mid").and_then(|x| x.as_str()).unwrap_or("").to_string();
        let title = it.get("title").and_then(|x| x.as_str()).unwrap_or("").to_string();
        let album = it
            .pointer("/album/name")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let mut artists = Vec::new();
        if let Some(arr) = it.get("singer").and_then(|x| x.as_array()) {
            for s in arr {
                if let Some(n) = s.get("name").and_then(|x| x.as_str()) {
                    if !n.is_empty() {
                        artists.push(n.to_string());
                    }
                }
            }
        }
        let artist = artists.join(" / ");
        let duration_ms = it.get("interval").and_then(|x| x.as_i64()).unwrap_or(0) * 1000;
        if id > 0 {
            out.push(QqSearchHit {
                song_id: id,
                song_mid: mid,
                title,
                artist,
                album,
                duration_ms,
            });
        }
    }
    Ok(out)
}

#[derive(Debug, Clone)]
pub struct QqSearchHit {
    pub song_id: i64,
    pub song_mid: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: i64,
}

fn play_lyric_param_qrc(hit: &QqSearchHit) -> Value {
    let album_b64 = base64::engine::general_purpose::STANDARD.encode(hit.album.as_bytes());
    let song_b64 = base64::engine::general_purpose::STANDARD.encode(hit.title.as_bytes());
    let singer_b64 = base64::engine::general_purpose::STANDARD.encode(hit.artist.as_bytes());
    let dur_sec = (hit.duration_ms / 1000).max(1);
    json!({
        "albumName": album_b64,
        "crypt": 1,
        "ct": 19,
        "cv": 2111,
        "interval": dur_sec,
        "lrc_t": 0,
        "qrc": 1,
        "qrc_t": 0,
        "roma": 1,
        "roma_t": 0,
        "singerName": singer_b64,
        "songID": hit.song_id,
        "songName": song_b64,
        "trans": 1,
        "trans_t": 0,
        "type": 0,
    })
}

/// 行级 LRC（无 QRC 加密）；`lrc_t` 置 1 以尽量拉取带时间轴文本。
fn play_lyric_param_line_lrc(hit: &QqSearchHit) -> Value {
    let album_b64 = base64::engine::general_purpose::STANDARD.encode(hit.album.as_bytes());
    let song_b64 = base64::engine::general_purpose::STANDARD.encode(hit.title.as_bytes());
    let singer_b64 = base64::engine::general_purpose::STANDARD.encode(hit.artist.as_bytes());
    let dur_sec = (hit.duration_ms / 1000).max(1);
    json!({
        "albumName": album_b64,
        "crypt": 0,
        "interval": dur_sec,
        "lrc_t": 1,
        "qrc": 0,
        "qrc_t": 0,
        "singerName": singer_b64,
        "songID": hit.song_id,
        "songName": song_b64,
        "trans": 0,
        "trans_t": 0,
        "type": 0,
    })
}

fn looks_like_hex_ciphertext(s: &str) -> bool {
    let t = s.trim();
    !t.is_empty() && t.len() % 2 == 0 && t.len() >= 16 && t.chars().all(|c| c.is_ascii_hexdigit())
}

/// 解析 `GetPlayLyricInfo` 返回的 `data`：支持 QRC 密文 hex、解密后 XML/YRC、或行级 LRC/base64。
fn payload_from_play_lyric_data(data: &Value) -> Result<LyricsPayload, String> {
    let lyric = data.get("lyric").and_then(|x| x.as_str()).unwrap_or("").trim();
    if lyric.is_empty() {
        return Err("qq: empty lyric field".into());
    }
    let is_hex = looks_like_hex_ciphertext(lyric);
    eprintln!(
        "[lyric_qq] lyric field len={} is_hex={} preview={:?}",
        lyric.len(),
        is_hex,
        utf8_prefix_chars(lyric, 120)
    );
    if is_hex {
        match qrc_decrypt_hex(lyric) {
            Ok(plain) => {
                eprintln!(
                    "[lyric_qq] qrc decrypt ok bytes={} preview={:?}",
                    plain.len(),
                    utf8_prefix_chars(&plain, 200)
                );
                if let Some(p) = qrc_plain_to_payload(&plain) {
                    if p.word_lines.is_some() {
                        eprintln!("[lyric_qq] qrc_plain_to_payload → word-level OK");
                        return Ok(p);
                    }
                    eprintln!("[lyric_qq] qrc_plain_to_payload returned line-only, retrying raw body");
                    if let Some(wp) = crate::lddc_parse::try_parse_qrc_inner_body_pub(&plain) {
                        if wp.word_lines.is_some() {
                            return Ok(wp);
                        }
                    }
                    return Ok(p);
                }
                eprintln!("[lyric_qq] qrc_plain_to_payload returned None, falling back to line_only");
                let packed = crate::lyrics::pack_lyrics_for_ui(plain.clone());
                if crate::lrc_format::has_lrc_timestamp_tags(&packed) {
                    return Ok(line_only_payload(packed));
                }
                return Ok(line_only_payload(plain));
            }
            Err(e) => {
                eprintln!("[lyric_qq] qrc_decrypt_hex FAILED: {e}");
            }
        }
    }
    let decoded = try_decode_lyric_content(lyric);
    eprintln!(
        "[lyric_qq] decoded (non-hex) bytes={} preview={:?}",
        decoded.len(),
        utf8_prefix_chars(&decoded, 200)
    );
    if let Some(p) = crate::lddc_parse::try_lddc_qq_lyrics_plain(&decoded) {
        eprintln!(
            "[lyric_qq] try_lddc_qq_lyrics_plain → word_lines={}",
            p.word_lines.is_some()
        );
        return Ok(p);
    }
    eprintln!("[lyric_qq] try_lddc_qq_lyrics_plain → None, packing");
    let packed = crate::lyrics::pack_lyrics_for_ui(decoded.clone());
    if crate::lrc_format::has_lrc_timestamp_tags(&packed) {
        return Ok(line_only_payload(packed));
    }
    Err("qq: could not parse lyric body".into())
}

pub async fn fetch_lyrics(client: &Client, hit: &QqSearchHit) -> Result<LyricsPayload, String> {
    let comm = qq_comm_with_session(client).await?;
    let param_qrc = play_lyric_param_qrc(hit);
    eprintln!("[lyric_qq] fetch_lyrics: trying QRC request for songID={}", hit.song_id);
    let r1 = qq_musicu(
        client,
        &comm,
        "GetPlayLyricInfo",
        "music.musichallSong.PlayLyricInfo",
        &param_qrc,
    )
    .await;
    match &r1 {
        Ok(ref data) => {
            eprintln!("[lyric_qq] QRC request OK, parsing...");
            match payload_from_play_lyric_data(data) {
                Ok(p) => {
                    eprintln!(
                        "[lyric_qq] QRC request → payload word_level={}",
                        p.word_lines.is_some()
                    );
                    return Ok(p);
                }
                Err(e) => eprintln!("[lyric_qq] QRC request parse failed: {e}"),
            }
        }
        Err(e) => eprintln!("[lyric_qq] QRC request FAILED: {e}"),
    }
    eprintln!("[lyric_qq] falling back to LRC request");
    let param_lrc = play_lyric_param_line_lrc(hit);
    let data2 = qq_musicu(
        client,
        &comm,
        "GetPlayLyricInfo",
        "music.musichallSong.PlayLyricInfo",
        &param_lrc,
    )
    .await?;
    payload_from_play_lyric_data(&data2)
}
