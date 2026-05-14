import { Window as RuntimeWindow } from "@wailsio/runtime";

// Shared Windows chrome keeps frameless titlebars and controls consistent across the main shell and child windows.
const ICONS = {
  close: `
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M2.25 2.25 9.75 9.75"></path>
      <path d="M9.75 2.25 2.25 9.75"></path>
    </svg>
  `,
  maximize: `
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <rect x="2.2" y="2.2" width="7.6" height="7.6" rx="0.8"></rect>
    </svg>
  `,
  minimize: `
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M2.2 6.15h7.6"></path>
    </svg>
  `,
  restore: `
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M4.25 2.25h5.5v5.5"></path>
      <path d="M7.75 4.25h-5.5v5.5h5.5"></path>
    </svg>
  `,
};

function renderControl(action, disabled = false) {
  const labels = {
    close: "Close",
    maximize: disabled ? "Maximize unavailable" : "Maximize",
    minimize: "Minimize",
  };
  const extraClass = action === "close" ? " app-window-control--close" : "";
  const disabledAttr = disabled ? " disabled aria-disabled=\"true\"" : "";
  return `
    <button
      type="button"
      class="app-window-control${extraClass}"
      data-window-action="${action}"${disabledAttr}
      aria-label="${labels[action]}"
      title="${labels[action]}"
    >${ICONS[action]}</button>
  `;
}

export function windowControlsTemplate({ allowMaximize = true } = {}) {
  return `
    <div class="app-window-controls" aria-label="Window controls">
      ${renderControl("minimize")}
      ${renderControl("maximize", !allowMaximize)}
      ${renderControl("close")}
    </div>
  `;
}

export function windowTitlebarTemplate({
  title = "",
  lead = "",
  allowMaximize = true,
  className = "",
} = {}) {
  const titleText = String(title || "").trim() || "CloudPlayer";
  const leadText = String(lead || "").trim();
  const leadMarkup = leadText ? `<span class="app-titlebar__lead-copy">${leadText}</span>` : "";
  const classes = ["app-titlebar", className].filter(Boolean).join(" ");
  return `
    <header class="${classes}" data-window-drag>
      <div class="app-titlebar__lead">${leadMarkup}</div>
      <div class="app-titlebar__title">${titleText}</div>
      ${windowControlsTemplate({ allowMaximize })}
    </header>
  `;
}

function buttonFor(scope, action) {
  return scope.querySelector(`[data-window-action="${action}"]`);
}

export function wireWindowChrome({ windowName = "main", allowMaximize = true, scope = document } = {}) {
  const targetWindow = RuntimeWindow.Get(windowName);
  const minimizeBtn = buttonFor(scope, "minimize");
  const maximizeBtn = buttonFor(scope, "maximize");
  const closeBtn = buttonFor(scope, "close");
  const dragRegion = scope.querySelector("[data-window-drag]");

  async function syncMaximizeButton() {
    if (!maximizeBtn) return;
    if (!allowMaximize || maximizeBtn.disabled) {
      maximizeBtn.innerHTML = ICONS.maximize;
      return;
    }
    let maximized = false;
    try {
      maximized = await targetWindow.IsMaximised();
    } catch (error) {
      console.warn(`query ${windowName} maximized state`, error);
    }
    maximizeBtn.innerHTML = maximized ? ICONS.restore : ICONS.maximize;
    const title = maximized ? "Restore" : "Maximize";
    maximizeBtn.title = title;
    maximizeBtn.setAttribute("aria-label", title);
    maximizeBtn.dataset.windowMaximized = maximized ? "true" : "false";
  }

  async function toggleMaximize() {
    if (!allowMaximize || maximizeBtn?.disabled) return;
    try {
      if (await targetWindow.IsMaximised()) {
        await targetWindow.Restore();
      } else {
        await targetWindow.Maximise();
      }
    } catch (error) {
      console.warn(`toggle ${windowName} maximize`, error);
    } finally {
      window.setTimeout(() => void syncMaximizeButton(), 0);
    }
  }

  minimizeBtn?.addEventListener("click", () => {
    void targetWindow.Minimise().catch((error) => console.warn(`minimize ${windowName}`, error));
  });
  maximizeBtn?.addEventListener("click", () => {
    void toggleMaximize();
  });
  closeBtn?.addEventListener("click", () => {
    void targetWindow.Close().catch((error) => console.warn(`close ${windowName}`, error));
  });
  dragRegion?.addEventListener("dblclick", (event) => {
    if (!allowMaximize) return;
    if (event.target instanceof Element && event.target.closest(".app-window-controls")) return;
    void toggleMaximize();
  });

  void syncMaximizeButton();
  window.addEventListener("resize", () => {
    void syncMaximizeButton();
  });
}
