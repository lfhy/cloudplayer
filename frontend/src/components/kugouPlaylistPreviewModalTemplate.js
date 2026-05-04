// Kugou playlist preview modal keeps long track lists out of the import card grid.
export function kugouPlaylistPreviewModalTemplate() {
  return `
    <div id="kugou-preview-modal" class="modal-overlay" hidden aria-hidden="true">
      <div class="modal-dialog modal-dialog--kugou-preview" role="dialog" aria-modal="true" aria-labelledby="kugou-preview-title">
        <header class="modal-copy modal-copy--kugou-preview">
          <div>
            <h3 id="kugou-preview-title" class="modal-title">歌单预览</h3>
            <p id="kugou-preview-subtitle" class="muted"></p>
          </div>
          <button type="button" class="modal-close" id="btn-kugou-preview-close" aria-label="关闭歌单预览">×</button>
        </header>
        <section id="kugou-preview-body" class="kugou-preview-modal__body"></section>
        <footer class="kugou-preview-modal__footer">
          <button type="button" class="modal-cancel" id="btn-kugou-preview-cancel">关闭</button>
          <button type="button" class="btn-accent" id="btn-kugou-preview-import">直接导入这个歌单</button>
        </footer>
      </div>
    </div>
  `;
}
