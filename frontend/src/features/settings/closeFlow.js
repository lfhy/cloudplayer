// Close-flow helpers keep modal state and quit/minimize branching out of the main settings controller.
export function openCloseConfirmModalDom() {
  const rememberEl = document.getElementById("close-choice-remember");
  if (rememberEl) rememberEl.checked = false;
  const modalEl = document.getElementById("close-confirm-modal");
  if (!modalEl) return;
  modalEl.hidden = false;
  modalEl.setAttribute("aria-hidden", "false");
  queueMicrotask(() => document.getElementById("close-choice-tray")?.focus());
}

export function closeCloseConfirmModalDom() {
  const modalEl = document.getElementById("close-confirm-modal");
  if (!modalEl) return;
  modalEl.hidden = true;
  modalEl.setAttribute("aria-hidden", "true");
}

export async function runCloseChoiceFlow(mode, deps) {
  const { alertRequestFailed, invoke, setMainWindowCloseAction } = deps;
  const remember = !!document.getElementById("close-choice-remember")?.checked;
  closeCloseConfirmModalDom();
  if (remember) {
    const patch = { main_window_close_action: mode === "tray" ? "tray" : "quit" };
    try {
      await invoke("save_settings", { patch });
      setMainWindowCloseAction(patch.main_window_close_action);
    } catch (error) {
      console.warn("save_settings main_window_close_action", error);
    }
  }
  try {
    if (mode === "tray") await invoke("hide_main_window");
    else await invoke("quit_app");
  } catch (error) {
    alertRequestFailed(error, "close flow");
  }
}

export function wireCloseConfirmModalDom(deps) {
  const { alertRequestFailed, invoke, setMainWindowCloseAction } = deps;
  document.getElementById("close-choice-tray")?.addEventListener("click", () => void runCloseChoiceFlow("tray", { alertRequestFailed, invoke, setMainWindowCloseAction }));
  document.getElementById("close-choice-quit")?.addEventListener("click", () => void runCloseChoiceFlow("quit", { alertRequestFailed, invoke, setMainWindowCloseAction }));
  document.getElementById("close-choice-cancel")?.addEventListener("click", closeCloseConfirmModalDom);
  document.getElementById("close-confirm-modal")?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "close-confirm-modal" || target.closest("[data-subwindow-dismiss]")) closeCloseConfirmModalDom();
  });
  document.getElementById("close-confirm-modal")?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCloseConfirmModalDom();
  });
}
