// Home controller keeps recommendations and landing-page summaries outside main.js.
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

  function renderHomePage() {
    const playlistCountEl = document.getElementById("home-playlist-count");
    const recentCountEl = document.getElementById("home-recent-count");
    const downloadCountEl = document.getElementById("home-download-count");
    const recentList = document.getElementById("home-recent-list");
    const dailyList = document.getElementById("home-daily-list");
    const recentRows = getSessionRecentPlays();
    const recommendations = getDailyRecommendations();
    if (recentCountEl) recentCountEl.textContent = String(recentRows.length);
    if (downloadCountEl) downloadCountEl.textContent = String(getDownloadTaskCount());
    if (recentList) {
      recentList.innerHTML = "";
      if (!recentRows.length) {
        recentList.innerHTML = '<p class="home-list__empty muted">还没有最近播放。去搜索或导入一张歌单开始吧。</p>';
      } else {
        recentRows.slice(0, 4).forEach((item, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "home-list__item";
          button.innerHTML = `<span class="home-list__index">${index + 1}</span><span class="home-list__meta"><strong>${escapeHtml(item.title || "—")}</strong><span>${escapeHtml(item.artist || (item.local_path ? "本地音乐" : "在线曲目"))}</span></span>`;
          button.addEventListener("click", () => playFromRecentRow(index));
          recentList.appendChild(button);
        });
      }
    }
    if (dailyList) {
      dailyList.innerHTML = "";
      if (!recommendations.length) {
        dailyList.innerHTML = '<p class="home-list__empty muted">需要一些最近播放记录后，主页才会生成今日推荐。</p>';
      } else {
        recommendations.slice(0, 4).forEach((item) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "home-list__item";
          button.innerHTML = `<span class="home-list__badge">推荐</span><span class="home-list__meta"><strong>${escapeHtml(item.title || "—")}</strong><span>${escapeHtml(item.artist || (item.local_path ? "本地音乐" : "在线曲目"))}</span></span>`;
          button.addEventListener("click", () => playSingleItem(item));
          dailyList.appendChild(button);
        });
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
