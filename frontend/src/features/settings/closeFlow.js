// Close-flow helpers keep modal state and quit/minimize branching out of the main settings controller.
export function openCloseConfirmModalDom() {
  const rememberEl = document.getElementById("close-choice-remember");
  if (rememberEl) rememberEl.checked = false;
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

