import { navIconSvg } from "../../app/helpers/icons.js";

// Playlist sidebar view keeps loading/empty/item DOM generation out of the controller.
export function buildSidebarPlaylistItem(playlist, escapeHtml) {
  const li = document.createElement("li");
  li.className = "sidebar-pl-item";
  li.setAttribute("data-playlist-id", String(playlist.id));
  if (playlist.is_cloud) li.setAttribute("data-playlist-cloud", "true");
  li.innerHTML = `
    <span class="sidebar-pl-item__icon" aria-hidden="true">${navIconSvg(playlist.is_builtin ? "favorites" : playlist.is_cloud ? "cloud" : "playlist")}</span>
    <span class="sidebar-pl-item__label">${escapeHtml(playlist.name?.trim() || `歌单 ${playlist.id}`)}</span>
  `;
  li.title = playlist.is_builtin
    ? `系统歌单 · id=${playlist.id} · 查看导入曲目`
    : playlist.is_cloud
      ? `云歌单 · id=${playlist.id} · 缓存 12 小时`
      : `id=${playlist.id} · 查看导入曲目`;
  return li;
}

export function playlistSidebarEmptyText(onlineMode) {
  return onlineMode ? "当前云端账号下暂无歌单。" : "暂无歌单 · 与 Py 版共用 ~/.cloudplayer/library.db · 在此页「保存为新歌单」即可出现";
}
