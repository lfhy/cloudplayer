//! 日志：同时写入应用日志文件（release 排障）与 stderr（开发时终端可见）。
use std::fs::OpenOptions;
use std::sync::OnceLock;

use log::LevelFilter;
use simplelog::{Config, WriteLogger};
use tauri::Manager;

#[cfg(not(target_os = "android"))]
use simplelog::{ColorChoice, CombinedLogger, TermLogger, TerminalMode};

static LOG_DIR: OnceLock<std::path::PathBuf> = OnceLock::new();

/// 须在 `setup` 内尽早调用；失败时仅 `eprintln`，不阻断启动。
pub fn init_from_app(handle: &tauri::AppHandle) -> Result<(), String> {
    let log_dir = handle.path().app_log_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
    let _ = LOG_DIR.set(log_dir.clone());

    let log_path = log_dir.join("cloudplayer.log");
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| e.to_string())?;

    #[cfg(not(target_os = "android"))]
    {
        let term_logger = TermLogger::new(
            LevelFilter::Info,
            Config::default(),
            TerminalMode::Stderr,
            ColorChoice::Auto,
        );
        let file_logger = WriteLogger::new(LevelFilter::Info, Config::default(), file);
        CombinedLogger::init(vec![term_logger, file_logger]).map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "android")]
    {
        WriteLogger::init(LevelFilter::Info, Config::default(), file).map_err(|e| e.to_string())?;
    }

    log::info!(
        "CloudPlayer {} logging to {}",
        env!("CARGO_PKG_VERSION"),
        log_path.display()
    );
    Ok(())
}

/// 在 `run()` 开头调用（早于 `setup`），保证初始化前 panic 也有文件痕迹。
pub fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let mut text = format!("{info}\n");
        if let Some(loc) = info.location() {
            text.push_str(&format!("  at {}:{}:{}\n", loc.file(), loc.line(), loc.column()));
        }
        if let Some(s) = info.payload().downcast_ref::<&str>() {
            text.push_str(&format!("  payload: {s}\n"));
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            text.push_str(&format!("  payload: {s}\n"));
        }

        eprintln!("CloudPlayer panic:\n{text}");

        let path = LOG_DIR
            .get()
            .map(|d| d.join("last_panic.txt"))
            .unwrap_or_else(|| std::env::temp_dir().join("cloudplayer_last_panic.txt"));
        if let Err(e) = std::fs::write(&path, &text) {
            eprintln!("CloudPlayer: could not write panic file {path:?}: {e}");
        } else {
            eprintln!("CloudPlayer: panic details written to {}", path.display());
        }
    }));
}
