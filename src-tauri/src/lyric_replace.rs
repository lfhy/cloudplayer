//! 多源歌词搜索与单条拉取（歌词替换对话框）。

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::config::Settings;
use crate::lyric_kugou;
use crate::lyric_qq;
use crate::lyrics::{
    fetch_lrclib_by_id, fetch_netease_lyrics_by_song_id, netease_portal_headers, LyricsFetchIn,
    LyricsPayload,
};
use crate::lrc_format::has_lrc_timestamp_tags;

fn default_sources() -> Vec<String> {
    vec![
        "qq".into(),
        "kugou".into(),
        "netease".into(),
        "lrclib".into(),
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricCandidate {
    pub source: String,
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    #[serde(default)]
    pub duration_ms: Option<i64>,
    #[serde(default)]
    pub qq_mid: Option<String>,
    #[serde(default)]
    pub kugou_hash: Option<String>,
    #[serde(default)]
    pub netease_id: Option<i64>,
    #[serde(default)]
    pub lrclib_id: Option<i64>,
}

pub async fn lyrics_search_candidates(
    client: &Client,
    settings: &Settings,
    keyword: String,
    duration_ms: Option<i64>,
    sources: Option<Vec<String>>,
) -> Result<Vec<LyricCandidate>, String> {
    let mut src = sources.unwrap_or_else(default_sources);
    if !settings.lyrics_lrclib_enabled {
        src.retain(|s| !s.eq_ignore_ascii_case("lrclib"));
    }
    let want = |k: &str| src.iter().any(|x| x.eq_ignore_ascii_case(k));

    let mut out: Vec<LyricCandidate> = Vec::new();

    if want("qq") {
        match lyric_qq::search_songs(client, &keyword, 1).await {
            Ok(hits) => {
                for h in hits {
                    out.push(LyricCandidate {
                        source: "qq".into(),
                        id: h.song_id.to_string(),
                        title: h.title,
                        artist: h.artist,
                        album: h.album,
                        duration_ms: Some(h.duration_ms),
                        qq_mid: Some(h.song_mid),
                        kugou_hash: None,
                        netease_id: None,
                        lrclib_id: None,
                    });
                }
            }
            Err(e) => eprintln!("[lyric_replace] qq search: {e}"),
        }
    }

    if want("kugou") {
        match lyric_kugou::search_songs(client, &keyword, 1).await {
            Ok(hits) => {
                for h in hits {
                    out.push(LyricCandidate {
                        source: "kugou".into(),
                        id: h.album_audio_id.clone(),
                        title: h.title,
                        artist: h.artist,
                        album: h.album,
                        duration_ms: Some(h.duration_ms),
                        qq_mid: None,
                        kugou_hash: Some(h.file_hash),
                        netease_id: None,
                        lrclib_id: None,
                    });
                }
            }
            Err(e) => eprintln!("[lyric_replace] kugou search: {e}"),
        }
    }

    if want("netease") {
        match netease_search_hits(client, &keyword, 20).await {
            Ok(hits) => {
                for (nid, title, artist, album, dms) in hits {
                    out.push(LyricCandidate {
                        source: "netease".into(),
                        id: nid.to_string(),
                        title,
                        artist,
                        album,
                        duration_ms: Some(dms),
                        qq_mid: None,
                        kugou_hash: None,
                        netease_id: Some(nid),
                        lrclib_id: None,
                    });
                }
            }
            Err(e) => eprintln!("[lyric_replace] netease search: {e}"),
        }
    }

    if want("lrclib") {
        match lrclib_search_hits(client, &keyword, duration_ms).await {
            Ok(hits) => {
                for (lid, title, artist, album, dms) in hits {
                    out.push(LyricCandidate {
                        source: "lrclib".into(),
                        id: lid.to_string(),
                        title,
                        artist,
                        album,
                        duration_ms: Some(dms),
                        qq_mid: None,
                        kugou_hash: None,
                        netease_id: None,
                        lrclib_id: Some(lid),
                    });
                }
            }
            Err(e) => eprintln!("[lyric_replace] lrclib search: {e}"),
        }
    }

    Ok(out)
}

async fn netease_search_hits(
    client: &Client,
    keyword: &str,
    limit: usize,
) -> Result<Vec<(i64, String, String, String, i64)>, String> {
    let search = client
        .get("https://music.163.com/api/search/get/web")
        .headers(netease_portal_headers())
        .query(&[("s", keyword), ("type", "1"), ("limit", &limit.to_string())])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !search.status().is_success() {
        return Err(format!("netease search http {}", search.status()));
    }
    let sj: Value = search.json().await.map_err(|e| e.to_string())?;
    if sj.get("code").and_then(|x| x.as_i64()).unwrap_or(0) != 200 {
        return Ok(vec![]);
    }
    let songs = sj
        .pointer("/result/songs")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = Vec::new();
    for song in songs {
        let id = song.get("id").and_then(|x| x.as_i64()).unwrap_or(0);
        if id == 0 {
            continue;
        }
        let title = song.get("name").and_then(|x| x.as_str()).unwrap_or("").to_string();
        let album = song
            .pointer("/al/name")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let mut artists = Vec::new();
        if let Some(ar) = song.get("ar").and_then(|x| x.as_array()) {
            for a in ar {
                if let Some(n) = a.get("name").and_then(|x| x.as_str()) {
                    if !n.is_empty() {
                        artists.push(n.to_string());
                    }
                }
            }
        }
        let artist = artists.join(" / ");
        let dms = song.get("dt").and_then(|x| x.as_i64()).unwrap_or(0);
        out.push((id, title, artist, album, dms));
    }
    Ok(out)
}

async fn lrclib_search_hits(
    client: &Client,
    keyword: &str,
    duration_ms: Option<i64>,
) -> Result<Vec<(i64, String, String, String, i64)>, String> {
    let r = client
        .get("https://lrclib.net/api/search")
        .query(&[("q", keyword)])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !r.status().is_success() {
        return Err(format!("lrclib search http {}", r.status()));
    }
    let v: Value = r.json().await.map_err(|e| e.to_string())?;
    let arr: Vec<Value> = if let Some(a) = v.as_array() {
        a.clone()
    } else if let Some(a) = v.get("results").and_then(|x| x.as_array()) {
        a.clone()
    } else {
        vec![]
    };
    let mut out = Vec::new();
    for v in arr {
        let id = v.get("id").and_then(|x| x.as_i64()).unwrap_or(0);
        if id == 0 {
            continue;
        }
        let title = v
            .get("trackName")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let artist = v
            .get("artistName")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let album = v
            .get("albumName")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let dms = (v.get("duration").and_then(|x| x.as_f64()).unwrap_or(0.0) * 1000.0) as i64;
        if let Some(want) = duration_ms {
            if want > 0 && dms > 0 && (want - dms).abs() > 12_000 {
                continue;
            }
        }
        out.push((id, title, artist, album, dms));
        if out.len() >= 20 {
            break;
        }
    }
    Ok(out)
}

pub async fn lyrics_fetch_candidate(
    client: &Client,
    settings: &Settings,
    c: LyricCandidate,
) -> Result<LyricsPayload, String> {
    match c.source.as_str() {
        "qq" => {
            let sid: i64 = c.id.parse().map_err(|_| "qq: bad id")?;
            let mid = c.qq_mid.clone().unwrap_or_default();
            let dm = c.duration_ms.unwrap_or(0);
            let hit = lyric_qq::QqSearchHit {
                song_id: sid,
                song_mid: mid,
                title: c.title,
                artist: c.artist,
                album: c.album,
                duration_ms: dm,
            };
            lyric_qq::fetch_lyrics(client, &hit).await
        }
        "kugou" => {
            let hit = lyric_kugou::KgSearchHit {
                album_audio_id: c.id,
                file_hash: c.kugou_hash.ok_or_else(|| "kugou: missing hash".to_string())?,
                title: c.title,
                artist: c.artist,
                album: c.album,
                duration_ms: c.duration_ms.unwrap_or(0),
            };
            lyric_kugou::fetch_lyrics(client, &hit).await
        }
        "netease" => {
            let nid = c
                .netease_id
                .or_else(|| c.id.parse().ok())
                .ok_or_else(|| "netease: bad id".to_string())?;
            let api = settings.lyrics_netease_api_base.trim();
            let base = if api.is_empty() {
                None
            } else {
                Some(api)
            };
            fetch_netease_lyrics_by_song_id(client, base, nid)
                .await?
                .ok_or_else(|| "netease: no lyrics".to_string())
        }
        "lrclib" => {
            if !settings.lyrics_lrclib_enabled {
                return Err("lrclib disabled in settings".into());
            }
            let lid = c
                .lrclib_id
                .or_else(|| c.id.parse().ok())
                .ok_or_else(|| "lrclib: bad id".to_string())?;
            fetch_lrclib_by_id(client, lid)
                .await?
                .ok_or_else(|| "lrclib: no lyrics".to_string())
        }
        _ => Err(format!("unknown source {}", c.source)),
    }
}

/// 播放页自动拉词：固定顺序 **QQ → 酷狗 → 网易云 → LRCLIB**（与「换」歌词替换同源），优先逐字歌词。
pub async fn fetch_song_lddc_enriched(
    client: &Client,
    settings: &Settings,
    req: &LyricsFetchIn,
) -> Result<Option<LyricsPayload>, String> {
    let keyword = format!("{} {}", req.artist.trim(), req.title.trim())
        .trim()
        .to_string();
    if keyword.is_empty() {
        return Ok(None);
    }
    let duration_ms = req
        .duration_seconds
        .filter(|d| d.is_finite() && *d > 0.0)
        .map(|d| (d * 1000.0).round() as i64);

    let mut chain = vec!["qq", "kugou", "netease"];
    if settings.lyrics_lrclib_enabled {
        chain.push("lrclib");
    }

    eprintln!(
        "[lyric_replace] auto verify: kw={:?} dur_ms={:?} chain={chain:?}",
        keyword, duration_ms
    );

    // 线性尝试：仅当本源无结果、拉取失败或正文为空时，才进入下一源。
    let mut fallback: Option<LyricsPayload> = None;
    for src in chain {
        let candidates = match lyrics_search_candidates(
            client,
            settings,
            keyword.clone(),
            duration_ms,
            Some(vec![src.to_string()]),
        )
        .await
        {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[lyric_replace] auto verify {src}: search ERR {e}");
                continue;
            }
        };
        if candidates.is_empty() {
            eprintln!("[lyric_replace] auto verify {src}: search 0 hits → next");
            continue;
        }
        let first = candidates[0].clone();
        eprintln!(
            "[lyric_replace] auto verify {src}: {} hit(s), first id={} title={:?}",
            candidates.len(),
            first.id,
            first.title
        );
        match lyrics_fetch_candidate(client, settings, first).await {
            Ok(payload) => {
                if payload.lrc_text.trim().is_empty() {
                    eprintln!("[lyric_replace] auto verify {src}: fetch ok but empty lrc → next");
                    continue;
                }
                let n_wl = payload.word_lines.as_ref().map(|w| w.len());
                let word_level = payload.word_lines.is_some();
                eprintln!(
                    "[lyric_replace] auto verify {src}: fetch ok lrc_chars={} word_level={} word_lines_rows={:?}",
                    payload.lrc_text.len(),
                    word_level,
                    n_wl
                );
                if payload.word_lines.is_some() {
                    eprintln!("[lyric_replace] auto verify: RETURN word-level from {src}");
                    return Ok(Some(payload));
                }
                if fallback.is_none() {
                    eprintln!("[lyric_replace] auto verify: stash LINE-ONLY fallback from {src} (chain continues)");
                    fallback = Some(payload);
                } else {
                    eprintln!("[lyric_replace] auto verify {src}: line-only, keep earlier fallback → next");
                }
            }
            Err(e) => eprintln!("[lyric_replace] auto verify {src}: fetch ERR {e}"),
        }
    }
    match &fallback {
        Some(p) => eprintln!(
            "[lyric_replace] auto verify: RETURN line-only fallback lrc_chars={} (no word-level in chain)",
            p.lrc_text.len()
        ),
        None => eprintln!("[lyric_replace] auto verify: RETURN none (all sources miss)"),
    }
    Ok(fallback)
}

/// 供预览：若文本不像 LRC，仍返回一段可读文本（前端目前直接用 `lrc_text`）。
#[allow(dead_code)]
pub fn preview_text_from_payload(p: &LyricsPayload) -> String {
    let t = p.lrc_text.trim();
    if has_lrc_timestamp_tags(t) {
        t.to_string()
    } else {
        t.chars().take(8000).collect()
    }
}
