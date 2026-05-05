// Queue panel stays outside page templates because it is shared by all pages.
export function queuePanelTemplate() {
  return `
    <div id="queue-panel" class="queue-panel collapsed" aria-hidden="true">
      <div class="queue-header">
        <div class="queue-header__meta">
          <span class="queue-header__title">播放队列</span>
          <span id="queue-count" class="queue-header__count">0 首</span>
        </div>
        <button type="button" id="queue-toggle" class="queue-toggle" aria-expanded="false">展开</button>
      </div>
      <div id="queue-body" class="queue-body">
        <ul id="queue-list" class="queue-list"></ul>
      </div>
    </div>
  `;
}
