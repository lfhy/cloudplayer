//! 与 Python `config/settings.py` 对齐：`~/.cloudplayer/settings.json`

/// 与 `cloudplayer/config/settings.py` 中 `BASE_URL` 一致。
pub const BASE_URL: &str = "https://pjmp3.com";

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

pub fn config_dir() -> PathBuf {
    let base = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".cloudplayer");
    let _ = fs::create_dir_all(&base);
    base
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "snake_case")]
pub struct Settings {
    pub window_geometry_b64: Option<String>,
    pub window_state_b64: Option<String>,
    #[serde(default = "default_volume")]
    pub volume: f64,
    #[serde(default)]
    pub last_library_folder: String,
    #[serde(default = "default_daily")]
    pub daily_download_limit: i64,
    #[serde(default)]
    pub desktop_lyrics_visible: bool,
    #[serde(default = "default_lyrics_locked")]
    pub desktop_lyrics_locked: bool,
    /// 上次桌面歌词窗口位置（逻辑像素），未保存过则为 None
    #[serde(default)]
    pub desktop_lyrics_x: Option<i32>,
    #[serde(default)]
    pub desktop_lyrics_y: Option<i32>,
    #[serde(default)]
    pub desktop_lyrics_width: Option<u32>,
    #[serde(default)]
    pub desktop_lyrics_height: Option<u32>,
    /// 相对基准字号（约 20pt）的缩放，默认 1.0
    #[serde(default = "default_desktop_lyrics_scale")]
    pub desktop_lyrics_scale: f64,
    /// 下载保存根目录（绝对路径），空则使用默认 ~/Music/CloudPlayer
    #[serde(default)]
    pub download_folder: String,
    /// 与 `downloads_today_count` 对应的日历日 YYYY-MM-DD；变化时重置计数
    #[serde(default)]
    pub downloads_today_date: String,
    #[serde(default)]
    pub downloads_today_count: i64,
    /// 非官方网易云 API 根 URL（如自托管 NeteaseCloudMusicApi），空则不启用
    #[serde(default)]
    pub lyrics_netease_api_base: String,
    #[serde(default = "default_lyrics_lrclib")]
    pub lyrics_lrclib_enabled: bool,
    /// 逗号分隔：pjmp3, netease, lrclib
    #[serde(default = "default_lyrics_order")]
    pub lyrics_provider_order: String,
    /// 主窗口关闭：`ask` 每次询问，`quit` 退出，`tray` 最小化到托盘
    #[serde(default = "default_main_window_close_action")]
    pub main_window_close_action: String,
    /// 桌面歌词未唱字色（#RRGGBB）
    #[serde(default = "default_desktop_lyrics_color_base")]
    pub desktop_lyrics_color_base: String,
    /// 桌面歌词已唱字色（#RRGGBB）
    #[serde(default = "default_desktop_lyrics_color_highlight")]
    pub desktop_lyrics_color_highlight: String,
}

fn default_volume() -> f64 {
    0.7
}

fn default_daily() -> i64 {
    50
}

fn default_lyrics_locked() -> bool {
    true
}

fn default_desktop_lyrics_scale() -> f64 {
    1.0
}

fn default_lyrics_lrclib() -> bool {
    true
}

fn default_lyrics_order() -> String {
    "pjmp3,netease,lrclib".to_string()
}

fn default_main_window_close_action() -> String {
    "ask".to_string()
}

fn default_desktop_lyrics_color_base() -> String {
    "#ffffff".to_string()
}

fn default_desktop_lyrics_color_highlight() -> String {
    "#ffb7d4".to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            window_geometry_b64: None,
            window_state_b64: None,
            volume: default_volume(),
            last_library_folder: String::new(),
            daily_download_limit: default_daily(),
            desktop_lyrics_visible: false,
            desktop_lyrics_locked: default_lyrics_locked(),
            desktop_lyrics_x: None,
            desktop_lyrics_y: None,
            desktop_lyrics_width: None,
            desktop_lyrics_height: None,
            desktop_lyrics_scale: default_desktop_lyrics_scale(),
            download_folder: String::new(),
            downloads_today_date: String::new(),
            downloads_today_count: 0,
            lyrics_netease_api_base: String::new(),
            lyrics_lrclib_enabled: default_lyrics_lrclib(),
            lyrics_provider_order: default_lyrics_order(),
            main_window_close_action: default_main_window_close_action(),
            desktop_lyrics_color_base: default_desktop_lyrics_color_base(),
            desktop_lyrics_color_highlight: default_desktop_lyrics_color_highlight(),
        }
    }
}

pub fn default_download_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Music")
        .join("CloudPlayer")
}

impl Settings {
    fn path() -> PathBuf {
        config_dir().join("settings.json")
    }

    pub fn load() -> Self {
        let p = Self::path();
        if !p.is_file() {
            return Self::default();
        }
        match fs::read_to_string(&p) {
            Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
            Err(_) => Self::default(),
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let p = Self::path();
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(p, json).map_err(|e| e.to_string())
    }
}
