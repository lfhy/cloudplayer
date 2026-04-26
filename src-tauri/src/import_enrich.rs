//! 导入歌单条目后台富化：搜索曲库 id、封面缓存、song.php 补专辑/时长（与 Py `ImportPlaylistEnrichThread` / `import_metadata_resolve` 对齐）。

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use reqwest::Client;
use rusqlite::Connection;
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::sleep;

use crate::commands::AppState;
use crate::config::config_dir;
use crate::db::DbState;
use crate::pjmp3::{
    extract_album_from_song_html, extract_duration_ms_from_song_html, fetch_song_page_html,
    search_pjmp3, SearchResultDto,
};

const ENRICH_DELAY_MS: u64 = 120;
const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

#[derive(Clone, Debug)]
struct ImportRow {
    id: i64,
    title: String,
    artist: String,
    album: String,
    pjmp3_source_id: String,
    cover_url: String,
    cover_cache_path: String,
    duration_ms: i64,
}

fn cover_cache_dir() -> PathBuf {
    config_dir().join("cover_cache")
}

fn load_row(conn: &Connection, playlist_id: i64, row_id: i64) -> Result<Option<ImportRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        r#"SELECT id, title, artist, album, pjmp3_source_id, cover_url, cover_cache_path, duration_ms
           FROM playlist_import_items WHERE id=?1 AND playlist_id=?2"#,
    )?;
    let mut rows = stmt.query_map(rusqlite::params![row_id, playlist_id], |r| {
        Ok(ImportRow {
            id: r.get(0)?,
            title: r.get::<_, Option<String>>(1)?.unwrap_or_default(),
            artist: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
            album: r.get::<_, Option<String>>(3)?.unwrap_or_default(),
            pjmp3_source_id: r.get::<_, Option<String>>(4)?.unwrap_or_default(),
            cover_url: r.get::<_, Option<String>>(5)?.unwrap_or_default(),
            cover_cache_path: r.get::<_, Option<String>>(6)?.unwrap_or_default(),
            duration_ms: r.get(7)?,
        })
    })?;
    Ok(rows.next().transpose()?)
}

fn load_all_rows(conn: &Connection, playlist_id: i64) -> Result<Vec<ImportRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        r#"SELECT id, title, artist, album, pjmp3_source_id, cover_url, cover_cache_path, duration_ms
           FROM playlist_import_items WHERE playlist_id=?1 ORDER BY sort_order ASC, id ASC"#,
    )?;
    let rows = stmt.query_map([playlist_id], |r| {
        Ok(ImportRow {
            id: r.get(0)?,
            title: r.get::<_, Option<String>>(1)?.unwrap_or_default(),
            artist: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
            album: r.get::<_, Option<String>>(3)?.unwrap_or_default(),
            pjmp3_source_id: r.get::<_, Option<String>>(4)?.unwrap_or_default(),
            cover_url: r.get::<_, Option<String>>(5)?.unwrap_or_default(),
            cover_cache_path: r.get::<_, Option<String>>(6)?.unwrap_or_default(),
            duration_ms: r.get(7)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn needs_enrichment(t: &ImportRow) -> bool {
    if t.title.trim().is_empty() {
        return false;
    }
    let sid = t.pjmp3_source_id.trim();
    if sid.is_empty() {
        return true;
    }
    let cu = t.cover_url.trim();
    let cp = t.cover_cache_path.trim();
    if !cu.is_empty() && (cp.is_empty() || !Path::new(cp).is_file()) {
        return true;
    }
    t.album.trim().is_empty() || t.duration_ms <= 0
}

async fn download_cover(client: &Client, url: &str, dest: &Path) -> Result<(), String> {
    if url.trim().is_empty() {
        return Err("empty url".to_string());
    }
    let resp = client
        .get(url)
        .header("User-Agent", UA)
        .header("Accept", "image/*,*/*;q=0.8")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() < 32 {
        return Err("cover too small".to_string());
    }
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(dest, &bytes).map_err(|e| e.to_string())?;
    Ok(())
}

/// 搜索首条写入导入行（无曲库 id 时）。网络请求在锁外完成。
async fn apply_search_metadata(
    app: &AppHandle,
    client: &Client,
    app_state: &AppState,
    playlist_id: i64,
    row: &ImportRow,
) -> Result<(), String> {
    let kw = format!("{} {}", row.title.trim(), row.artist.trim());
    let q = kw.trim();
    let q = if q.is_empty() {
        row.title.trim().to_string()
    } else {
        q.to_string()
    };
    if q.is_empty() {
        return Ok(());
    }
    app_state.limiter.acquire_slot().await;
    let (results, _) = search_pjmp3(client, &q, 1).await?;
    let Some(first) = results.into_iter().next() else {
        return Ok(());
    };
    if first.source_id.trim().is_empty() {
        return Ok(());
    }
    let cover_path = cache_search_cover(client, app_state, &first).await;
    let cover_url_s = first.cover_url.clone().unwrap_or_default();
    let db: tauri::State<'_, DbState> = app.state();
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        r#"UPDATE playlist_import_items SET
            title=?1, artist=?2, album=?3, pjmp3_source_id=?4, cover_url=?5, cover_cache_path=?6
           WHERE id=?7 AND playlist_id=?8"#,
        rusqlite::params![
            first.title,
            first.artist,
            first.album,
            first.source_id,
            cover_url_s,
            cover_path.as_deref().unwrap_or(""),
            row.id,
            playlist_id,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

async fn cache_search_cover(
    client: &Client,
    app_state: &AppState,
    first: &SearchResultDto,
) -> Option<String> {
    let u = first.cover_url.as_ref()?.trim();
    if u.is_empty() {
        return None;
    }
    let _ = std::fs::create_dir_all(cover_cache_dir());
    let sid = first.source_id.trim();
    let path = cover_cache_dir().join(format!("cov_{sid}.jpg"));
    app_state.limiter.acquire_slot().await;
    if download_cover(client, u, &path).await.is_ok() {
        return Some(path.to_string_lossy().to_string());
    }
    None
}

/// 已有 URL 时仅下载封面到缓存。
async fn ensure_cover_file(
    client: &Client,
    app_state: &AppState,
    row: &ImportRow,
) -> Result<Option<String>, String> {
    let sid = row.pjmp3_source_id.trim();
    let cu = row.cover_url.trim();
    if sid.is_empty() || cu.is_empty() {
        return Ok(None);
    }
    let cp = row.cover_cache_path.trim();
    if !cp.is_empty() && Path::new(cp).is_file() {
        return Ok(None);
    }
    let _ = std::fs::create_dir_all(cover_cache_dir());
    let path = cover_cache_dir().join(format!("cov_{sid}.jpg"));
    app_state.limiter.acquire_slot().await;
    match download_cover(client, cu, &path).await {
        Ok(()) => Ok(Some(path.to_string_lossy().to_string())),
        Err(_) => Ok(None),
    }
}

fn update_row_cover_cache(conn: &Connection, playlist_id: i64, row_id: i64, path: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE playlist_import_items SET cover_cache_path=?1 WHERE id=?2 AND playlist_id=?3",
        rusqlite::params![path, row_id, playlist_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

async fn enrich_song_page_and_album_search(
    app: &AppHandle,
    client: &Client,
    app_state: &AppState,
    playlist_id: i64,
    row: &ImportRow,
) -> Result<(), String> {
    let sid = row.pjmp3_source_id.trim();
    if sid.is_empty() {
        return Ok(());
    }
    let need_album = row.album.trim().is_empty();
    let need_dur = row.duration_ms <= 0;
    if !need_album && !need_dur {
        return Ok(());
    }
    app_state.limiter.acquire_slot().await;
    let html = fetch_song_page_html(client, sid).await.unwrap_or_default();
    let mut album = row.album.clone();
    let mut dur = row.duration_ms;
    if need_album {
        if let Some(a) = extract_album_from_song_html(&html) {
            if !a.trim().is_empty() {
                album = a;
            }
        }
    }
    if need_dur {
        let d = extract_duration_ms_from_song_html(&html);
        if d > 0 {
            dur = d;
        }
    }
    if need_album && album.trim().is_empty() {
        let kw = format!("{} {}", row.title.trim(), row.artist.trim());
        let q = kw.trim().to_string();
        if !q.is_empty() {
            app_state.limiter.acquire_slot().await;
            if let Ok((results, _)) = search_pjmp3(client, &q, 1).await {
                if let Some(r0) = results.first() {
                    if r0.source_id.trim() == sid && !r0.album.trim().is_empty() {
                        album = r0.album.clone();
                    }
                }
            }
        }
    }
    let db: tauri::State<'_, DbState> = app.state();
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE playlist_import_items SET album=?1, duration_ms=?2 WHERE id=?3 AND playlist_id=?4",
        rusqlite::params![album, dur, row.id, playlist_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 为缺少曲库 id 的单条导入记录尝试搜索并写库；已有 id 则直接返回该 id。
/// 用于播放/批量下载前补全 `pjmp3_source_id`。
pub async fn try_resolve_import_row_source_id(
    app: &AppHandle,
    client: &Client,
    app_state: &AppState,
    playlist_id: i64,
    row_id: i64,
) -> Result<Option<String>, String> {
    if playlist_id <= 0 || row_id <= 0 {
        return Ok(None);
    }
    let row = {
        let db: tauri::State<'_, DbState> = app.state();
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        load_row(&conn, playlist_id, row_id).map_err(|e| e.to_string())?
    };
    let Some(row) = row else {
        return Ok(None);
    };
    let existing = row.pjmp3_source_id.trim();
    if !existing.is_empty() {
        return Ok(Some(existing.to_string()));
    }
    apply_search_metadata(app, client, app_state, playlist_id, &row).await?;
    let row2 = {
        let db: tauri::State<'_, DbState> = app.state();
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        load_row(&conn, playlist_id, row_id).map_err(|e| e.to_string())?
    };
    Ok(row2.and_then(|r| {
        let s = r.pjmp3_source_id.trim();
        if s.is_empty() {
            None
        } else {
            Some(s.to_string())
        }
    }))
}

pub fn spawn_playlist_enrich(app: AppHandle, playlist_id: i64) {
    if playlist_id <= 0 {
        return;
    }
    // Tauri 命令在同步上下文执行，不能用 `tokio::spawn`（无 runtime）；用 Tauri 全局异步运行时
    tauri::async_runtime::spawn(async move {
        if let Err(e) = run_enrich(app, playlist_id).await {
            eprintln!("import enrich playlist {playlist_id}: {e}");
        }
    });
}

async fn run_enrich(app: AppHandle, playlist_id: i64) -> Result<(), String> {
    let st: tauri::State<'_, Arc<AppState>> = app.state();
    let app_state_arc = Arc::clone(&*st);
    let client = app_state_arc.client.clone();

    let row_ids: Vec<i64> = {
        let db: tauri::State<'_, DbState> = app.state();
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let rows = load_all_rows(&conn, playlist_id).map_err(|e| e.to_string())?;
        rows.into_iter().map(|r| r.id).collect()
    };

    for rid in row_ids {
        sleep(Duration::from_millis(ENRICH_DELAY_MS)).await;

        let row = {
            let db: tauri::State<'_, DbState> = app.state();
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            load_row(&conn, playlist_id, rid).map_err(|e| e.to_string())?
        };
        let Some(mut row) = row else {
            continue;
        };
        if !needs_enrichment(&row) {
            continue;
        }

        if row.pjmp3_source_id.trim().is_empty() {
            apply_search_metadata(&app, &client, app_state_arc.as_ref(), playlist_id, &row).await?;
            let _ = app.emit(
                "import-enrich-item-done",
                serde_json::json!({ "playlistId": playlist_id, "rowId": rid }),
            );
            row = {
                let db: tauri::State<'_, DbState> = app.state();
                let conn = db.conn.lock().map_err(|e| e.to_string())?;
                load_row(&conn, playlist_id, rid)
                    .map_err(|e| e.to_string())?
                    .unwrap_or(row)
            };
        }

        if row.pjmp3_source_id.trim().is_empty() {
            continue;
        }

        let r_cover = row.clone();
        let cover_res = ensure_cover_file(&client, app_state_arc.as_ref(), &r_cover).await;
        if let Ok(Some(path)) = cover_res {
            let db: tauri::State<'_, DbState> = app.state();
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            update_row_cover_cache(&conn, playlist_id, rid, &path)?;
            let _ = app.emit(
                "import-enrich-item-done",
                serde_json::json!({ "playlistId": playlist_id, "rowId": rid }),
            );
        }

        let row = {
            let db: tauri::State<'_, DbState> = app.state();
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            load_row(&conn, playlist_id, rid)
                .map_err(|e| e.to_string())?
                .unwrap_or(row)
        };

        let need_album = row.album.trim().is_empty();
        let need_dur = row.duration_ms <= 0;
        if need_album || need_dur {
            enrich_song_page_and_album_search(&app, &client, app_state_arc.as_ref(), playlist_id, &row).await?;
            let _ = app.emit(
                "import-enrich-item-done",
                serde_json::json!({ "playlistId": playlist_id, "rowId": rid }),
            );
        }
    }

    let _ = app.emit(
        "import-enrich-finished",
        serde_json::json!({ "playlistId": playlist_id }),
    );
    Ok(())
}
