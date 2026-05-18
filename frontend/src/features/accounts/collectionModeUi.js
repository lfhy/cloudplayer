import { normalizeMusicCollectionMode } from "../../app/helpers/platformTheme.js";

// Collection-mode UI helpers keep account-center mode feedback and selection wiring out of the larger view controller.
export function formatAccountID(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/[eE]\+/.test(raw)) return raw;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed.toFixed(0) : raw;
}

export function applyCollectionModeState({ mode = "offline", visible = false, busy = false, wrap = null, hiddenInput = null } = {}) {
  const normalized = normalizeMusicCollectionMode(mode);
  if (!wrap) return normalized;
  wrap.hidden = !visible;
  if (hiddenInput) hiddenInput.value = normalized;
  wrap.querySelectorAll("[data-account-music-collection-mode-card]").forEach((button) => {
    const active = button.getAttribute("data-account-music-collection-mode-card") === normalized;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", active ? "true" : "false");
    button.toggleAttribute("disabled", !!busy);
  });
  return normalized;
}

function collectionModeBusyText(mode) {
  return mode === "offline"
    ? "正在切回离线歌单..."
    : mode === "hybrid"
      ? "正在切换到混合模式并同步云歌单..."
      : "正在开启在线模式并同步云歌单...";
}

export function wireKugouCollectionModeToggle(deps) {
  const {
    alertRequestFailed,
    getCurrentMode,
    getWrapEl,
    notifyLayoutSettled,
    onOnlineModeToggleRequested,
    setCollectionModeState,
    setCurrentMode,
    setKugouLoading,
  } = deps;
  const switchCollectionMode = async (nextMode) => {
    const normalized = normalizeMusicCollectionMode(nextMode);
    setCollectionModeState({ mode: getCurrentMode(), visible: true, busy: true });
    setKugouLoading(true, collectionModeBusyText(normalized));
    notifyLayoutSettled(20);
    try {
      const result = await onOnlineModeToggleRequested?.(normalized);
      setCurrentMode(normalizeMusicCollectionMode(result?.mode || normalized));
      setCollectionModeState({ mode: getCurrentMode(), visible: true, busy: false });
      notifyLayoutSettled();
    } catch (error) {
      setCollectionModeState({ mode: getCurrentMode(), visible: true, busy: false });
      alertRequestFailed(error, "toggle music collection mode from account center");
    } finally {
      setKugouLoading(false);
    }
  };
  getWrapEl()?.querySelectorAll("[data-account-music-collection-mode-card]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.hasAttribute("disabled")) return;
      const nextMode = normalizeMusicCollectionMode(button.getAttribute("data-account-music-collection-mode-card"));
      if (nextMode === getCurrentMode()) return;
      void switchCollectionMode(nextMode);
    });
  });
}
