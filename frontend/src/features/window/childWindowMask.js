import { Events } from "@wailsio/runtime";

function maskEl() {
  return document.getElementById("child-window-mask");
}

const blockingWindowLabels = new Set([
  "close-confirm",
  "online-mode-confirm",
  "message-dialog",
  "database-repair",
]);

function applyMaskState(active) {
  const el = maskEl();
  if (!el) return;
  el.hidden = !active;
  el.setAttribute("aria-hidden", active ? "false" : "true");
  el.classList.toggle("is-active", active);
}

// Blocking child windows should temporarily lock the main shell so users cannot keep clicking conflicting actions underneath.
export function wireChildWindowMask() {
  const el = maskEl();
  if (!el) return () => {};
  const activeLabels = new Set();
  const sync = () => applyMaskState(activeLabels.size > 0);
  sync();

  const offVisibility = Events.On("wails:window:visibility", (event) => {
    const label = String(event?.data?.name || "").trim();
    if (!blockingWindowLabels.has(label)) return;
    if (event?.data?.visible === true) {
      activeLabels.add(label);
    } else {
      activeLabels.delete(label);
    }
    sync();
  });

  const offClosing = Events.On("wails:window:closing", (event) => {
    const label = String(event?.data?.name || "").trim();
    if (!blockingWindowLabels.has(label)) return;
    activeLabels.delete(label);
    sync();
  });

  el.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  return () => {
    offVisibility?.();
    offClosing?.();
    activeLabels.clear();
    applyMaskState(false);
  };
}
