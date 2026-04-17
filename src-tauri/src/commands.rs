use std::path::PathBuf;
use std::sync::Arc;

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
#[cfg(desktop)]
use tauri::Manager;
use tauri::{AppHandle, State};
use walkdir::WalkDir;

use crate::import_enrich;

use crate::config::Settings;
use crate::db::DbState;
use crate::pjmp3::SearchResultDto;
use crate::rate_limiter::RateLimiter;

/// HTTP 客户端与搜索限速（与 Python 侧行为接近，避免短时间大量请求）。
#[derive(Clone)]
pub struct AppState {
    pub client: reqwest::Client,
    pub limiter: Arc<RateLimiter>,
    pub download_tx: tokio::sync::mpsc::Sender<crate::download::DownloadJob>,
}

#[derive(Serialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResultDto>,
    pub has_next: bool,
}

#[tauri::command]
pub fn get_settings() -> Settings {
    Settings::load()
}

#[derive(Debug, Deserialize)]
pub struct SettingsPatch {
    pub volume: Option<f64>,
    pub last_library_folder: Option<String>,
    pub daily_download_limit: Option<i64>,
    pub desktop_lyrics_visible: Option<bool>,
    pub desktop_lyrics_locked: Option<bool>,
    pub desktop_lyrics_x: Option<i32>,
    pub desktop_lyrics_y: Option<i32>,
    pub desktop_lyrics_width: Option<u32>,
    pub desktop_lyrics_height: Option<u32>,
    pub desktop_lyrics_scale: Option<f64>,
    pub download_folder: Option<String>,
    pub lyrics_netease_api_base: Option<String>,
    pub lyrics_lrclib_enabled: Option<bool>,
    pub main_window_close_action: Option<String>,
    pub desktop_lyrics_color_base: Option<String>,
    pub desktop_lyrics_color_highlight: Option<String>,
}

/// 由主窗口调用：在原生层对「lyrics」窗设置鼠标穿透（不依赖子 Webview 的 ACL）。
#[cfg(desktop)]
#[tauri::command]
pub fn set_desktop_lyrics_click_through(app: AppHandle, ignore_cursor_events: bool) -> Result<(), String> {
    let Some(w) = app.get_webview_window("lyrics") else {
        return Ok(());
    };
    w.set_ignore_cursor_events(ignore_cursor_events)
        .map_err(|e| e.to_string())
}

#[cfg(not(desktop))]
#[tauri::command]
pub fn set_desktop_lyrics_click_through(_app: AppHandle, _ignore_cursor_events: bool) -> Result<(), String> {
    Ok(())
}

/// 关闭到托盘：隐藏主窗口。
#[cfg(desktop)]
#[tauri::command]
pub fn hide_main_window(app: AppHandle) -> Result<(), String> {
    let Some(w) = app.get_webview_window("main") else {
        return Ok(());
    };
    w.hide().map_err(|e| e.to_string())
}

#[cfg(not(desktop))]
#[tauri::command]
pub fn hide_main_window(_app: AppHandle) -> Result<(), String> {
    Ok(())
}

/// 从托盘恢复主窗口。
#[cfg(desktop)]
#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    let Some(w) = app.get_webview_window("main") else {
        return Ok(());
    };
    w.show().map_err(|e| e.to_string())?;
    w.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(desktop))]
#[tauri::command]
pub fn show_main_window(_app: AppHandle) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// 播放前校验本地路径是否仍为可读文件（避免静默失败）。
#[tauri::command]
pub fn local_path_accessible(path: String) -> bool {
    let p = std::path::Path::new(path.trim());
    p.is_file()
}

#[tauri::command]
pub fn save_settings(patch: SettingsPatch) -> Result<(), String> {
    let mut s = Settings::load();
    if let Some(v) = patch.volume {
        s.volume = v.clamp(0.0, 1.0);
    }
    if let Some(v) = patch.last_library_folder {
        s.last_library_folder = v;
    }
    if let Some(v) = patch.daily_download_limit {
        s.daily_download_limit = v.max(0);
    }
    if let Some(v) = patch.desktop_lyrics_visible {
        s.desktop_lyrics_visible = v;
    }
    if let Some(v) = patch.desktop_lyrics_locked {
        s.desktop_lyrics_locked = v;
    }
    if let Some(v) = patch.desktop_lyrics_x {
        s.desktop_lyrics_x = Some(v);
    }
    if let Some(v) = patch.desktop_lyrics_y {
        s.desktop_lyrics_y = Some(v);
    }
    if let Some(v) = patch.desktop_lyrics_width {
        s.desktop_lyrics_width = Some(v.max(200));
    }
    if let Some(v) = patch.desktop_lyrics_height {
        s.desktop_lyrics_height = Some(v.max(72));
    }
    if let Some(v) = patch.desktop_lyrics_scale {
        s.desktop_lyrics_scale = v.clamp(0.5, 2.5);
    }
    if let Some(v) = patch.download_folder {
        s.download_folder = v;
    }
    if let Some(v) = patch.lyrics_netease_api_base {
        s.lyrics_netease_api_base = v;
    }
    if let Some(v) = patch.lyrics_lrclib_enabled {
        s.lyrics_lrclib_enabled = v;
    }
    if let Some(v) = patch.main_window_close_action {
        let t = v.trim().to_ascii_lowercase();
        if t == "ask" || t == "quit" || t == "tray" {
            s.main_window_close_action = t;
        }
    }
    if let Some(v) = patch.desktop_lyrics_color_base {
        let t = v.trim();
        if t.len() == 7 && t.starts_with('#') && t.chars().skip(1).all(|c| c.is_ascii_hexdigit()) {
            s.desktop_lyrics_color_base = t.to_ascii_lowercase();
        }
    }
    if let Some(v) = patch.desktop_lyrics_color_highlight {
        let t = v.trim();
        if t.len() == 7 && t.starts_with('#') && t.chars().skip(1).all(|c| c.is_ascii_hexdigit()) {
            s.desktop_lyrics_color_highlight = t.to_ascii_lowercase();
        }
    }
    s.save()
}

#[tauri::command]
pub fn db_status(state: State<'_, DbState>) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let n_playlists: i64 = conn
        .query_row("SELECT COUNT(*) FROM playlists", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let n_songs: i64 = conn
        .query_row("SELECT COUNT(*) FROM songs", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(format!(
        "library.db OK — playlists: {}, local songs: {}",
        n_playlists, n_songs
    ))
}

#[tauri::command]
pub async fn search_songs(
    state: State<'_, Arc<AppState>>,
    keyword: String,
    page: u32,
) -> Result<SearchResponse, String> {
    let kw = keyword.trim();
    if kw.is_empty() {
        return Err("请输入搜索关键词".to_string());
    }
    state.limiter.acquire_slot().await;
    let p = page.max(1);
    let (results, has_next) = crate::pjmp3::search_pjmp3(&state.client, kw, p).await?;
    Ok(SearchResponse { results, has_next })
}

#[tauri::command]
pub async fn get_preview_url(state: State<'_, Arc<AppState>>, song_id: String) -> Result<String, String> {
    let sid = song_id.trim();
    if sid.is_empty() {
        return Err("无效的歌曲 ID".to_string());
    }
    state.limiter.acquire_slot().await;
    let url = crate::pjmp3::fetch_preview_url(&state.client, sid)
        .await?
        .ok_or_else(|| "未解析到 MP3 试听地址".to_string())?;
    Ok(url)
}

/// 下载试听到本地临时文件并返回路径，供前端 `convertFileSrc` 播放（避免 WebView 无法直连外链）。
#[tauri::command]
pub async fn cache_preview_for_play(state: State<'_, Arc<AppState>>, song_id: String) -> Result<String, String> {
    let sid = song_id.trim();
    if sid.is_empty() {
        return Err("无效的歌曲 ID".to_string());
    }
    state.limiter.acquire_slot().await;
    let path = crate::pjmp3::cache_preview_audio_file(&state.client, sid).await?;
    Ok(path.to_string_lossy().to_string())
}

/// 在线播放解析顺序：**本地曲库 songs → 下载目录同名文件 → 试听磁盘缓存 → 最近播放保存的试听直链 → 拉取试听缓存 → 解析直链**；均失败则 Err。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveOnlinePlayOut {
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    pub via: String,
}

fn local_library_audio_path(conn: &rusqlite::Connection, sid: &str, title: &str, artist: &str) -> Option<PathBuf> {
    if !sid.is_empty() {
        let q: std::result::Result<String, rusqlite::Error> = conn.query_row(
            "SELECT file_path FROM songs WHERE TRIM(IFNULL(source_id,'')) = TRIM(?1) LIMIT 1",
            [sid],
            |r| r.get(0),
        );
        if let Ok(fp) = q {
            let p = PathBuf::from(fp);
            if p.is_file() {
                return Some(p);
            }
        }
    }
    if title.is_empty() {
        return None;
    }
    let q: std::result::Result<String, rusqlite::Error> = conn.query_row(
        "SELECT file_path FROM songs WHERE title = ?1 COLLATE NOCASE AND artist = ?2 COLLATE NOCASE LIMIT 1",
        rusqlite::params![title, artist],
        |r| r.get(0),
    );
    if let Ok(fp) = q {
        let p = PathBuf::from(fp);
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

fn recent_play_stored_preview_url(conn: &rusqlite::Connection, sid: &str) -> Option<String> {
    if sid.is_empty() {
        return None;
    }
    conn.query_row(
        "SELECT play_url FROM recent_plays WHERE kind='online' AND TRIM(IFNULL(pjmp3_source_id,'')) = TRIM(?1)
         AND TRIM(IFNULL(play_url,'')) != '' ORDER BY played_at DESC LIMIT 1",
        [sid],
        |r| r.get::<_, String>(0),
    )
    .optional()
    .ok()
    .flatten()
    .filter(|s| !s.trim().is_empty())
}

#[tauri::command]
pub async fn resolve_online_play(
    state: State<'_, Arc<AppState>>,
    db: State<'_, DbState>,
    song_id: String,
    title: String,
    artist: String,
) -> Result<ResolveOnlinePlayOut, String> {
    let sid = song_id.trim();
    if sid.is_empty() {
        return Err("无效的歌曲 ID".to_string());
    }
    let tit = title.trim();
    let art = artist.trim();

    // 1) 本地音乐（扫描进库的 songs）
    let local_from_library: Option<PathBuf> = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        local_library_audio_path(&conn, sid, tit, art)
    };
    if let Some(p) = local_from_library {
        if tokio::fs::metadata(&p)
            .await
            .map(|m| m.is_file() && m.len() > 0)
            .unwrap_or(false)
        {
            return Ok(ResolveOnlinePlayOut {
                kind: "file".to_string(),
                path: Some(p.to_string_lossy().to_string()),
                url: None,
                via: "local_library".to_string(),
            });
        }
    }

    // 1b) 下载目录同名文件（本地，未入库也能播）
    for p in crate::download::candidate_downloaded_audio_paths(tit, art) {
        if tokio::fs::metadata(&p)
            .await
            .map(|m| m.is_file() && m.len() > 0)
            .unwrap_or(false)
        {
            return Ok(ResolveOnlinePlayOut {
                kind: "file".to_string(),
                path: Some(p.to_string_lossy().to_string()),
                url: None,
                via: "download".to_string(),
            });
        }
    }

    // 2) 试听磁盘缓存
    if let Some(p) = crate::pjmp3::preview_cache_path_if_exists(sid) {
        return Ok(ResolveOnlinePlayOut {
            kind: "file".to_string(),
            path: Some(p.to_string_lossy().to_string()),
            url: None,
            via: "preview_cache".to_string(),
        });
    }

    // 3) 播放记录中上次成功使用的试听直链（可能已过期，由播放器侧失败）
    let stored_recent_url: Option<String> = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        recent_play_stored_preview_url(&conn, sid)
    };
    if let Some(u) = stored_recent_url {
        return Ok(ResolveOnlinePlayOut {
            kind: "url".to_string(),
            path: None,
            url: Some(u),
            via: "recent_play_url".to_string(),
        });
    }

    state.limiter.acquire_slot().await;
    let err_preview = match crate::pjmp3::cache_preview_audio_file(&state.client, sid).await {
        Ok(p) => {
            return Ok(ResolveOnlinePlayOut {
                kind: "file".to_string(),
                path: Some(p.to_string_lossy().to_string()),
                url: None,
                via: "fetched_preview".to_string(),
            });
        }
        Err(e) => e,
    };

    state.limiter.acquire_slot().await;
    match crate::pjmp3::fetch_preview_url(&state.client, sid).await {
        Ok(Some(url)) => {
            let u = url.trim();
            if !u.is_empty() {
                return Ok(ResolveOnlinePlayOut {
                    kind: "url".to_string(),
                    path: None,
                    url: Some(u.to_string()),
                    via: "direct_url".to_string(),
                });
            }
            Err(format!(
                "{err_preview}；直链降级：未解析到 MP3 地址"
            ))
        }
        Ok(None) => Err(format!(
            "{err_preview}；直链降级：未解析到 MP3 地址"
        )),
        Err(e) => Err(format!("{err_preview}；直链降级失败：{e}")),
    }
}

#[derive(Debug, Deserialize)]
pub struct ImportItemIn {
    pub title: String,
    pub artist: String,
    #[serde(default)]
    pub album: String,
}

#[derive(Serialize)]
pub struct PlaylistRow {
    pub id: i64,
    pub name: String,
}

#[tauri::command]
pub fn parse_import_text(
    text: String,
    fmt: String,
) -> Result<Vec<crate::import_playlist::ImportedTrackDto>, String> {
    crate::import_playlist::parse_playlist_text(&text, fmt.trim())
}

#[tauri::command]
pub fn list_playlists(state: State<'_, DbState>) -> Result<Vec<PlaylistRow>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name FROM playlists ORDER BY name COLLATE NOCASE")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(PlaylistRow {
                id: r.get(0)?,
                name: r.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// 歌单列表（含导入曲目数量、封面），供移动端「我的歌单」展示。
#[derive(Serialize)]
pub struct PlaylistSummaryRow {
    pub id: i64,
    pub name: String,
    pub track_count: i64,
    /// 首条非空 `cover_url`（按 `sort_order`），与歌单详情页头图一致。
    #[serde(default)]
    pub cover_url: String,
}

#[tauri::command]
pub fn list_playlists_summary(state: State<'_, DbState>) -> Result<Vec<PlaylistSummaryRow>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, COUNT(i.id) AS cnt, \
             COALESCE((SELECT TRIM(COALESCE(i2.cover_url, '')) FROM playlist_import_items i2 \
              WHERE i2.playlist_id = p.id AND LENGTH(TRIM(COALESCE(i2.cover_url, ''))) > 0 \
              ORDER BY i2.sort_order ASC, i2.id ASC LIMIT 1), '') AS cover_url \
             FROM playlists p \
             LEFT JOIN playlist_import_items i ON i.playlist_id = p.id \
             GROUP BY p.id \
             ORDER BY p.name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(PlaylistSummaryRow {
                id: r.get(0)?,
                name: r.get(1)?,
                track_count: r.get(2)?,
                cover_url: r.get::<_, Option<String>>(3)?.unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// 某歌单下的导入曲目行（供「歌单」页展示）。
#[derive(Serialize)]
pub struct PlaylistImportItemRow {
    pub id: i64,
    pub sort_order: i64,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub pjmp3_source_id: String,
    pub cover_url: String,
    pub duration_ms: i64,
}

#[tauri::command]
pub fn list_playlist_import_items(
    state: State<'_, DbState>,
    playlist_id: i64,
) -> Result<Vec<PlaylistImportItemRow>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            r#"SELECT id, sort_order, title, artist, album, pjmp3_source_id, cover_url, duration_ms
               FROM playlist_import_items WHERE playlist_id=?1 ORDER BY sort_order ASC, id ASC"#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([playlist_id], |r| {
            Ok(PlaylistImportItemRow {
                id: r.get(0)?,
                sort_order: r.get(1)?,
                title: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                artist: r.get::<_, Option<String>>(3)?.unwrap_or_default(),
                album: r.get::<_, Option<String>>(4)?.unwrap_or_default(),
                pjmp3_source_id: r.get::<_, Option<String>>(5)?.unwrap_or_default(),
                cover_url: r.get::<_, Option<String>>(6)?.unwrap_or_default(),
                duration_ms: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn create_playlist(state: State<'_, DbState>, name: String) -> Result<i64, String> {
    let n = name.trim();
    if n.is_empty() {
        return Err("歌单名称不能为空".to_string());
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO playlists (name) VALUES (?1)", [n])
        .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn rename_playlist(state: State<'_, DbState>, playlist_id: i64, name: String) -> Result<(), String> {
    let n = name.trim();
    if n.is_empty() {
        return Err("歌单名称不能为空".to_string());
    }
    if playlist_id <= 0 {
        return Err("无效的歌单 id".to_string());
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let nchg = conn
        .execute("UPDATE playlists SET name=?1 WHERE id=?2", rusqlite::params![n, playlist_id])
        .map_err(|e| e.to_string())?;
    if nchg == 0 {
        return Err("歌单不存在".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn delete_playlist(state: State<'_, DbState>, playlist_id: i64) -> Result<(), String> {
    if playlist_id <= 0 {
        return Err("无效的歌单 id".to_string());
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let nchg = conn
        .execute("DELETE FROM playlists WHERE id=?1", [playlist_id])
        .map_err(|e| e.to_string())?;
    if nchg == 0 {
        return Err("歌单不存在".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn delete_playlist_import_item(
    state: State<'_, DbState>,
    playlist_id: i64,
    item_id: i64,
) -> Result<(), String> {
    if playlist_id <= 0 || item_id <= 0 {
        return Err("无效的 id".to_string());
    }
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let nchg = conn
        .execute(
            "DELETE FROM playlist_import_items WHERE id=?1 AND playlist_id=?2",
            rusqlite::params![item_id, playlist_id],
        )
        .map_err(|e| e.to_string())?;
    if nchg == 0 {
        return Err("未找到该导入条目".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn replace_playlist_import_items(
    app: AppHandle,
    state: State<'_, DbState>,
    playlist_id: i64,
    items: Vec<ImportItemIn>,
) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM playlist_import_items WHERE playlist_id=?1",
        [playlist_id],
    )
    .map_err(|e| e.to_string())?;
    for (i, t) in items.iter().enumerate() {
        tx.execute(
            r#"INSERT INTO playlist_import_items (
                playlist_id, sort_order, title, artist, album, play_url, pjmp3_source_id,
                cover_url, cover_cache_path, duration_ms, audio_cache_path
            ) VALUES (?1, ?2, ?3, ?4, ?5, '', '', '', '', 0, '')"#,
            rusqlite::params![
                playlist_id,
                i as i64,
                t.title.trim(),
                t.artist.trim(),
                t.album.trim(),
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    import_enrich::spawn_playlist_enrich(app, playlist_id);
    Ok(())
}

#[tauri::command]
pub fn append_playlist_import_items(
    app: AppHandle,
    state: State<'_, DbState>,
    playlist_id: i64,
    items: Vec<ImportItemIn>,
) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    let pos0: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM playlist_import_items WHERE playlist_id=?1",
            [playlist_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let mut pos = pos0;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for t in &items {
        tx.execute(
            r#"INSERT INTO playlist_import_items (
                playlist_id, sort_order, title, artist, album, play_url, pjmp3_source_id,
                cover_url, cover_cache_path, duration_ms, audio_cache_path
            ) VALUES (?1, ?2, ?3, ?4, ?5, '', '', '', '', 0, '')"#,
            rusqlite::params![
                playlist_id,
                pos,
                t.title.trim(),
                t.artist.trim(),
                t.album.trim(),
            ],
        )
        .map_err(|e| e.to_string())?;
        pos += 1;
    }
    tx.commit().map_err(|e| e.to_string())?;
    import_enrich::spawn_playlist_enrich(app, playlist_id);
    Ok(())
}

/// 手动触发某歌单导入条目的后台富化（与保存后自动任务相同）。
#[tauri::command]
pub fn start_import_enrich(app: AppHandle, playlist_id: i64) -> Result<(), String> {
    if playlist_id <= 0 {
        return Err("无效的歌单 id".to_string());
    }
    import_enrich::spawn_playlist_enrich(app, playlist_id);
    Ok(())
}

#[tauri::command]
pub async fn fetch_song_lrc(
    state: State<'_, Arc<AppState>>,
    song_id: String,
) -> Result<Option<String>, String> {
    let sid = song_id.trim();
    if sid.is_empty() {
        return Err("无效的歌曲 ID".to_string());
    }
    eprintln!("[lyrics] command fetch_song_lrc song_id={sid}");
    state.limiter.acquire_slot().await;
    let raw = crate::pjmp3::fetch_song_lrc_text(&state.client, sid).await?;
    Ok(raw.map(crate::lyrics::pack_lyrics_for_ui))
}

/// 多源歌词：固定顺序 QQ → 酷狗 → 网易云 → LRCLIB（与歌词替换「换」同源）；自托管网易 API 时在拉取候选后仍走 `/lyric/new` 优先。
#[tauri::command]
pub async fn fetch_song_lrc_enriched(
    state: State<'_, Arc<AppState>>,
    req: crate::lyrics::LyricsFetchIn,
) -> Result<Option<crate::lyrics::LyricsPayload>, String> {
    let settings = Settings::load();
    state.limiter.acquire_slot().await;
    crate::lyric_replace::fetch_song_lddc_enriched(&state.client, &settings, &req).await
}

/// 封面补全：`GET https://api.lrc.cx/cover`（跟随重定向至图片 URL）。
#[tauri::command]
pub async fn fetch_lrc_cx_cover(
    state: State<'_, Arc<AppState>>,
    title: String,
    artist: String,
    album: Option<String>,
) -> Result<Option<String>, String> {
    state.limiter.acquire_slot().await;
    let alb = album.unwrap_or_default();
    crate::lyrics::fetch_lrc_cx_cover(&state.client, &title, &artist, &alb).await
}

/// 歌词替换：多源搜索候选（QQ / 酷狗 / 网易 / LRCLIB）。
#[tauri::command]
pub async fn lyrics_search_candidates(
    state: State<'_, Arc<AppState>>,
    keyword: String,
    duration_ms: Option<i64>,
    sources: Option<Vec<String>>,
) -> Result<Vec<crate::lyric_replace::LyricCandidate>, String> {
    let settings = Settings::load();
    state.limiter.acquire_slot().await;
    crate::lyric_replace::lyrics_search_candidates(
        &state.client,
        &settings,
        keyword,
        duration_ms,
        sources,
    )
    .await
}

/// 歌词替换：拉取选中候选的完整 [`LyricsPayload`]。
#[tauri::command]
pub async fn lyrics_fetch_candidate(
    state: State<'_, Arc<AppState>>,
    candidate: crate::lyric_replace::LyricCandidate,
) -> Result<crate::lyrics::LyricsPayload, String> {
    let settings = Settings::load();
    state.limiter.acquire_slot().await;
    crate::lyric_replace::lyrics_fetch_candidate(&state.client, &settings, candidate).await
}

#[derive(Serialize)]
pub struct SharePlaylistResponse {
    pub playlist_name: String,
    pub tracks: Vec<crate::import_playlist::ImportedTrackDto>,
}

/// 网易云 / QQ 音乐分享链接 → 歌单名 + 曲目（与 Py `share_link_importer.fetch_playlist_from_share_url` 一致）。
#[tauri::command]
pub async fn fetch_share_playlist(
    state: State<'_, Arc<AppState>>,
    url: String,
) -> Result<SharePlaylistResponse, String> {
    let u = url.trim();
    if u.is_empty() {
        return Err("请先粘贴分享链接。".to_string());
    }
    state.limiter.acquire_slot().await;
    let (playlist_name, tracks) = crate::share_link::fetch_playlist_from_share_url(&state.client, u).await?;
    Ok(SharePlaylistResponse {
        playlist_name,
        tracks,
    })
}

/// 本地库表中的一行（与 `songs` 表对应）。
#[derive(Serialize)]
pub struct LocalSongRow {
    pub id: i64,
    pub title: String,
    pub artist: String,
    pub file_path: String,
}

#[tauri::command]
pub fn list_local_songs(state: State<'_, DbState>) -> Result<Vec<LocalSongRow>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, artist, file_path FROM songs ORDER BY title COLLATE NOCASE, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(LocalSongRow {
                id: r.get(0)?,
                title: r.get::<_, Option<String>>(1)?.unwrap_or_default(),
                artist: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                file_path: r.get::<_, Option<String>>(3)?.unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// 「下载歌曲」Tab：库中已记录的本地下载文件（含重启后持久化）。
#[tauri::command]
pub fn list_downloaded_songs(state: State<'_, DbState>) -> Result<Vec<crate::db::DownloadedSongRow>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    crate::db::list_downloaded_tracks(&conn).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct ScanMusicFolderResult {
    /// 遍历到的音频文件数（去重前按扩展名计数）
    pub audio_files_seen: usize,
    /// INSERT/UPDATE 实际写入库的行数
    pub rows_written: usize,
}

fn is_audio_extension(ext: &str) -> bool {
    matches!(
        ext.to_ascii_lowercase().as_str(),
        "mp3" | "flac" | "m4a" | "wav" | "ogg" | "aac" | "opus" | "wma"
    )
}

/// 递归扫描文件夹，将音频文件写入 `songs` 表（路径唯一，冲突则更新标题）。
#[tauri::command]
pub fn scan_music_folder(state: State<'_, DbState>, path: String) -> Result<ScanMusicFolderResult, String> {
    let root = PathBuf::from(path.trim());
    if !root.is_dir() {
        return Err("不是有效的文件夹路径".to_string());
    }
    let mut audio_files_seen = 0usize;
    let mut rows_written = 0usize;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    for entry in WalkDir::new(&root).follow_links(false).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        let p = entry.path();
        let ext = p.extension().and_then(|x| x.to_str()).unwrap_or("");
        if !is_audio_extension(ext) {
            continue;
        }
        audio_files_seen += 1;
        let fp = p.to_string_lossy().to_string();
        let stem = p
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let title = if stem.is_empty() { fp.clone() } else { stem };
        let n = conn
            .execute(
                r#"INSERT INTO songs (title, artist, album, file_path)
                   VALUES (?1, '', '', ?2)
                   ON CONFLICT(file_path) DO UPDATE SET title = excluded.title"#,
                rusqlite::params![title, fp],
            )
            .map_err(|e| e.to_string())?;
        rows_written += n as usize;
    }
    Ok(ScanMusicFolderResult {
        audio_files_seen,
        rows_written,
    })
}

const RECENT_PLAYS_MAX: i64 = 100;

#[derive(Debug, Deserialize)]
pub struct RecentPlayIn {
    pub kind: String,
    pub title: String,
    pub artist: String,
    pub cover_url: Option<String>,
    pub pjmp3_source_id: Option<String>,
    pub file_path: Option<String>,
    /// 在线曲目上次成功播放使用的直链（用于解析降级前优先重试）
    #[serde(default)]
    pub play_url: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentPlayRow {
    pub kind: String,
    pub title: String,
    pub artist: String,
    pub cover_url: Option<String>,
    pub pjmp3_source_id: Option<String>,
    pub file_path: Option<String>,
    pub play_url: Option<String>,
    pub played_at: i64,
}

#[tauri::command]
pub fn list_recent_plays(state: State<'_, DbState>) -> Result<Vec<RecentPlayRow>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT kind, title, artist, cover_url, pjmp3_source_id, file_path,
                    IFNULL(play_url, ''), played_at
             FROM recent_plays ORDER BY played_at DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([RECENT_PLAYS_MAX], |r| {
            let pu: String = r.get(6)?;
            Ok(RecentPlayRow {
                kind: r.get::<_, Option<String>>(0)?.unwrap_or_default(),
                title: r.get::<_, Option<String>>(1)?.unwrap_or_default(),
                artist: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                cover_url: r.get(3)?,
                pjmp3_source_id: r.get(4)?,
                file_path: r.get(5)?,
                play_url: if pu.trim().is_empty() {
                    None
                } else {
                    Some(pu)
                },
                played_at: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn record_recent_play(state: State<'_, DbState>, row: RecentPlayIn) -> Result<(), String> {
    let k = row.kind.trim();
    if k != "online" && k != "local" {
        return Err("kind 须为 online 或 local".to_string());
    }
    if k == "online" {
        let sid = row.pjmp3_source_id.as_ref().map(|s| s.trim()).unwrap_or("");
        if sid.is_empty() {
            return Err("online 须含 pjmp3_source_id".to_string());
        }
    } else {
        let fp = row.file_path.as_ref().map(|s| s.trim()).unwrap_or("");
        if fp.is_empty() {
            return Err("local 须含 file_path".to_string());
        }
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64;

    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    if k == "online" {
        let sid = row.pjmp3_source_id.as_ref().map(|s| s.trim()).unwrap_or("");
        tx.execute(
            "DELETE FROM recent_plays WHERE kind='online' AND pjmp3_source_id=?1",
            [sid],
        )
        .map_err(|e| e.to_string())?;
    } else {
        let fp = row.file_path.as_ref().map(|s| s.trim()).unwrap_or("");
        tx.execute("DELETE FROM recent_plays WHERE kind='local' AND file_path=?1", [fp])
            .map_err(|e| e.to_string())?;
    }
    let (pid, fpath): (Option<String>, Option<String>) = if k == "online" {
        (row.pjmp3_source_id, None)
    } else {
        (None, row.file_path)
    };
    let play_url = row
        .play_url
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_default();
    tx.execute(
        "INSERT INTO recent_plays (kind, title, artist, cover_url, pjmp3_source_id, file_path, play_url, played_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![k, row.title, row.artist, row.cover_url, pid, fpath, play_url, now],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        &format!(
            "DELETE FROM recent_plays WHERE id NOT IN (SELECT id FROM recent_plays ORDER BY played_at DESC LIMIT {RECENT_PLAYS_MAX})"
        ),
        [],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct DownloadEnqueueIn {
    pub source_id: String,
    pub title: String,
    pub artist: String,
    pub quality: String,
}

#[tauri::command]
pub async fn enqueue_download(state: State<'_, Arc<AppState>>, job: DownloadEnqueueIn) -> Result<(), String> {
    let q = job.quality.trim().to_ascii_lowercase();
    let quality = match q.as_str() {
        "flac" => "flac",
        "320" | "hq" => "320",
        _ => "128",
    };
    let j = crate::download::DownloadJob {
        source_id: job.source_id.trim().to_string(),
        title: job.title,
        artist: job.artist,
        quality: quality.to_string(),
    };
    state
        .download_tx
        .send(j)
        .await
        .map_err(|e| format!("下载队列异常: {e}"))
}
