// Daily page only owns the recommendation table shell.
export function dailyPageTemplate() {
  return `
    <section class="page" data-page="daily">
      <div class="page-heading">
        <div>
          <h1 class="page-title">每日推荐</h1>
          <p class="page-hint">根据最近播放生成一份今日歌单。每天顺序会变化，方便你重新发现常听内容。</p>
        </div>
        <button type="button" id="btn-refresh-daily" class="btn-outline">重新生成</button>
      </div>
      <div class="table-wrap">
        <table class="search-table" id="daily-table">
          <thead>
            <tr>
              <th class="col-idx">#</th>
              <th>标题</th>
              <th>艺术家</th>
              <th class="col-src">来源</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;
}
