// Home page uses a clean layout with daily picks and recent plays side by side.
export function homePageTemplate() {
  return `
    <section class="page page-active home-page" data-page="home">
      <header class="home-header">
        <div class="home-header__greeting">
          <p class="home-header__eyebrow">CloudPlayer</p>
          <h1 class="home-header__title" id="home-greeting">你好</h1>
          <p class="home-header__sub" id="home-date-line"></p>
        </div>
        <div class="home-header__stats">
          <span class="home-stat-pill">歌单 <strong id="home-playlist-count">0</strong></span>
          <span class="home-stat-pill">播放记录 <strong id="home-recent-count">0</strong></span>
          <span class="home-stat-pill">下载中 <strong id="home-download-count">0</strong></span>
        </div>
        <div class="home-header__actions">
          <button type="button" id="btn-home-search" class="home-btn home-btn--primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            搜索
          </button>
          <button type="button" id="btn-home-import" class="home-btn home-btn--ghost">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            导入歌单
          </button>
        </div>
      </header>
      <div class="home-columns">
        <section class="home-col">
          <div class="home-col-head">
            <div>
              <p class="home-section-eyebrow">每日推荐</p>
              <h2 class="home-section-title">今天听这些</h2>
            </div>
            <button type="button" id="btn-home-open-daily" class="home-btn home-btn--ghost">查看全部</button>
          </div>
          <div id="home-daily-grid" class="home-col__list"></div>
        </section>
        <section class="home-col">
          <div class="home-col-head">
            <div>
              <p class="home-section-eyebrow">继续收听</p>
              <h2 class="home-section-title">最近播放</h2>
            </div>
            <button type="button" id="btn-home-open-recent" class="home-btn home-btn--ghost">查看全部</button>
          </div>
          <div id="home-recent-row" class="home-col__list"></div>
        </section>
      </div>
    </section>
  `;
}
