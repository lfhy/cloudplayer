import { isMusicSourceOnlineModeSelected, toggleMusicOnlineMode } from "./sourceMode.js";

// External online-mode bridge lets child windows reuse the settings toggle flow without duplicating persistence rules.
export function createExternalOnlineModeToggle(deps) {
  const { alertRequestFailed, onMusicOnlineModeChanged, persistSettingsFromForm, setMusicOnlineModeEnabledValue } = deps;
  return async (nextEnabled) => {
    const target = !!nextEnabled;
    if (isMusicSourceOnlineModeSelected() === target) {
      setMusicOnlineModeEnabledValue?.(target);
      return { enabled: target };
    }
    await toggleMusicOnlineMode(target, {
      alertRequestFailed,
      confirmBeforeEnable: false,
      onMusicOnlineModeChanged,
      persistSettingsFromForm,
    });
    const enabled = isMusicSourceOnlineModeSelected();
    setMusicOnlineModeEnabledValue?.(enabled);
    return { enabled };
  };
}
