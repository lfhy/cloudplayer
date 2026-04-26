//! 桌面全局快捷键：注册、映射到动作名并发 `global-hotkey` 事件。

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

use crate::config::GlobalHotkeys;

/// 每一项注册结果（(ok=false 表示语法错误或系统占用等冲突）。
#[derive(Debug, Clone, Serialize)]
pub struct HotkeyEntryStatus {
    pub ok: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HotkeyApplyReport {
    pub play_pause: HotkeyEntryStatus,
    pub prev: HotkeyEntryStatus,
    pub next: HotkeyEntryStatus,
    pub volume_up: HotkeyEntryStatus,
    pub volume_down: HotkeyEntryStatus,
}

impl HotkeyApplyReport {
    pub fn all_ok() -> Self {
        let ok = HotkeyEntryStatus {
            ok: true,
            error: None,
        };
        Self {
            play_pause: ok.clone(),
            prev: ok.clone(),
            next: ok.clone(),
            volume_up: ok.clone(),
            volume_down: ok,
        }
    }
}

/// 热键 id → 动作名（与前端 `listen('global-hotkey')` 一致）。
#[derive(Clone, Default)]
pub struct HotkeyShortcutMap {
    pub inner: Arc<RwLock<HashMap<u32, String>>>,
}

#[cfg(desktop)]
use std::str::FromStr;

#[cfg(desktop)]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg(desktop)]
pub fn dispatch_shortcut<R: Runtime>(
    app: &AppHandle<R>,
    shortcut: &Shortcut,
    event: tauri_plugin_global_shortcut::ShortcutEvent,
    map: &HotkeyShortcutMap,
) {
    if event.state != ShortcutState::Pressed {
        return;
    }
    let action = map.inner.read().ok().and_then(|g| g.get(&shortcut.id()).cloned());
    if let Some(action) = action {
        let _ = app.emit("global-hotkey", action);
    }
}

#[cfg(desktop)]
fn status_err(e: impl ToString) -> HotkeyEntryStatus {
    HotkeyEntryStatus {
        ok: false,
        error: Some(e.to_string()),
    }
}

/// 反注册全部后按配置重新注册，并刷新 `map`。
#[cfg(desktop)]
pub fn apply_global_hotkeys_runtime<R: Runtime>(
    app: &AppHandle<R>,
    cfg: &GlobalHotkeys,
    map: &HotkeyShortcutMap,
) -> Result<HotkeyApplyReport, String> {
    let gs = app.global_shortcut();
    gs.unregister_all().map_err(|e| e.to_string())?;

    if let Ok(mut g) = map.inner.write() {
        g.clear();
    }

    if !cfg.enabled {
        return Ok(HotkeyApplyReport::all_ok());
    }

    let mut report = HotkeyApplyReport::all_ok();

    macro_rules! reg {
        ($field:ident, $action_lit:literal) => {{
            let s = cfg.$field.trim();
            if s.is_empty() {
                // 保持 ok
            } else {
                match Shortcut::from_str(s) {
                    Err(e) => {
                        report.$field = status_err(e);
                    }
                    Ok(sc) => match gs.register(s) {
                        Err(e) => {
                            report.$field = status_err(e);
                        }
                        Ok(()) => {
                            if let Ok(mut g) = map.inner.write() {
                                g.insert(sc.id(), $action_lit.to_string());
                            }
                        }
                    },
                }
            }
        }};
    }

    reg!(play_pause, "play_pause");
    reg!(prev, "prev");
    reg!(next, "next");
    reg!(volume_up, "volume_up");
    reg!(volume_down, "volume_down");

    Ok(report)
}

#[cfg(not(desktop))]
pub fn apply_global_hotkeys_runtime<R: Runtime>(
    _app: &AppHandle<R>,
    _cfg: &GlobalHotkeys,
    _map: &HotkeyShortcutMap,
) -> Result<HotkeyApplyReport, String> {
    Ok(HotkeyApplyReport::all_ok())
}

/// 校验快捷键字符串是否可被解析（不注册）。
pub fn validate_accelerator_str(s: &str) -> Result<(), String> {
    let t = s.trim();
    if t.is_empty() {
        return Ok(());
    }
    #[cfg(desktop)]
    {
        Shortcut::from_str(t).map_err(|e| e.to_string())?;
    }
    Ok(())
}
