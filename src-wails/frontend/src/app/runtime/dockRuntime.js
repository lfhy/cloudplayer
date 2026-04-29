import { createDockController } from "../../features/player/dockController.js";
import { createDockThemeHelpers } from "../../features/player/dockTheme.js";
import { createPlayerHotkeyController } from "../../features/player/hotkeysController.js";

// Dock runtime wires the dock bar theme, menu actions and global hotkeys together.
export function createDockRuntime(deps) {
  const dockTheme = createDockThemeHelpers({
    applyAppTheme: deps.applyAppTheme,
    getSettingsFormValues: deps.getSettingsFormValues,
    labels: deps.quickThemeModeLabels,
    navIconSvg: deps.navIconSvg,
    normalizeAppThemeMode: deps.normalizeAppThemeMode,
    queueSettingsAutosave: deps.queueSettingsAutosave,
    setThemeModeSelection: deps.setThemeModeSelection,
  });

  const dock = createDockController({
    alertRequestFailed: deps.alertRequestFailed,
    applyQuickThemeMode: dockTheme.applyQuickThemeMode,
    broadcastDesktopLyricsLock: deps.broadcastDesktopLyricsLock,
    closeContextMenu: deps.closeContextMenu,
    effectiveQuickThemeMode: dockTheme.effectiveQuickThemeMode,
    enqueueDownloadForTrack: deps.enqueueDownloadForTrack,
    getDesktopLyricsLocked: deps.getDesktopLyricsLocked,
    getDesktopLyricsOpen: deps.getDesktopLyricsOpen,
    getLikedIds: deps.getLikedIds,
    getPlayIndex: deps.getPlayIndex,
    getPlayModeIndex: deps.getPlayModeIndex,
    getPlayQueue: deps.getPlayQueue,
    getQualityPref: deps.getQualityPref,
    iconSvgByName: deps.iconSvgByName,
    invoke: deps.invoke,
    nextQuickThemeMode: dockTheme.nextQuickThemeMode,
    playFromQueueIndex: deps.playFromQueueIndex,
    playModeItems: deps.playModeItems,
    qualityLabels: deps.qualityLabels,
    refreshLyricsLockMenuLabel: deps.refreshLyricsLockMenuLabel,
    refreshQuickThemeModeUi: dockTheme.refreshQuickThemeModeUi,
    removeCurrentFromQueue: deps.removeCurrentFromQueue,
    renderPlayerNav: deps.renderPlayerNav,
    saveLikedIds: deps.saveLikedIds,
    setDesktopLyricsLocked: deps.setDesktopLyricsLocked,
    setPlayModeIndex: deps.setPlayModeIndex,
    setQualityPref: deps.setQualityPref,
    toggleDesktopLyrics: deps.toggleDesktopLyrics,
    toggleQueuePanel: deps.toggleQueuePanel,
  });

  const hotkeys = createPlayerHotkeyController({
    getAudioEl: deps.getAudioEl,
    invoke: deps.invoke,
    listen: deps.listen,
    shouldIgnoreGlobalHotkeyAction: deps.shouldIgnoreGlobalHotkeyAction,
    warnRequestFailed: deps.warnRequestFailed,
  });

  return { dock, dockTheme, hotkeys };
}
