import { getMusicCollectionModeSelection, musicCollectionModeStatusText, primeMusicCollectionModeLoadingUi, setMusicCollectionModeBusy, setMusicCollectionModeSelection } from "./sourceMode.js";

let pendingExternalCollectionModeToggle = null;

// External collection-mode bridge lets child windows reuse the settings toggle flow without duplicating persistence rules.
export function createExternalOnlineModeToggle(deps) {
  const { alertRequestFailed, onMusicCollectionModeChanged, persistSettingsFromForm, setMusicCollectionModeValue } = deps;
  return async (nextMode) => {
    if (pendingExternalCollectionModeToggle) return pendingExternalCollectionModeToggle;
    const target = String(nextMode || "").trim().toLowerCase() || "offline";
    pendingExternalCollectionModeToggle = (async () => {
      const previous = getMusicCollectionModeSelection();
      if (previous === target) {
        setMusicCollectionModeValue?.(target);
        return { mode: target };
      }
      setMusicCollectionModeSelection(target);
      setMusicCollectionModeBusy(true, target === "offline"
        ? "正在切回离线歌单…"
        : target === "hybrid"
          ? "正在切换到混合模式并同步云歌单…"
          : "正在开启在线模式并同步云歌单…");
      primeMusicCollectionModeLoadingUi(target === "offline"
        ? "正在切回离线歌单…"
        : target === "hybrid"
          ? "正在切换到混合模式并同步云歌单…"
          : "正在开启在线模式并同步云歌单…");
      try {
        await persistSettingsFromForm();
        setMusicCollectionModeValue?.(target);
        await onMusicCollectionModeChanged?.(target);
        setMusicCollectionModeBusy(false, musicCollectionModeStatusText(target));
        return { mode: target };
      } catch (error) {
        setMusicCollectionModeSelection(previous);
        setMusicCollectionModeValue?.(previous);
        setMusicCollectionModeBusy(false, "歌单模式切换失败，请稍后重试。");
        alertRequestFailed(error, "toggle music collection mode from account center");
        throw error;
      }
    })();
    try {
      return await pendingExternalCollectionModeToggle;
    } finally {
      pendingExternalCollectionModeToggle = null;
    }
  };
}
