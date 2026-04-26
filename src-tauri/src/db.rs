//! 与 Python `core/database.py` 中 `library.db` 初始化对齐（同一路径：`~/.cloudplayer/library.db`）。

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::config::config_dir;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

pub fn db_path() -> PathBuf {
    config_dir().join("library.db")
}

pub fn open_and_init() -> Result<Connection, rusqlite::Error> {
    let path = db_path();
    let conn = Connection::open(&path)?;
    conn.execute_batch(
        r#"
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;

        CREATE TABLE IF NOT EXISTS songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL DEFAULT '',
            artist TEXT NOT NULL DEFAULT '',
            album TEXT NOT NULL DEFAULT '',
            file_path TEXT NOT NULL UNIQUE,
            cover TEXT,
            source_id TEXT,
            quality TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_songs_source ON songs(source_id);
        CREATE INDEX IF NOT EXISTS idx_songs_title_artist ON songs(title, artist);

        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS playlist_songs (
            playlist_id INTEGER NOT NULL,
            song_id INTEGER NOT NULL,
            position INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (playlist_id, song_id),
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_ps_playlist ON playlist_songs(playlist_id);

        CREATE TABLE IF NOT EXISTS playlist_import_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            title TEXT NOT NULL DEFAULT '',
            artist TEXT NOT NULL DEFAULT '',
            album TEXT NOT NULL DEFAULT '',
            play_url TEXT NOT NULL DEFAULT '',
            pjmp3_source_id TEXT NOT NULL DEFAULT '',
            cover_url TEXT NOT NULL DEFAULT '',
            cover_cache_path TEXT NOT NULL DEFAULT '',
            duration_ms INTEGER NOT NULL DEFAULT 0,
            audio_cache_path TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_pii_playlist ON playlist_import_items(playlist_id);

        CREATE TABLE IF NOT EXISTS liked_tracks (
            key TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            artist TEXT NOT NULL DEFAULT '',
            album TEXT NOT NULL DEFAULT '',
            pjmp3_source_id TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS recent_plays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            artist TEXT NOT NULL DEFAULT '',
            cover_url TEXT,
            pjmp3_source_id TEXT,
            file_path TEXT,
            play_url TEXT NOT NULL DEFAULT '',
            played_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_recent_played_at ON recent_plays(played_at DESC);

        CREATE TABLE IF NOT EXISTS downloaded_tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL DEFAULT '',
            artist TEXT NOT NULL DEFAULT '',
            album TEXT NOT NULL DEFAULT '',
            duration_ms INTEGER NOT NULL DEFAULT 0,
            file_size INTEGER NOT NULL DEFAULT 0,
            pjmp3_source_id TEXT NOT NULL DEFAULT '',
            quality TEXT NOT NULL DEFAULT '',
            completed_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_downloaded_completed ON downloaded_tracks(completed_at DESC);
        CREATE INDEX IF NOT EXISTS idx_downloaded_source ON downloaded_tracks(pjmp3_source_id);
        "#,
    )?;

    // 与 Python `_migrate_schema` 一致：忽略已存在列的错误
    for stmt in [
        "ALTER TABLE playlist_import_items ADD COLUMN album TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE playlist_import_items ADD COLUMN play_url TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE playlist_import_items ADD COLUMN pjmp3_source_id TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE playlist_import_items ADD COLUMN cover_url TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE playlist_import_items ADD COLUMN cover_cache_path TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE playlist_import_items ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE playlist_import_items ADD COLUMN audio_cache_path TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE recent_plays ADD COLUMN play_url TEXT NOT NULL DEFAULT ''",
    ] {
        let _ = conn.execute(stmt, []);
    }

    Ok(conn)
}

/// 写入「下载歌曲」列表（同一路径再次下载则更新元数据）。
pub fn insert_downloaded_track(
    conn: &Connection,
    file_path: &str,
    title: &str,
    artist: &str,
    album: &str,
    duration_ms: i64,
    file_size: i64,
    pjmp3_source_id: &str,
    quality: &str,
    completed_at_ms: i64,
) -> rusqlite::Result<()> {
    conn.execute(
        r#"
        INSERT INTO downloaded_tracks (
            file_path, title, artist, album, duration_ms, file_size,
            pjmp3_source_id, quality, completed_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(file_path) DO UPDATE SET
            title = excluded.title,
            artist = excluded.artist,
            album = excluded.album,
            duration_ms = excluded.duration_ms,
            file_size = excluded.file_size,
            pjmp3_source_id = excluded.pjmp3_source_id,
            quality = excluded.quality,
            completed_at = excluded.completed_at
        "#,
        rusqlite::params![
            file_path,
            title,
            artist,
            album,
            duration_ms,
            file_size,
            pjmp3_source_id,
            quality,
            completed_at_ms,
        ],
    )?;
    Ok(())
}

/// 同一曲库 id 可能有多条（不同音质等），按完成时间从新到旧；路径由调用方校验是否仍存在。
pub fn downloaded_track_paths_by_source_id(
    conn: &Connection,
    source_id: &str,
) -> rusqlite::Result<Vec<String>> {
    let sid = source_id.trim();
    if sid.is_empty() {
        return Ok(Vec::new());
    }
    let mut stmt = conn.prepare(
        r#"SELECT file_path FROM downloaded_tracks
           WHERE TRIM(IFNULL(pjmp3_source_id,'')) = TRIM(?1)
           ORDER BY completed_at DESC"#,
    )?;
    let mut out = Vec::new();
    let mut rows = stmt.query([sid])?;
    while let Some(row) = rows.next()? {
        let fp: String = row.get(0)?;
        let t = fp.trim();
        if !t.is_empty() {
            out.push(t.to_string());
        }
    }
    Ok(out)
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedSongRow {
    pub file_path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: i64,
    pub file_size: i64,
    pub pjmp3_source_id: String,
    pub quality: String,
    pub completed_at: i64,
}

pub fn list_downloaded_tracks(conn: &Connection) -> rusqlite::Result<Vec<DownloadedSongRow>> {
    let mut stmt = conn.prepare(
        r#"SELECT file_path, title, artist, album, duration_ms, file_size,
                  pjmp3_source_id, quality, completed_at
           FROM downloaded_tracks
           ORDER BY completed_at DESC"#,
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(DownloadedSongRow {
            file_path: r.get(0)?,
            title: r.get(1)?,
            artist: r.get(2)?,
            album: r.get(3)?,
            duration_ms: r.get(4)?,
            file_size: r.get(5)?,
            pjmp3_source_id: r.get(6)?,
            quality: r.get(7)?,
            completed_at: r.get(8)?,
        })
    })?;
    rows.collect()
}

/// 按路径删除「下载歌曲」库记录（条数 0 或 1）。
pub fn delete_downloaded_track_by_path(conn: &Connection, file_path: &str) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM downloaded_tracks WHERE file_path = ?1", [file_path])
}

/// 移除磁盘上已不存在的下载记录（用户在资源管理器删除文件后，下次列表刷新会同步）。
pub fn prune_downloaded_tracks_missing_files(conn: &Connection) -> rusqlite::Result<usize> {
    use std::path::Path;
    let paths: Vec<String> = conn
        .prepare("SELECT file_path FROM downloaded_tracks")?
        .query_map([], |r| r.get(0))?
        .collect::<Result<Vec<_>, _>>()?;
    let mut total = 0usize;
    for fp in paths {
        if !Path::new(&fp).is_file() {
            total += delete_downloaded_track_by_path(conn, &fp)?;
        }
    }
    Ok(total)
}
