// Close-flow helpers keep modal state and quit/minimize branching out of the main settings controller.
export function openCloseConfirmModalDom() {
  const modalEl = document.getElementById("close-confirm-modal");
  if (!modalEl) return;
  modalEl.hidden = false;
  modalEl.setAttribute("aria-hidden", "false");
}

export function closeCloseConfirmModalDom() {
  const modalEl = document.getElementById("close-confirm-modal");
  if (!modalEl) return;
  modalEl.hidden = true;
  modalEl.setAttribute("aria-hidden", "true");
}

export async function runCloseChoiceFlow(mode, deps) {
  const { alertRequestFailed, invoke } = deps;
  closeCloseConfirmModalDom();
  try {
    if (mode === "tray") await invoke("hide_main_window");
    else await invoke("quit_app");
  } catch (error) {
    alertRequestFailed(error, "close flow");
  }
}
