// Recent page is a thin table container for playback history.
export function recentPageTemplate() {
  return `
    <section class="page" data-page="recent">
      <div class="page-heading">
        <div>
          <h1 class="page-title">最近播放</h1>
          <p class="page-hint">复用每日推荐的曲目列表样式，直接展示封面并支持点按继续加入播放队列。</p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="search-table" id="recent-plays-table">
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
