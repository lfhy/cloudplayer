// Settings hotkey helpers keep capture state and conflict rendering out of the runtime entry.
export function createHotkeyController(deps) {
  const { invoke, queueSettingsAutosave, updateSettingsSaveButtonState, warnRequestFailed } = deps;
  let hotkeyCaptureButton = null;
  let hotkeyCapturePrevAccel = "";

  function getGlobalHotkeysPayloadFromDom() {
    const enabledEl = document.getElementById("setting-hotkeys-enabled");
    return {
      play_pause: (document.getElementById("hk-play-pause")?.dataset.accel || "").trim(),
      prev: (document.getElementById("hk-prev")?.dataset.accel || "").trim(),
      next: (document.getElementById("hk-next")?.dataset.accel || "").trim(),
      volume_up: (document.getElementById("hk-vol-up")?.dataset.accel || "").trim(),
      volume_down: (document.getElementById("hk-vol-down")?.dataset.accel || "").trim(),
      enabled: !!enabledEl?.checked,
    };
  }

  function codeToHotkeyMainKey(code) {
    if (!code) return null;
    if (code.startsWith("Key") && code.length === 4) return code.slice(3).toLowerCase();
    if (code.startsWith("Digit")) return code.slice(5);
    const map = {
      Space: "space",
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
      Escape: "escape",
      Tab: "tab",
      Enter: "enter",
      Backspace: "backspace",
      Delete: "delete",
    };
    if (map[code]) return map[code];
    if (code.startsWith("F") && /^F\d+$/.test(code)) return code.toLowerCase();
    return null;
  }

  function accelFromKeyboardEvent(ev) {
    const key = codeToHotkeyMainKey(ev.code);
    if (!key || key === "escape") return null;
    const mods = [];
    if (ev.shiftKey) mods.push("shift");
    if (ev.ctrlKey) mods.push("control");
    if (ev.altKey) mods.push("alt");
    if (ev.metaKey) mods.push("super");
    if (mods.length === 0 && key === "backspace") return "__clear__";
    if (mods.length === 0) return null;
    mods.push(key);
    return mods.join("+");
  }

  function formatAccelDisplay(value) {
    if (!value || !String(value).trim()) return "未设置";
    return String(value)
      .split("+")
      .map((raw) => {
        const token = raw.trim().toLowerCase();
        if (token === "control" || token === "ctrl") return "Ctrl";
        if (token === "alt") return "Alt";
        if (token === "shift") return "Shift";
        if (["super", "command", "cmd"].includes(token)) return "Meta";
        if (["left", "right", "up", "down", "space"].includes(token)) {
          return token === "space" ? "Space" : token[0].toUpperCase() + token.slice(1);
        }
        if (token.length === 1) return raw.trim().toUpperCase();
        return raw.trim().length ? raw.trim().charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : "";
      })
      .filter(Boolean)
      .join(" + ");
  }

  function syncHotkeyButtonUi(button) {
    const accel = (button.dataset.accel || "").trim();
    button.textContent = accel ? formatAccelDisplay(accel) : "未设置";
    button.classList.toggle("hotkeys-input--empty", !accel);
  }

  function stopHotkeyCapture(restore) {
    if (!hotkeyCaptureButton) return;
    const button = hotkeyCaptureButton;
    hotkeyCaptureButton = null;
    button.classList.remove("hotkeys-input--capturing");
    document.removeEventListener("keydown", onHotkeyCaptureKeydown, true);
    if (restore) {
      button.dataset.accel = hotkeyCapturePrevAccel;
      syncHotkeyButtonUi(button);
    }
    hotkeyCapturePrevAccel = "";
  }

  function onHotkeyCaptureKeydown(ev) {
    if (!hotkeyCaptureButton) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      stopHotkeyCapture(true);
      updateSettingsSaveButtonState();
      return;
    }
    const raw = accelFromKeyboardEvent(ev);
    if (!raw) {
      ev.preventDefault();
      return;
    }
    if (raw === "__clear__") {
      ev.preventDefault();
      hotkeyCaptureButton.dataset.accel = "";
      syncHotkeyButtonUi(hotkeyCaptureButton);
      stopHotkeyCapture(false);
      queueSettingsAutosave(true);
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    void (async () => {
      try {
        await invoke("validate_accelerator", { s: raw });
      } catch (err) {
        warnRequestFailed(err, "validate_accelerator");
        return;
      }
      hotkeyCaptureButton.dataset.accel = raw;
      syncHotkeyButtonUi(hotkeyCaptureButton);
      stopHotkeyCapture(false);
      queueSettingsAutosave(true);
    })();
  }

  function startHotkeyCapture(button) {
    if (hotkeyCaptureButton && hotkeyCaptureButton !== button) stopHotkeyCapture(true);
    hotkeyCaptureButton = button;
    hotkeyCapturePrevAccel = (button.dataset.accel || "").trim();
    button.classList.add("hotkeys-input--capturing");
    button.textContent = "按下组合键…";
    document.addEventListener("keydown", onHotkeyCaptureKeydown, true);
  }

  function wireHotkeySettingsUi() {
    document.querySelectorAll(".hotkeys-input").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        startHotkeyCapture(button);
      });
    });
  }

  function hotkeyFieldLabel(fieldKey) {
    return {
      play_pause: "播放/暂停",
      prev: "上一首",
      next: "下一首",
      volume_up: "增大音量",
      volume_down: "减少音量",
    }[fieldKey] || fieldKey;
  }

  function hotkeyStatusSetConflict(fieldKey, title) {
    const el = document.getElementById({
      play_pause: "hk-status-play-pause",
      prev: "hk-status-prev",
      next: "hk-status-next",
      volume_up: "hk-status-vol-up",
      volume_down: "hk-status-vol-down",
    }[fieldKey]);
    if (!el) return;
    el.dataset.status = "conflict";
    el.textContent = "冲突";
    if (title) el.title = title;
  }

  function renderHotkeyStatusOk() {
    ["hk-status-play-pause", "hk-status-prev", "hk-status-next", "hk-status-vol-up", "hk-status-vol-down"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.dataset.status = "ok";
      el.textContent = "正常";
      el.removeAttribute("title");
    });
  }

  function renderHotkeyStatusFromReport(report) {
    [["hk-status-play-pause", report.play_pause], ["hk-status-prev", report.prev], ["hk-status-next", report.next], ["hk-status-vol-up", report.volume_up], ["hk-status-vol-down", report.volume_down]].forEach(([id, status]) => {
      const el = document.getElementById(id);
      if (!el || !status) return;
      el.dataset.status = status.ok ? "ok" : "conflict";
      el.textContent = status.ok ? "正常" : "冲突";
      if (status.ok) el.removeAttribute("title");
      else if (status.error) el.title = status.error;
    });
  }

  function fillHotkeysFormFromSettings(settings) {
    const hotkeys = settings?.global_hotkeys ?? settings?.globalHotkeys ?? {
      play_pause: "ctrl+alt+space",
      prev: "ctrl+alt+left",
      next: "ctrl+alt+right",
      volume_up: "ctrl+alt+up",
      volume_down: "ctrl+alt+down",
      enabled: true,
    };
    const enabledEl = document.getElementById("setting-hotkeys-enabled");
    if (enabledEl) enabledEl.checked = hotkeys.enabled !== false;
    [["hk-play-pause", hotkeys.play_pause ?? hotkeys.playPause], ["hk-prev", hotkeys.prev], ["hk-next", hotkeys.next], ["hk-vol-up", hotkeys.volume_up ?? hotkeys.volumeUp], ["hk-vol-down", hotkeys.volume_down ?? hotkeys.volumeDown]].forEach(([id, value]) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.dataset.accel = String(value || "").trim().toLowerCase();
      syncHotkeyButtonUi(button);
    });
    renderHotkeyStatusOk();
  }

  return {
    fillHotkeysFormFromSettings,
    getGlobalHotkeysPayloadFromDom,
    hotkeyFieldLabel,
    hotkeyStatusSetConflict,
    renderHotkeyStatusFromReport,
    renderHotkeyStatusOk,
    wireHotkeySettingsUi,
  };
}
