// Queue panel stays outside page templates because it is shared by all pages.
export function queuePanelTemplate() {
  return `
    <div id="queue-panel" class="queue-panel collapsed">
      <div class="queue-header">
        <span>播放队列</span>
        <button type="button" id="queue-toggle" class="queue-toggle">收起</button>
      </div>
      <div id="queue-body" class="queue-body">
        <ul id="queue-list" class="queue-list"></ul>
      </div>
    </div>
  `;
}
