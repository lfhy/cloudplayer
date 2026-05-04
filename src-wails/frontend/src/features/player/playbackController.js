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
    getPlayIndex,
    getPlayLoadGeneration,
    getPlayQueue,
    getSearchState,
    invoke,
    logPlayEventDesktop,
    messageRequestFailed,
    onAfterQueueChanged,
    onLyricsReady,
    refreshFavButton,
    renderQueuePanel,
    setAudioSourceGeneration,
    setPlayIndex,
    setPlayLoadGeneration,
    setPlayQueue,
    setPlayerNavEnabled,
    syncSeekUi,
    updatePlayerChrome,
  } = deps;

  function removeCurrentFromQueue() {
    const queue = getPlayQueue();
    if (!queue.length) return;
    queue.splice(getPlayIndex(), 1);
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
  }

  async function playFromQueueIndex(index) {
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
      const { assetUrl, playLogExtra } = await resolvePlaybackUrl(item, generation);
      if (generation !== getPlayLoadGeneration()) return;
      await logPlayEventDesktop("play_start", { url: assetUrl, extra: playLogExtra });
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.src = assetUrl;
      setAudioSourceGeneration(generation);
      await audio.play();
      if (generation !== getPlayLoadGeneration()) return;
      onAfterQueueChanged();
      updatePlayerChrome({
        title: item.title,
        sub: item.artist || "",
        coverUrl: item.cover_url || null,
      });
      if (playButton) {
        setPlayButtonIcon(playButton, true);
        playButton.disabled = false;
      }
      setPlayerNavEnabled();
      syncSeekUi();
      renderQueuePanel();
      refreshFavButton();
      clearLyricsCache();
      if (getDesktopLyricsOpen()) {
        void ensureLrcLoadedForCurrentTrack(generation).then(() => {
          if (generation !== getPlayLoadGeneration()) return;
          void onLyricsReady();
        });
      }
    } catch (error) {
      if (generation !== getPlayLoadGeneration()) return;
      updatePlayerChrome({ title: item.title, sub: messageRequestFailed, touchCover: false });
      alertRequestFailed(error, "playFromQueueIndex");
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
        cover_url: row.cover_url || null,
      }))
    );
    void playFromQueueIndex(rowIndex);
    renderQueuePanel();
  }

  async function resolvePlaybackUrl(item, generation) {
    if (item.local_path) {
      return resolveLocalPlayback(item, generation);
    }
    return resolveOnlinePlayback(item, generation);
  }

  async function resolveLocalPlayback(item, generation) {
    let pathOk = false;
    try {
      pathOk = await invoke("local_path_accessible", { path: item.local_path });
    } catch (error) {
      console.warn("local_path_accessible", error);
    }
    if (!pathOk) {
      if (generation !== getPlayLoadGeneration()) return { assetUrl: "", playLogExtra: null };
      updatePlayerChrome({
        title: item.title,
        sub: `${item.artist ? `${item.artist} · ` : ""}本地文件不可用`,
        touchCover: false,
      });
      alert(`本地文件不存在或无法访问：\n${String(item.local_path || "").trim() || "（路径为空）"}`);
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

  return { playFromQueueIndex, playFromSearchRow, removeCurrentFromQueue };
}
