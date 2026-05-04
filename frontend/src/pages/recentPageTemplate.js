// Recent page is a thin table container for playback history.
export function recentPageTemplate() {
  return `
    <section class="page" data-page="recent">
      <h1 class="page-title">最近播放</h1>
      <div class="table-wrap">
        <table class="search-table" id="recent-plays-table">
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
