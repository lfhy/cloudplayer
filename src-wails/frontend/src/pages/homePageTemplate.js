// Home page keeps the original entry actions and summary cards intact.
export function homePageTemplate() {
  return `
    <section class="page page-active" data-page="home">
      <div class="home-hero">
        <div class="home-hero__copy">
          <p class="home-eyebrow">CloudPlayer</p>
          <h1 class="home-title">把搜索、导入和播放都收进一个桌面音乐空间。</h1>
          <p class="home-subtitle">从音乐首页开始，继续上次播放、进入每日推荐，或者导入一个新的歌单。</p>
          <div class="home-actions">
            <button type="button" id="btn-home-search" class="btn-accent">去搜索页</button>
            <button type="button" id="btn-home-import" class="btn-outline">导入歌单</button>
          </div>
        </div>
        <div class="home-hero__panel">
          <div class="home-stat">
            <span class="home-stat__label">我的歌单</span>
            <strong id="home-playlist-count" class="home-stat__value">0</strong>
          </div>
          <div class="home-stat">
            <span class="home-stat__label">最近播放</span>
            <strong id="home-recent-count" class="home-stat__value">0</strong>
          </div>
          <div class="home-stat">
            <span class="home-stat__label">下载任务</span>
            <strong id="home-download-count" class="home-stat__value">0</strong>
          </div>
        </div>
      </div>
      <div class="home-grid">
        <section class="home-card">
          <div class="home-card__head">
            <h2>继续收听</h2>
            <button type="button" id="btn-home-open-recent" class="text-action">查看全部</button>
          </div>
          <div id="home-recent-list" class="home-list"></div>
        </section>
        <section class="home-card">
          <div class="home-card__head">
            <h2>今日推荐</h2>
            <button type="button" id="btn-home-open-daily" class="text-action">打开页面</button>
          </div>
          <div id="home-daily-list" class="home-list"></div>
        </section>
      </div>
    </section>
  `;
}
