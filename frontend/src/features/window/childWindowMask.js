import { listen } from "../../wails/tauri-event.js";

const MASKED_CHILD_WINDOWS = new Set(["account-center", "close-confirm", "online-mode-confirm", "message-dialog"]);

function maskEl() {
  return document.getElementById("child-window-mask");
}

function setChildWindowMaskVisible(visible) {
  const el = maskEl();
  if (!el) return;
  el.hidden = !visible;
  el.setAttribute("aria-hidden", visible ? "false" : "true");
}

// Main-window mask only follows modal-style child windows and excludes utility windows like desktop lyrics.
export function wireChildWindowMask() {
  const visibleLabels = new Set();
  setChildWindowMaskVisible(false);
  return listen("wails:window:visibility", (event) => {
    const label = String(event?.payload?.name || "").trim();
    if (!MASKED_CHILD_WINDOWS.has(label)) return;
    if (event?.payload?.visible === true) visibleLabels.add(label);
    else visibleLabels.delete(label);
    setChildWindowMaskVisible(visibleLabels.size > 0);
  });
}
