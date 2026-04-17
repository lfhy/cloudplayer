pub mod captcha_slider;
mod commands;
mod config;
mod logging;
mod db;
mod download;
mod download_meta;
mod import_enrich;
mod import_playlist;
mod lrc_format;
mod lrc_embedded;
mod lddc_parse;
mod lyrics;
mod qrc_des;
mod lyric_qq;
mod lyric_kugou;
mod lyric_replace;
mod pjmp3;
mod rate_limiter;
mod share_link;

#[cfg(target_os = "android")]
use crate::config::init_android_storage;

#[cfg(desktop)]
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

#[cfg(desktop)]
use tauri::Emitter;
use tauri::Manager;
#[cfg(desktop)]
use tauri::WindowEvent;

#[cfg(desktop)]
use tauri::menu::{MenuBuilder, MenuItem};
#[cfg(desktop)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logging::install_panic_hook();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .on_window_event(|window, _event| {
            if window.label() != "main" {
                return;
            }
            #[cfg(desktop)]
            if let WindowEvent::CloseRequested { api, .. } = _event {
                api.prevent_close();
                let _ = window.emit("main-close-requested", ());
            }
        })
        .setup(|app| {
            #[cfg(target_os = "android")]
            {
                init_android_storage(app)?;
            }
            if let Err(e) = logging::init_from_app(app.handle()) {
                eprintln!("CloudPlayer: file logging init failed: {e}");
            }
            let conn = db::open_and_init().map_err(|e| format!("数据库初始化失败: {e}"))?;
            app.manage(db::DbState {
                conn: std::sync::Mutex::new(conn),
            });

            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(45))
                .connect_timeout(Duration::from_secs(15))
                .redirect(reqwest::redirect::Policy::limited(10))
                // 部分站点在 HTTP/2 下偶发连接异常；与浏览器常见 HTTP/1.1 行为更一致。
                .http1_only()
                .user_agent(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                )
                .build()
                .map_err(|e| format!("HTTP 客户端初始化失败: {e}"))?;

            let (download_tx, mut download_rx) =
                tokio::sync::mpsc::channel::<download::DownloadJob>(64);
            let client_dl = client.clone();
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                while let Some(job) = download_rx.recv().await {
                    download::run_one_job(client_dl.clone(), app_handle.clone(), job).await;
                }
            });

            app.manage(Arc::new(commands::AppState {
                client,
                limiter: Arc::new(rate_limiter::RateLimiter::new(45)),
                download_tx,
            }));

            #[cfg(desktop)]
            {
                // 系统托盘：恢复 / 退出；左键单击显示主窗口（仅桌面）
                let tray_icon = app.default_window_icon().cloned().unwrap_or_else(|| {
                    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("icons/32x32.png");
                    tauri::image::Image::from_path(p).expect("load tray icon from icons/32x32.png")
                });
                let tray_menu = MenuBuilder::new(app)
                    .item(&MenuItem::with_id(
                        app,
                        "tray_show",
                        "显示主窗口",
                        true,
                        None::<&str>,
                    )?)
                    .item(&MenuItem::with_id(app, "tray_quit", "退出", true, None::<&str>)?)
                    .build()?;
                let _tray = TrayIconBuilder::new()
                    .icon(tray_icon)
                    .menu(&tray_menu)
                    .tooltip("CloudPlayer")
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| {
                        if event.id == "tray_show" {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        } else if event.id == "tray_quit" {
                            app.exit(0);
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button,
                            button_state,
                            ..
                        } = event
                        {
                            if button == MouseButton::Left && button_state == MouseButtonState::Up {
                                let app = tray.app_handle();
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::set_desktop_lyrics_click_through,
            commands::hide_main_window,
            commands::show_main_window,
            commands::quit_app,
            commands::local_path_accessible,
            commands::save_settings,
            commands::db_status,
            commands::search_songs,
            commands::get_preview_url,
            commands::cache_preview_for_play,
            commands::resolve_online_play,
            commands::parse_import_text,
            commands::list_playlists,
            commands::list_playlists_summary,
            commands::list_playlist_import_items,
            commands::create_playlist,
            commands::rename_playlist,
            commands::delete_playlist,
            commands::delete_playlist_import_item,
            commands::replace_playlist_import_items,
            commands::append_playlist_import_items,
            commands::start_import_enrich,
            commands::fetch_song_lrc,
            commands::fetch_song_lrc_enriched,
            commands::fetch_lrc_cx_cover,
            commands::lyrics_search_candidates,
            commands::lyrics_fetch_candidate,
            commands::fetch_share_playlist,
            commands::list_local_songs,
            commands::list_downloaded_songs,
            commands::scan_music_folder,
            commands::list_recent_plays,
            commands::record_recent_play,
            commands::enqueue_download,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CloudPlayer (Tauri)");
}
