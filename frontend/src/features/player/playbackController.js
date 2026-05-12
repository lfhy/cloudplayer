// Playback loading stays in one controller so queue mutations and async generations share rules.
import { proxyRemoteAssetSrc } from "../../wails/tauri-core.js";
import { setPlayButtonIcon } from "./playButtonIcon.js";

export function createPlaybackController(deps) {
  const {
    alertRequestFailed,
    clearLyricsCache,
    convertFileSrc,
    ensureLrcLoadedForCurrentTrack,
    getAudioEl,
    getDesktopLyricsOpen,
    getDownloadTasks,
    getPlayIndex,
    getPlayLoadGeneration,
    getPlayQueue,
    getSearchState,
    hasPendingPlaybackResume,
    invoke,
    logPlayEventDesktop,
    messageRequestFailed,
    onAfterQueueChanged,
    onLyricsReady,
    prepareForDirectPlayback,
    refreshFavButton,
    renderQueuePanel,
    scheduleSavePlaybackState,
    setAudioSourceGeneration,
    setPlayIndex,
    setPlayLoadGeneration,
    setPlayQueue,
    setPlayerNavEnabled,
    syncSeekUi,
    updatePlayerChrome,
  } = deps;

  function autoCacheOnPlayEnabled() {
    return document.getElementById("setting-auto-cache-on-play")?.checked === true;
  }

  function removeCurrentFromQueue() {
    const queue = getPlayQueue().slice();
    if (!queue.length) return;
    queue.splice(getPlayIndex(), 1);
    setPlayQueue(queue);
    const audio = getAudioEl();
    if (!queue.length) {
      setPlayIndex(0);
      setPlayLoadGeneration(getPlayLoadGeneration() + 1);
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
      }
      updatePlayerChrome({ title: "未播放", sub: "队列已空", coverUrl: null });
      const playButton = document.getElementById("btn-player-play");
      setPlayButtonIcon(playButton, false);
    } else {
      if (getPlayIndex() >= queue.length) setPlayIndex(queue.length - 1);
      void playFromQueueIndex(getPlayIndex());
    }
    renderQueuePanel();
    setPlayerNavEnabled();
    refreshFavButton();
    scheduleSavePlaybackState?.();
  }

  async function playFromQueueIndex(index) {
    await loadQueueIndex(index, { autoplay: true, quiet: false, recordRecent: true });
  }

  async function loadQueueIndex(index, options = {}) {
    const { autoplay = true, quiet = false, recordRecent = false } = options;
    const queue = getPlayQueue();
    if (!queue.length || index < 0 || index >= queue.length) return;
    const generation = getPlayLoadGeneration() + 1;
    setPlayLoadGeneration(generation);
    setPlayIndex(index);
    const item = queue[index];
    updatePlayerChrome({
      title: item.title,
      sub: item.artist || "",
      touchCover: false,
    });
    const playButton = document.getElementById("btn-player-play");
    const audio = getAudioEl();
    try {
      const { assetUrl, playLogExtra } = await resolvePlaybackUrl(item, generation, { quiet });
      if (generation !== getPlayLoadGeneration()) return;
      await logPlayEventDesktop("play_start", { url: assetUrl, extra: playLogExtra });
      prepareForDirectPlayback?.();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.src = assetUrl;
      setAudioSourceGeneration(generation);
      if (autoplay) await audio.play();
      else audio.load();
      if (generation !== getPlayLoadGeneration()) return;
      if (recordRecent) onAfterQueueChanged();
      updatePlayerChrome({
        title: item.title,
        sub: item.artist || "",
        coverUrl: item.cover_url || null,
      });
      if (playButton) {
        setPlayButtonIcon(playButton, autoplay);
        playButton.disabled = false;
      }
      setPlayerNavEnabled();
      syncSeekUi();
      renderQueuePanel();
      refreshFavButton();
      void maybeQueueAutoCacheDownload(item, playLogExtra);
      clearLyricsCache();
      if (getDesktopLyricsOpen() || hasPendingPlaybackResume?.(item)) {
        void ensureLrcLoadedForCurrentTrack(generation).then(() => {
          if (generation !== getPlayLoadGeneration()) return;
          void onLyricsReady();
        });
      }
    } catch (error) {
      if (generation !== getPlayLoadGeneration()) return;
      if (!quiet) {
        updatePlayerChrome({ title: item.title, sub: messageRequestFailed, touchCover: false });
        alertRequestFailed(error, "playFromQueueIndex");
      } else {
        console.warn("restore playback source", error);
      }
    }
  }

  function playFromSearchRow(rowIndex) {
    const searchState = getSearchState();
    if (searchState.scope !== "catalog") return;
    setPlayQueue(
      searchState.results.map((row) => ({
        source_id: row.source_id,
        title: row.title,
        artist: row.artist || "",
        album: row.album || "",
        cover_url: row.cover_url || null,
        duration_ms: Number(row.duration_ms || 0) || 0,
      }))
    );
    void playFromQueueIndex(rowIndex);
    renderQueuePanel();
  }

  function restorePlaybackSelection() {
    const queue = getPlayQueue();
    const current = queue[getPlayIndex()] || null;
    const audio = getAudioEl();
    const playButton = document.getElementById("btn-player-play");
    if (audio) {
      prepareForDirectPlayback?.();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (!current) {
      updatePlayerChrome({ title: "未播放", sub: "选择曲目或搜索后双击列表", coverUrl: null });
      setPlayButtonIcon(playButton, false);
      if (playButton) playButton.disabled = true;
      setPlayerNavEnabled();
      syncSeekUi();
      renderQueuePanel();
      refreshFavButton();
      return;
    }
    updatePlayerChrome({
      title: current.title || "未命名曲目",
      sub: current.artist || "",
      coverUrl: current.cover_url || null,
    });
    setPlayButtonIcon(playButton, false);
    if (playButton) playButton.disabled = false;
    setPlayerNavEnabled();
    syncSeekUi();
    renderQueuePanel();
    refreshFavButton();
    if (hasPendingPlaybackResume?.(current)) {
      void loadQueueIndex(getPlayIndex(), { autoplay: false, quiet: true, recordRecent: false });
    }
  }

  async function resolvePlaybackUrl(item, generation, options = {}) {
    if (item.local_path) {
      return resolveLocalPlayback(item, generation, options);
    }
    return resolveOnlinePlayback(item, generation, options);
  }

  async function resolveLocalPlayback(item, generation, options = {}) {
    let pathOk = false;
    try {
      pathOk = await invoke("local_path_accessible", { path: item.local_path });
    } catch (error) {
      console.warn("local_path_accessible", error);
    }
    if (!pathOk) {
      if (generation !== getPlayLoadGeneration()) return { assetUrl: "", playLogExtra: null };
      if (!options.quiet) {
        updatePlayerChrome({
          title: item.title,
          sub: `${item.artist ? `${item.artist} · ` : ""}本地文件不可用`,
          touchCover: false,
        });
        alert(`本地文件不存在或无法访问：\n${String(item.local_path || "").trim() || "（路径为空）"}`);
      }
      throw new Error("local_path_accessible failed");
    }
    return { assetUrl: convertFileSrc(item.local_path), playLogExtra: { kind: "local" } };
  }

  async function resolveOnlinePlayback(item, generation) {
    const startedAt = Date.now();
    let resolved = null;
    let lastError = null;
    while (Date.now() - startedAt < 5000) {
      if (generation !== getPlayLoadGeneration()) return { assetUrl: "", playLogExtra: null };
      try {
        resolved = await invoke("resolve_online_play", {
          songId: item.source_id,
          title: item.title || "",
          artist: item.artist || "",
        });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        const remaining = 5000 - (Date.now() - startedAt);
        if (remaining <= 0) break;
        await new Promise((resolve) => setTimeout(resolve, Math.min(200, remaining)));
      }
    }
    if (generation !== getPlayLoadGeneration()) return { assetUrl: "", playLogExtra: null };
    if (!resolved) throw lastError ?? new Error("resolve_online_play failed");
    if (resolved.kind === "url" && resolved.url) {
      return {
        assetUrl: proxyRemoteAssetSrc(resolved.url),
        playLogExtra: { sid: item.source_id, kind: resolved.kind, via: resolved.via },
      };
    }
    if (resolved.kind === "file" && resolved.path) {
      return {
        assetUrl: convertFileSrc(resolved.path),
        playLogExtra: { sid: item.source_id, kind: resolved.kind, via: resolved.via },
      };
    }
    throw new Error("resolve_online_play: 无效结果");
  }

  async function maybeQueueAutoCacheDownload(item, playLogExtra) {
    const sourceId = String(item?.source_id || "").trim();
    if (!autoCacheOnPlayEnabled() || !sourceId || item?.local_path || playLogExtra?.via === "download") return;
    if (getDownloadTasks().has(sourceId)) return;
    try {
      await invoke("enqueue_download", { source_id: sourceId, title: item.title || "", artist: item.artist || "", cover_url: item.cover_url || "", quality: "128" });
    } catch (error) {
      console.warn("auto cache enqueue_download", error);
    }
  }

  return { playFromQueueIndex, playFromSearchRow, removeCurrentFromQueue, restorePlaybackSelection };
}
