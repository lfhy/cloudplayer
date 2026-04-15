//! 多源歌词解析：pjmp3 页内 LRC →（可选）网易云 API →（可选）LRCLIB。

use reqwest::Client;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, REFERER, USER_AGENT};
use serde::Deserialize;
use serde_json::Value;

use crate::config::Settings;
use crate::pjmp3::fetch_song_lrc_text;

fn netease_portal_headers() -> HeaderMap {
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
    pub pjmp3_source_id: Option<String>,
    pub title: String,
    pub artist: String,
    #[serde(default)]
    #[allow(dead_code)] // 预留：本地元数据歌词
    pub local_path: Option<String>,
    /// 秒，可选，用于 LRCLIB 匹配
    #[serde(default)]
    pub duration_seconds: Option<f64>,
}

enum Prov {
    Pjmp3,
    Netease,
    Lrclib,
}

fn parse_order(s: &str) -> Vec<Prov> {
    let mut out = Vec::new();
    for p in s.split(',') {
        match p.trim().to_ascii_lowercase().as_str() {
            "pjmp3" => out.push(Prov::Pjmp3),
            "netease" => out.push(Prov::Netease),
            "lrclib" => out.push(Prov::Lrclib),
            _ => {}
        }
    }
    if out.is_empty() {
        out.push(Prov::Pjmp3);
        out.push(Prov::Lrclib);
    }
    out
}

fn looks_like_lrc(text: &str) -> bool {
    let t = text.trim_start();
    t.starts_with('[') || t.contains("[00:") || t.contains("[01:") || t.contains("[02:")
}

async fn lyric_lrclib(
    client: &Client,
    title: &str,
    artist: &str,
    duration_seconds: Option<f64>,
) -> Result<Option<String>, String> {
    let mut req = client
        .get("https://lrclib.net/api/get")
        .query(&[("track_name", title), ("artist_name", artist)]);
    if let Some(d) = duration_seconds {
        if d.is_finite() && d > 0.0 {
            req = req.query(&[("duration", &d.round().max(1.0).to_string())]);
        }
    }
    let r = req.send().await.map_err(|e| e.to_string())?;
    if !r.status().is_success() {
        return Ok(None);
    }
    let v: Value = r.json::<Value>().await.map_err(|e| e.to_string())?;
    if let Some(s) = v.get("syncedLyrics").and_then(|x| x.as_str()) {
        if looks_like_lrc(s) {
            return Ok(Some(s.to_string()));
        }
    }
    if let Some(s) = v.get("plainLyrics").and_then(|x| x.as_str()) {
        if looks_like_lrc(s) {
            return Ok(Some(s.to_string()));
        }
    }
    Ok(None)
}

/// 直连 music.163.com 网页 API（不依赖自托管 NeteaseCloudMusicApi）。
async fn lyric_netease_music163_portal(
    client: &Client,
    title: &str,
    artist: &str,
) -> Result<Option<String>, String> {
    let kw = format!("{artist} {title}");
    let search = client
        .get("https://music.163.com/api/search/get/web")
        .headers(netease_portal_headers())
        .query(&[("s", kw.as_str()), ("type", "1"), ("limit", "8")])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !search.status().is_success() {
        return Ok(None);
    }
    let sj: Value = search.json::<Value>().await.map_err(|e| e.to_string())?;
    if sj.get("code").and_then(|x| x.as_i64()).unwrap_or(0) != 200 {
        return Ok(None);
    }
    let id = sj
        .pointer("/result/songs/0/id")
        .and_then(|x| x.as_i64())
        .or_else(|| sj.pointer("/result/songs/0/song/id").and_then(|x| x.as_i64()));
    let Some(nid) = id else {
        return Ok(None);
    };
    let lr = client
        .get("https://music.163.com/api/song/lyric")
        .headers(netease_portal_headers())
        .query(&[
            ("id", nid.to_string()),
            ("lv", "-1".to_string()),
            ("kv", "-1".to_string()),
            ("tv", "-1".to_string()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !lr.status().is_success() {
        return Ok(None);
    }
    let lj: Value = lr.json::<Value>().await.map_err(|e| e.to_string())?;
    if let Some(ly) = lj.pointer("/lrc/lyric").and_then(|x| x.as_str()) {
        if looks_like_lrc(ly) {
            return Ok(Some(ly.to_string()));
        }
    }
    if let Some(ly) = lj.get("lrc").and_then(|x| x.as_str()) {
        if looks_like_lrc(ly) {
            return Ok(Some(ly.to_string()));
        }
    }
    Ok(None)
}

async fn lyric_netease(
    client: &Client,
    api_base: &str,
    title: &str,
    artist: &str,
) -> Result<Option<String>, String> {
    let base = api_base.trim().trim_end_matches('/');
    if base.is_empty() {
        return Ok(None);
    }
    let kw = format!("{artist} {title}");
    let search = client
        .get(format!("{base}/cloudsearch"))
        .query(&[("keywords", kw.as_str()), ("type", "1"), ("limit", "5")])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !search.status().is_success() {
        return Ok(None);
    }
    let sj: Value = search.json::<Value>().await.map_err(|e| e.to_string())?;
    let id = sj
        .pointer("/result/songs/0/id")
        .and_then(|x| x.as_i64())
        .or_else(|| sj.pointer("/songs/0/id").and_then(|x| x.as_i64()));
    let Some(nid) = id else {
        return Ok(None);
    };
    let lr = client
        .get(format!("{base}/lyric"))
        .query(&[("id", nid.to_string())])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !lr.status().is_success() {
        return Ok(None);
    }
    let lj: Value = lr.json::<Value>().await.map_err(|e| e.to_string())?;
    if let Some(ly) = lj.pointer("/lrc/lyric").and_then(|x| x.as_str()) {
        if looks_like_lrc(ly) {
            return Ok(Some(ly.to_string()));
        }
    }
    if let Some(ly) = lj.get("lrc").and_then(|x| x.as_str()) {
        if looks_like_lrc(ly) {
            return Ok(Some(ly.to_string()));
        }
    }
    Ok(None)
}

pub async fn fetch_song_lrc_enriched(
    client: &Client,
    settings: &Settings,
    req: &LyricsFetchIn,
) -> Result<Option<String>, String> {
    let order = parse_order(&settings.lyrics_provider_order);
    for p in order {
        match p {
            Prov::Pjmp3 => {
                if let Some(ref sid) = req.pjmp3_source_id {
                    let t = sid.trim();
                    if !t.is_empty() {
                        if let Some(txt) = fetch_song_lrc_text(client, t).await? {
                            if looks_like_lrc(&txt) {
                                return Ok(Some(txt));
                            }
                        }
                    }
                }
            }
            Prov::Netease => {
                let mut txt: Option<String> = None;
                if !settings.lyrics_netease_api_base.trim().is_empty() {
                    txt = lyric_netease(
                        client,
                        settings.lyrics_netease_api_base.trim(),
                        &req.title,
                        &req.artist,
                    )
                    .await?;
                }
                if txt.is_none() {
                    txt = lyric_netease_music163_portal(client, &req.title, &req.artist).await?;
                }
                if let Some(t) = txt {
                    return Ok(Some(t));
                }
            }
            Prov::Lrclib => {
                if settings.lyrics_lrclib_enabled {
                    if let Some(txt) = lyric_lrclib(
                        client,
                        &req.title,
                        &req.artist,
                        req.duration_seconds,
                    )
                    .await?
                    {
                        return Ok(Some(txt));
                    }
                }
            }
        }
    }
    Ok(None)
}
