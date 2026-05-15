import { getMusicCollectionModeSelection, toggleMusicCollectionMode } from "./sourceMode.js";

// External collection-mode bridge lets child windows reuse the settings toggle flow without duplicating persistence rules.
export function createExternalOnlineModeToggle(deps) {
  const { alertRequestFailed, onMusicCollectionModeChanged, persistSettingsFromForm, setMusicCollectionModeValue } = deps;
  return async (nextMode) => {
    const target = String(nextMode || "").trim().toLowerCase() || "offline";
    if (getMusicCollectionModeSelection() === target) {
      setMusicCollectionModeValue?.(target);
      return { mode: target };
    }
    await toggleMusicCollectionMode(target, {
      alertRequestFailed,
      confirmBeforeEnable: false,
      onMusicCollectionModeChanged,
      persistSettingsFromForm,
    });
    const mode = getMusicCollectionModeSelection();
    setMusicCollectionModeValue?.(mode);
    return { mode };
  };
}
