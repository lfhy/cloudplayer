// Settings action helpers isolate one-off button flows from the core controller.
export function wireSettingsActionButtons({ alertRequestFailed, invoke }) {
  document.getElementById("btn-clear-search-cache")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("setting-search-cache-status");
    try {
      const cleared = await invoke("clear_search_cache");
      if (statusEl) statusEl.textContent = cleared > 0 ? `已清理 ${cleared} 条搜索缓存。` : "当前没有可清理的搜索缓存。";
    } catch (error) {
      alertRequestFailed(error, "clear search cache");
    }
  });

  document.getElementById("btn-reset-desktop-lyrics-bounds")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("setting-ly-bounds-status");
    try {
      await invoke("reset_desktop_lyrics_bounds");
      if (statusEl) statusEl.textContent = "已恢复默认位置，后续会从默认位置重新记忆。";
    } catch (error) {
      alertRequestFailed(error, "reset desktop lyrics bounds");
    }
  });
}
