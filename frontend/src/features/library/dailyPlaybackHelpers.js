// Daily playback helpers keep recommendation queue building out of the page runtime.
function normalizeDailyQueueItem(item) {
  if (item?.local_path) {
    return {
      title: item.title,
      artist: item.artist || "",
      album: item.album || "",
      local_path: item.local_path,
      cover_url: item.cover_url || null,
      duration_ms: Number(item.duration_ms || 0) || 0,
    };
  }
  return {
    source_id: item.source_id,
    title: item.title,
    artist: item.artist || "",
    album: item.album || "",
    cover_url: item.cover_url || null,
    duration_ms: Number(item.duration_ms || 0) || 0,
  };
}

export function buildDailyPlaybackQueue(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((item) => !!item?.local_path || !!String(item?.source_id || "").trim())
    .map((item) => normalizeDailyQueueItem(item));
}

export function playDailyRecommendationRows(rows, rowIdx, deps) {
  const { playFromQueueIndex, renderQueuePanel, setPlayQueue } = deps;
  const queue = buildDailyPlaybackQueue(rows);
  if (!queue.length) return;
  const safeIndex = Math.max(0, Math.min(queue.length - 1, Number(rowIdx) || 0));
  setPlayQueue(queue);
  void playFromQueueIndex(safeIndex);
  renderQueuePanel();
}
