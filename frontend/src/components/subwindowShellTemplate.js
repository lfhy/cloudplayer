// Subwindow shell markup keeps compact child-window chrome reusable across modal-like surfaces.
export function subwindowShellTemplate({ titleId, title, subtitle = "", bodyClass = "", content = "" } = {}) {
  return `
    <section class="subwindow-shell" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <header class="subwindow-shell__titlebar">
        <div class="subwindow-shell__traffic">
          <button type="button" class="subwindow-shell__traffic-dot subwindow-shell__traffic-dot--close" data-subwindow-dismiss aria-label="关闭窗口"></button>
          <span class="subwindow-shell__traffic-dot subwindow-shell__traffic-dot--min" aria-hidden="true"></span>
          <span class="subwindow-shell__traffic-dot subwindow-shell__traffic-dot--max" aria-hidden="true"></span>
        </div>
        <div class="subwindow-shell__titlewrap">
          <p class="subwindow-shell__subtitle">${subtitle}</p>
          <h3 id="${titleId}" class="subwindow-shell__title">${title}</h3>
        </div>
        <button type="button" class="subwindow-shell__dismiss" data-subwindow-dismiss aria-label="关闭窗口">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7 7l10 10M17 7L7 17"></path>
          </svg>
        </button>
      </header>
      <div class="subwindow-shell__body ${bodyClass}">${content}</div>
    </section>
  `;
}
