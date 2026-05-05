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
  let dailyRecommendationDate = "";
  let midnightRefreshTimer = null;

  function logDailyFlow(stage, detail = {}) {
    console.info("[daily]", stage, {
      cachedDate: dailyRecommendationDate,
      cachedCount: dailyRecommendationRows.length,
      ...detail,
    });
  }

  function getLocalDailyRecommendations() {
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
    return dedup
      .map((item, index) => ({ item, score: Number(daySeed) % (index + 7) }))
      .sort((a, b) => a.score - b.score)
      .map((entry) => entry.item)
      .slice(0, 24);
  }

  async function ensureDailyRecommendations(force = false) {
    const today = new Date().toISOString().slice(0, 10);
    logDailyFlow("ensure:start", { force, today });
    void invoke("log_frontend_debug", {
      scope: "daily",
      stage: "ensure:start",
      detail: JSON.stringify({ force, today, cachedDate: dailyRecommendationDate, cachedCount: dailyRecommendationRows.length }),
    }).catch(() => {});
    if (!force && dailyRecommendationDate === today && dailyRecommendationRows.length) {
      logDailyFlow("ensure:memory-cache-hit", { today });
      void invoke("log_frontend_debug", {
        scope: "daily",
        stage: "ensure:memory-cache-hit",
        detail: JSON.stringify({ today, cachedCount: dailyRecommendationRows.length }),
      }).catch(() => {});
      return dailyRecommendationRows;
    }
    try {
      const payload = await invoke("get_daily_recommendation", { force: !!force });
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      logDailyFlow("ensure:backend-response", {
        force,
        today,
        source: payload?.source || "unknown",
        responseCount: rows.length,
        responseDate: payload?.date || "",
      });
      void invoke("log_frontend_debug", {
        scope: "daily",
        stage: "ensure:backend-response",
        detail: JSON.stringify({
          force,
          today,
          source: payload?.source || "unknown",
          responseCount: rows.length,
          responseDate: payload?.date || "",
        }),
      }).catch(() => {});
      if (rows.length) {
        dailyRecommendationRows = rows.map((item) => ({
          title: item.title || "",
          artist: item.artist || "",
          album: item.album || "",
          duration_ms: item.duration_ms || 0,
          cover_url: item.cover_url || "",
          source_id: item.source_id || "",
        }));
        dailyRecommendationDate = payload?.date || today;
        logDailyFlow("ensure:backend-applied", { source: payload?.source || "unknown", appliedCount: dailyRecommendationRows.length });
        void invoke("log_frontend_debug", {
          scope: "daily",
          stage: "ensure:backend-applied",
          detail: JSON.stringify({ source: payload?.source || "unknown", appliedCount: dailyRecommendationRows.length }),
        }).catch(() => {});
        return dailyRecommendationRows;
      }
    } catch (err) {
      console.warn("get_daily_recommendation failed:", err);
      void invoke("log_frontend_debug", {
        scope: "daily",
        stage: "ensure:failed",
        detail: JSON.stringify({ force, today, message: String(err?.message || err) }),
      }).catch(() => {});
    }
    logDailyFlow("ensure:fallback-local", { force, today, recentCount: getSessionRecentPlays().length });
    void invoke("log_frontend_debug", {
      scope: "daily",
      stage: "ensure:fallback-local",
      detail: JSON.stringify({ force, today, recentCount: getSessionRecentPlays().length }),
    }).catch(() => {});
    dailyRecommendationRows = getLocalDailyRecommendations();
    dailyRecommendationDate = today;
    logDailyFlow("ensure:fallback-applied", { appliedCount: dailyRecommendationRows.length });
    void invoke("log_frontend_debug", {
      scope: "daily",
      stage: "ensure:fallback-applied",
      detail: JSON.stringify({ appliedCount: dailyRecommendationRows.length }),
    }).catch(() => {});
    return dailyRecommendationRows;
  }

  function scheduleMidnightRefresh(render) {
    if (midnightRefreshTimer) clearTimeout(midnightRefreshTimer);
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    midnightRefreshTimer = window.setTimeout(() => {
      dailyRecommendationDate = "";
      dailyRecommendationRows = [];
      void ensureDailyRecommendations(true).then(() => render()).finally(() => scheduleMidnightRefresh(render));
    }, Math.max(1000, next.getTime() - now.getTime()));
  }

  function createListRow(item, index, mode) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "home-row-item";
    const cover = coverImgHtml({ src: item.cover_url || "", className: "home-row-item__cover", width: 44, height: 44, radius: 10, alt: item.title || "" });
    const artist = item.artist || (item.local_path ? "本地音乐" : "在线曲目");
    button.innerHTML = `
      <span class="home-row-item__idx">${index + 1}</span>
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

  async function renderHomePage() {
    const playlistCountEl = document.getElementById("home-playlist-count");
    const recentCountEl = document.getElementById("home-recent-count");
    const downloadCountEl = document.getElementById("home-download-count");
    const recentList = document.getElementById("home-recent-row");
    const dailyList = document.getElementById("home-daily-grid");
    const greetingEl = document.getElementById("home-greeting");
    const dateLineEl = document.getElementById("home-date-line");
    const recentRows = getSessionRecentPlays();
    const recommendations = await ensureDailyRecommendations();
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
    scheduleMidnightRefresh(renderHomePage);
  }

  async function renderDailyTable(force = false) {
    const tbody = document.querySelector("#daily-table tbody");
    if (!tbody) return;
    logDailyFlow("render-table:start", { force });
    void invoke("log_frontend_debug", {
      scope: "daily",
      stage: "render-table:start",
      detail: JSON.stringify({ force }),
    }).catch(() => {});
    const rows = await ensureDailyRecommendations(force);
    logDailyFlow("render-table:rows-ready", { force, rowCount: rows.length });
    void invoke("log_frontend_debug", {
      scope: "daily",
      stage: "render-table:rows-ready",
      detail: JSON.stringify({ force, rowCount: rows.length }),
    }).catch(() => {});
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
