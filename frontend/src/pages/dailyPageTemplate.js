// Daily page only owns the recommendation table shell.
export function dailyPageTemplate() {
  return `
    <section class="page" data-page="daily">
      <div class="page-heading">
        <div>
          <h1 class="page-title">每日推荐</h1>
          <p class="page-hint">每天自动从在线源获取每日推荐歌曲，应用重启后依然保留。点击重新生成可刷新。</p>
        </div>
        <div class="page-heading__actions">
          <button type="button" id="btn-play-daily-all" class="btn-accent">▶ 播放全部</button>
          <button type="button" id="btn-save-daily-playlist" class="btn-outline">保存为歌单</button>
          <button type="button" id="btn-refresh-daily" class="btn-outline">重新生成</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="search-table" id="daily-table">
          <thead>
            <tr>
              <th class="col-cover"></th>
              <th>标题</th>
              <th>专辑</th>
              <th class="col-like">喜欢</th>
              <th class="col-dur">时长</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;
}
