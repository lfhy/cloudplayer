import { createHomeController } from "../../features/library/homeController.js";
import { playDailyRecommendationRows } from "../../features/library/dailyPlaybackHelpers.js";

// Home page runtime wiring stays separate so the main page runtime file stays under the size cap.
export function createPageRuntimeHome(deps) {
  const {
    alertRequestFailed,
    escapeHtml,
    formatDurationMs,
    getDownloadTaskCount,
    getLikedIds,
    getSessionRecentPlays,
    invoke,
    playFromQueueIndex,
    playFromRecentRow,
    playlist,
    renderQueuePanel,
    setPage,
    setPlayQueue,
    setSelectedPlaylist,
  } = deps;

  const dailyPlaylistName = () => `每日推荐 ${new Date().toISOString().slice(0, 10)}`;
  const home = createHomeController({
    alertRequestFailed,
    escapeHtml,
    formatDurationMs,
    getDownloadTaskCount,
    getLikedIds,
    getSessionRecentPlays,
    invoke,
    onDailySaved: async ({ playlistId, playlistName }) => {
      setSelectedPlaylist(playlistId, playlistName);
      await playlist.refreshPlaylistSelect();
      await playlist.refreshSidebarPlaylists();
      await playlist.loadPlaylistDetail(playlistId, playlistName);
      setPage("playlist");
    },
    playAllDailyItems: (rows) => {
      playDailyRecommendationRows(rows, 0, { playFromQueueIndex, renderQueuePanel, setPlayQueue });
    },
    playDailyItem: (rows, rowIdx) => {
      playDailyRecommendationRows(rows, rowIdx, { playFromQueueIndex, renderQueuePanel, setPlayQueue });
    },
    playFromRecentRow,
  });

  return { dailyPlaylistName, home };
}
