// Playlist manage modal hosts create, rename and delete flows in one reusable shell.
export function playlistManageModalTemplate() {
  return `
    <div id="playlist-manage-modal" class="modal-overlay" hidden aria-hidden="true">
      <div class="modal-dialog modal-dialog--playlist-manage" role="dialog" aria-modal="true" aria-labelledby="playlist-manage-title">
        <header class="modal-copy modal-copy--playlist-manage">
          <div>
            <h3 id="playlist-manage-title" class="modal-title">新建歌单</h3>
            <p id="playlist-manage-subtitle" class="muted"></p>
          </div>
          <button type="button" class="modal-close" id="btn-playlist-manage-close" aria-label="关闭歌单操作">×</button>
        </header>
        <section class="playlist-manage-modal__body">
          <label id="playlist-manage-input-wrap" class="playlist-manage-modal__field">
            <span>歌单名称</span>
            <input id="playlist-manage-input" class="import-name-field" type="text" maxlength="80" placeholder="输入歌单名称" />
          </label>
          <div id="playlist-manage-delete-copy" class="playlist-manage-modal__delete-copy" hidden></div>
          <p id="playlist-manage-status" class="playlist-manage-modal__status muted" aria-live="polite"></p>
        </section>
        <footer class="playlist-manage-modal__footer">
          <button type="button" class="modal-cancel" id="btn-playlist-manage-cancel">取消</button>
          <button type="button" class="btn-accent" id="btn-playlist-manage-confirm">确认</button>
        </footer>
      </div>
    </div>
  `;
}
