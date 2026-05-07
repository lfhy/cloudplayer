import { createDownloadController } from "../../features/download/controller.js";
import { createLyricsController } from "../../features/lyrics/controller.js";
import { createAudioEventsController } from "../../features/player/audioEventsController.js";
import { createPlayerChromeController } from "../../features/player/chromeController.js";
import { createPlaybackController } from "../../features/player/playbackController.js";
import { createTrayRecentController } from "../../features/player/trayRecentController.js";

// Base player runtime assembles playback, lyrics, recents and download state around shared accessors.
export function createBasePlayerRuntime(deps) {
  const lyrics = createLyricsController({
    dockLyricsLockIcon: deps.dockLyricsLockIcon,
    emitTo: deps.emitTo,
    getAudioEl: deps.getAudioEl,
    getDesktopLyricsLocked: deps.getDesktopLyricsLocked,
    getDesktopLyricsOpen: deps.getDesktopLyricsOpen,
    getDesktopLyricsWindow: deps.getDesktopLyricsWindow,
    getPlayIndex: deps.getPlayIndex,
    getPlayLoadGeneration: deps.getPlayLoadGeneration,
    getPlayQueue: deps.getPlayQueue,
    invoke: deps.invoke,
    setDesktopLyricsLocked: deps.setDesktopLyricsLocked,
    setDesktopLyricsOpen: deps.setDesktopLyricsOpen,
    setDesktopLyricsWindow: deps.setDesktopLyricsWindow,
    WebviewWindow: deps.WebviewWindow,
  });

  const recent = createTrayRecentController({
    emitTo: deps.emitTo,
    escapeHtml: deps.escapeHtml,
    formatDurationMs: deps.formatDurationMs,
    getAudioEl: deps.getAudioEl,
    getLikedIds: deps.getLikedIds,
    getPlayIndex: deps.getPlayIndex,
    getPlayQueue: deps.getPlayQueue,
    getSessionRecentPlays: deps.getSessionRecentPlays,
    invoke: deps.invoke,
    maxSessionRecent: deps.maxSessionRecent,
    onRecentChanged: deps.onRecentChanged,
    playFromQueueIndex: (...args) => playback.playFromQueueIndex(...args),
    renderQueuePanel: (...args) => deps.renderQueuePanel(...args),
    setPlayQueue: deps.setPlayQueue,
    setSessionRecentPlays: deps.setSessionRecentPlays,
    trayPlayerTarget: deps.trayPlayerTarget,
  });

  const download = createDownloadController({
    alertRequestFailed: deps.alertRequestFailed,
    escapeHtml: deps.escapeHtml,
    getDownloadTasks: deps.getDownloadTasks,
    invoke: deps.invoke,
    messageRequestFailed: deps.messageRequestFailed,
    open: deps.open,
    setLocalLibraryRows: deps.setLocalLibraryRows,
    updateHomeAfterQueueChange: deps.onHomeQueueChanged,
    warnRequestFailed: deps.warnRequestFailed,
  });

  const chrome = createPlayerChromeController({
    broadcastTrayPlayerState: recent.broadcastTrayPlayerState,
    formatTime: deps.formatTime,
    getAudioEl: deps.getAudioEl,
    getPlayIndex: deps.getPlayIndex,
    getPlayModeIndex: deps.getPlayModeIndex,
    getPlayQueue: deps.getPlayQueue,
    getSeekDragging: deps.getSeekDragging,
    playModeItems: deps.playModeItems,
  });

  const playback = createPlaybackController({
    alertRequestFailed: deps.alertRequestFailed,
    clearLyricsCache: lyrics.clearLyricsCache,
    convertFileSrc: deps.convertFileSrc,
    ensureLrcLoadedForCurrentTrack: lyrics.ensureLrcLoadedForCurrentTrack,
    getAudioEl: deps.getAudioEl,
    getDesktopLyricsOpen: deps.getDesktopLyricsOpen,
    getPlayIndex: deps.getPlayIndex,
    getPlayLoadGeneration: deps.getPlayLoadGeneration,
    getPlayQueue: deps.getPlayQueue,
    getSearchState: deps.getSearchState,
    hasPendingPlaybackResume: deps.hasPendingPlaybackResume,
    invoke: deps.invoke,
    logPlayEventDesktop: deps.logPlayEventDesktop,
    messageRequestFailed: deps.messageRequestFailed,
    onAfterQueueChanged: () => recent.pushSessionRecentFromCurrentTrack(),
    onLyricsReady: () => lyrics.syncDesktopLyrics(),
    refreshFavButton: (...args) => deps.refreshFavButton(...args),
    renderQueuePanel: (...args) => deps.renderQueuePanel(...args),
    scheduleSavePlaybackState: deps.scheduleSavePlaybackState,
    setAudioSourceGeneration: deps.setAudioSourceGeneration,
    setPlayIndex: deps.setPlayIndex,
    setPlayLoadGeneration: deps.setPlayLoadGeneration,
    setPlayQueue: deps.setPlayQueue,
    setPlayerNavEnabled: chrome.setPlayerNavEnabled,
    syncSeekUi: chrome.syncSeekUi,
    updatePlayerChrome: chrome.updatePlayerChrome,
  });

  const audio = createAudioEventsController({
    applyPendingPlaybackResume: deps.applyPendingPlaybackResume,
    alertRequestFailed: deps.alertRequestFailed,
    audioDiagPayload: deps.audioDiagPayload,
    broadcastTrayPlayerState: recent.broadcastTrayPlayerState,
    getAudioEl: deps.getAudioEl,
    getAudioProgressLogLastTs: deps.getAudioProgressLogLastTs,
    getAudioSourceGeneration: deps.getAudioSourceGeneration,
    getPlayIndex: deps.getPlayIndex,
    getPlayLoadGeneration: deps.getPlayLoadGeneration,
    getPlayModeIndex: deps.getPlayModeIndex,
    getPlayQueue: deps.getPlayQueue,
    logPlayEventDesktop: deps.logPlayEventDesktop,
    messageRequestFailed: deps.messageRequestFailed,
    playFromQueueIndex: (...args) => playback.playFromQueueIndex(...args),
    playModeItems: deps.playModeItems,
    randomNextIndex: (...args) => deps.randomNextIndex(...args),
    refreshCurrentLyricsSnapshot: () => lyrics.refreshCurrentLyricsSnapshot(),
    savePlaybackProgressNow: deps.savePlaybackProgressNow,
    scheduleSavePlaybackProgress: deps.scheduleSavePlaybackProgress,
    setAudioProgressLogLastTs: deps.setAudioProgressLogLastTs,
    setSeekDragging: deps.setSeekDragging,
    syncDesktopLyrics: () => lyrics.syncDesktopLyrics(),
    syncSeekUi: chrome.syncSeekUi,
  });

  return {
    ...lyrics,
    ...recent,
    ...download,
    ...chrome,
    playFromQueueIndex: playback.playFromQueueIndex,
    playFromSearchRow: playback.playFromSearchRow,
    removeCurrentFromQueue: playback.removeCurrentFromQueue,
    restorePlaybackSelection: playback.restorePlaybackSelection,
    wireAudio: audio.wireAudio,
  };
}
