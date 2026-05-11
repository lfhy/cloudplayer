import { Window as RuntimeWindow } from "@wailsio/runtime";

// Window chrome wiring keeps the frameless controls in one place so the shell stays declarative.
export function createWindowChromeController() {
  const mainWindow = RuntimeWindow.Get("main");

  async function syncMaximizeButton(button) {
    if (!button) return;
    let maximized = false;
    try {
      maximized = await mainWindow.IsMaximised();
    } catch (error) {
      console.warn("query main window maximized state", error);
    }
    button.title = maximized ? "Restore" : "Maximize";
    button.setAttribute("aria-label", maximized ? "Restore" : "Maximize");
  }

  async function toggleMaximize(button) {
    try {
      if (await mainWindow.IsMaximised()) {
        await mainWindow.Restore();
      } else {
        await mainWindow.Maximise();
      }
    } catch (error) {
      console.warn("toggle main window maximize", error);
    } finally {
      window.setTimeout(() => void syncMaximizeButton(button), 0);
    }
  }

  function wireWindowControls() {
    const minimizeBtn = document.getElementById("btn-window-minimize");
    const maximizeBtn = document.getElementById("btn-window-maximize");
    const closeBtn = document.getElementById("btn-window-close");
    minimizeBtn?.addEventListener("click", () => {
      void mainWindow.Minimise().catch((error) => console.warn("minimise main window", error));
    });
    maximizeBtn?.addEventListener("click", () => {
      void toggleMaximize(maximizeBtn);
    });
    closeBtn?.addEventListener("click", () => {
      void mainWindow.Close().catch((error) => console.warn("close main window", error));
    });
    void syncMaximizeButton(maximizeBtn);
    window.addEventListener("resize", () => {
      void syncMaximizeButton(maximizeBtn);
    });
  }

  return { wireWindowControls };
}
