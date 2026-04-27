// Download page stays isolated so future task controls can evolve independently.
export function downloadPageTemplate() {
  return `
    <section class="page" data-page="download">
      <div class="page-heading">
        <div>
          <h1 class="page-title">下载管理</h1>
          <p class="page-hint">在搜索结果、歌单和推荐页里把歌曲加入下载后，会统一出现在这里。</p>
        </div>
        <div class="download-toolbar">
          <button type="button" id="btn-pick-download-folder" class="btn-accent">下载保存目录…</button>
          <span id="download-folder-hint" class="muted"></span>
        </div>
      </div>
      <div class="table-wrap">
        <table class="search-table" id="download-queue-table">
          <thead>
            <tr>
              <th>状态</th>
              <th>标题</th>
              <th>音质</th>
              <th class="col-dlprog">进度</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;
}
