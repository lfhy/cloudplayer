// Playlist loading view centralizes table and sidebar loading placeholders.
export function renderPlaylistTableLoading(message = "正在加载歌单…") {
  const tbody = document.querySelector("#playlist-detail-table tbody");
  if (!tbody) return;
  tbody.innerHTML = `
    <tr class="search-table__loading">
      <td colspan="5">
        <div class="search-table-loading" role="status" aria-live="polite" aria-label="${message}">
          <div class="search-table-loading__bars" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
          </div>
          <p>${message}</p>
        </div>
      </td>
    </tr>`;
}

export function renderSidebarPlaylistLoading(message = "正在同步歌单…") {
  const list = document.getElementById("sidebar-playlist-list");
  if (!list) return;
  list.innerHTML = `<li class="sidebar-pl-empty muted">${message}</li>`;
}
