import { kugouImportPanelTemplate } from "./import/kugouPanelTemplate.js";

// Import page keeps the three-step flow markup but moves it out of index.html.
export function importPageTemplate() {
  return `
    <section class="page" data-page="import">
      <div class="page-heading">
        <div>
          <h1 class="page-title">导入歌单</h1>
          <p class="page-hint">先选择导入方式，再填写对应参数。完成后可以先保存歌单，避免列表丢失。</p>
        </div>
      </div>
      <div class="import-shell">
        <nav class="import-progress" aria-label="导入步骤">
          <button type="button" class="import-progress__step" data-import-step-nav="choose"><span class="import-progress__index">1</span><span class="import-progress__meta"><strong>选择方式</strong><span>本地 / 链接 / 文本</span></span></button>
          <span class="import-progress__line" aria-hidden="true"></span>
          <button type="button" class="import-progress__step" data-import-step-nav="config"><span class="import-progress__index">2</span><span class="import-progress__meta"><strong>配置参数</strong><span>填写并执行导入</span></span></button>
          <span class="import-progress__line" aria-hidden="true"></span>
          <button type="button" class="import-progress__step" data-import-step-nav="result"><span class="import-progress__index">3</span><span class="import-progress__meta"><strong>整理保存</strong><span>确认列表并保存歌单</span></span></button>
        </nav>
        <section class="import-stage import-stage--chooser" id="import-method-stage">
          <div class="import-stage__intro">
            <p class="import-stage__eyebrow">步骤 1</p>
            <h2>选择导入方式</h2>
            <p>你可以从本地目录扫描、解析分享链接、同步酷狗歌单，或者直接粘贴文本列表。</p>
          </div>
          <div class="import-method-grid">
            <button type="button" class="import-method-card" data-import-method="local"><span class="import-method-card__icon" aria-hidden="true"></span><span class="import-method-card__title">导入本地目录</span><span class="import-method-card__desc">扫描一个音乐文件夹，把结果带入歌单草稿。</span></button>
            <button type="button" class="import-method-card" data-import-method="share"><span class="import-method-card__icon" aria-hidden="true"></span><span class="import-method-card__title">分享链接导入</span><span class="import-method-card__desc">支持网易云和 QQ 音乐歌单分享链接。</span></button>
            <button type="button" class="import-method-card" data-import-method="kugou"><span class="import-method-card__icon" aria-hidden="true"></span><span class="import-method-card__title">导入酷狗歌单</span><span class="import-method-card__desc">登录酷狗 Lite 后，可勾选一个或多个歌单直接导入。</span></button>
            <button type="button" class="import-method-card" data-import-method="text"><span class="import-method-card__icon" aria-hidden="true"></span><span class="import-method-card__title">粘贴文本导入</span><span class="import-method-card__desc">适合从聊天记录、TXT、CSV 或 JSON 中整理歌单。</span></button>
          </div>
        </section>
        <section class="import-stage import-stage--config" id="import-config-stage" hidden>
          <div class="import-stage__head">
            <div><p class="import-stage__eyebrow">步骤 2</p><h2 id="import-config-title">配置导入参数</h2><p id="import-config-desc" class="muted"></p></div>
            <button type="button" id="btn-import-back" class="import-back-button" data-import-back-button><span class="import-back-button__icon" aria-hidden="true"></span><span>上一步</span></button>
          </div>
          <div id="import-panel-local" class="import-panel" hidden>
            <h3>选择本地音乐目录</h3>
            <p class="muted">扫描完成后会把歌曲标题、歌手和文件路径整理到导入草稿。</p>
            <div class="local-lib-toolbar"><button type="button" id="btn-scan-library-folder" class="btn-accent">选择文件夹并扫描</button><span id="local-library-status" class="muted" aria-live="polite"></span></div>
          </div>
          <div id="import-panel-share" class="import-panel" hidden>
            <h3>粘贴歌单分享链接</h3>
            <div class="import-share-row">
              <input id="import-share-url" type="url" class="import-link-input" placeholder="music.163.com / y.qq.com / c6.y.qq.com …" autocomplete="off" />
              <button type="button" id="btn-import-share" class="btn-accent">解析链接</button>
            </div>
            <div class="import-share-cookie-row" hidden>
              <label><input type="checkbox" id="opt-netease-cookie-enabled" /> 网易云 Cookie 登录态请求（可选）</label>
              <input id="opt-netease-cookie" type="text" class="import-link-input" placeholder="MUSIC_U=...; __csrf=...（仅本机保存到 settings.json）" autocomplete="off" />
            </div>
            <p id="import-share-status" class="import-share-status muted" aria-live="polite"></p>
          </div>
          ${kugouImportPanelTemplate()}
          <div id="import-panel-text" class="import-panel" hidden>
            <h3>粘贴文本列表</h3>
            <div class="import-toolbar">
              <label class="import-label">格式</label>
              <select id="import-fmt" class="import-select"><option value="auto">自动检测</option><option value="text">纯文本</option><option value="csv">CSV</option><option value="json">JSON</option></select>
              <button type="button" id="btn-import-parse" class="btn-accent">解析文本</button>
            </div>
            <textarea id="import-text" class="import-textarea" rows="10" placeholder="示例：&#10;晴天 - 周杰伦&#10;七里香 - 周杰伦"></textarea>
          </div>
        </section>
        <section class="import-stage import-stage--result" id="import-result-stage" hidden>
          <div class="import-stage__head">
            <div><p class="import-stage__eyebrow">步骤 3</p><h2>整理结果并保存歌单</h2><p class="muted">如果列表已经出来，建议先保存为歌单，避免切页或误操作丢失数据。</p></div>
            <button type="button" id="btn-import-result-back" class="import-back-button" data-import-back-button><span class="import-back-button__icon" aria-hidden="true"></span><span>上一步</span></button>
          </div>
          <div class="import-save-bar">
            <label class="import-name-field"><span>歌单名称</span><input id="import-playlist-name" type="text" class="import-link-input" placeholder="例如：深夜循环 / 通勤歌单" /></label>
            <div class="import-actions">
              <button type="button" id="btn-import-export-txt" disabled>导出为 TXT</button>
              <button type="button" id="btn-import-export-csv" disabled>导出为 CSV</button>
              <button type="button" id="btn-import-save-new" class="btn-accent" disabled>保存新歌单</button>
              <div class="import-merge"><label for="import-merge-playlist">合并到已有歌单</label><select id="import-merge-playlist" class="import-select import-select--wide"></select><button type="button" id="btn-import-merge" disabled>合并</button></div>
            </div>
          </div>
          <p class="import-merge-hint muted" id="import-result-hint">导入完成后会自动打开歌单详情页，你可以继续对歌单重命名。</p>
          <div class="table-wrap import-table-wrap">
            <table class="search-table import-table" id="import-table">
              <thead><tr><th class="col-idx">#</th><th>歌名</th><th>歌手</th><th>专辑</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  `;
}
