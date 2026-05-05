// Home controller keeps landing-page recommendations and recents outside main.js.
import { coverImgHtml } from "../../app/helpers/covers.js";

export function createHomeController(deps) {
  const {
    escapeHtml,
    getDownloadTaskCount,
    getSessionRecentPlays,
    invoke,
    playFromRecentRow,
    playSingleItem,
  } = deps;
  let dailyRecommendationRows = [];

  function getDailyRecommendations() {
    const base = getSessionRecentPlays().filter((item) => !!(item?.title || "").trim());
    const dedup = [];
    const seen = new Set();
    for (const item of base) {
      const key = `${(item.title || "").trim()}::${(item.artist || "").trim()}::${item.local_path ? "local" : (item.source_id || "").trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(item);
    }
    const daySeed = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    dailyRecommendationRows = dedup
      .map((item, index) => ({ item, score: Number(daySeed) % (index + 7) }))
      .sort((a, b) => a.score - b.score)
      .map((entry) => entry.item)
      .slice(0, 24);
    return dailyRecommendationRows;
  }

  function createListRow(item, index, mode) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "home-row-item";
    const cover = coverImgHtml({ src: item.cover_url || "", className: "home-row-item__cover", width: 44, height: 44, radius: 10, alt: item.title || "" });
    const artist = item.artist || (item.local_path ? "本地音乐" : "在线曲目");
    button.innerHTML = `
      <span class="home-row-item__idx">${mode === "daily" ? index + 1 : index + 1}</span>
      ${cover}
      <span class="home-row-item__info">
        <strong>${escapeHtml(item.title || "—")}</strong>
        <span>${escapeHtml(artist)}</span>
      </span>`;
    button.addEventListener("click", () => {
      if (mode === "daily") playSingleItem(item);
      else playFromRecentRow(index);
    });
    return button;
  }

  function renderHomePage() {
    const playlistCountEl = document.getElementById("home-playlist-count");
    const recentCountEl = document.getElementById("home-recent-count");
    const downloadCountEl = document.getElementById("home-download-count");
    const recentList = document.getElementById("home-recent-row");
    const dailyList = document.getElementById("home-daily-grid");
    const greetingEl = document.getElementById("home-greeting");
    const dateLineEl = document.getElementById("home-date-line");
    const recentRows = getSessionRecentPlays();
    const recommendations = getDailyRecommendations();
    const hour = new Date().getHours();
    if (greetingEl) greetingEl.textContent = hour < 11 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
    if (dateLineEl) dateLineEl.textContent = `${new Date().toLocaleDateString("zh-CN", { weekday: "long", month: "long", day: "numeric" })} · ${recentRows.length ? `共 ${recentRows.length} 首播放记录` : "先开始听几首歌吧"}`;
    if (recentCountEl) recentCountEl.textContent = String(recentRows.length);
    if (downloadCountEl) downloadCountEl.textContent = String(getDownloadTaskCount());
    if (dailyList) {
      dailyList.innerHTML = "";
      if (!recommendations.length) {
        dailyList.innerHTML = '<p class="home-empty muted">需要一些播放记录后才会生成每日推荐。</p>';
      } else {
        recommendations.slice(0, 10).forEach((item, index) => dailyList.appendChild(createListRow(item, index, "daily")));
      }
    }
    if (recentList) {
      recentList.innerHTML = "";
      if (!recentRows.length) {
        recentList.innerHTML = '<p class="home-empty muted">还没有最近播放，去搜索或导入歌单开始吧。</p>';
      } else {
        recentRows.slice(0, 10).forEach((item, index) => recentList.appendChild(createListRow(item, index, "recent")));
      }
    }
    void invoke("list_playlists")
      .then((playlists) => {
        if (playlistCountEl) playlistCountEl.textContent = String(Array.isArray(playlists) ? playlists.length : 0);
      })
      .catch(() => {
        if (playlistCountEl) playlistCountEl.textContent = "0";
      });
  }

  function renderDailyTable() {
    const tbody = document.querySelector("#daily-table tbody");
    if (!tbody) return;
    const rows = getDailyRecommendations();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">最近播放还不够，先听几首歌再回来生成每日推荐。</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    rows.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${index + 1}</td><td>${escapeHtml(item.title || "—")}</td><td>${escapeHtml(item.artist || "—")}</td><td>${escapeHtml(item.local_path ? "本地" : "在线")}</td>`;
      tr.addEventListener("dblclick", () => playSingleItem(item));
      tbody.appendChild(tr);
    });
  }

  return { renderDailyTable, renderHomePage };
}
