import { Events } from "@wailsio/runtime";
import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";
import { unwrapPayload } from "../../wails/shared.js";

const WINDOW_LABEL = "message-dialog";
const WINDOW_URL = "/message_dialog.html";
const DEFAULT_OPTIONS = {
  title: "提示",
  heading: "请求失败",
  message: "请稍后重试。",
  buttonText: "知道了",
};

// Reusable child-message dialog keeps blocking alerts out of the native browser prompt flow.
export async function showMessageDialog(options = {}) {
  const merged = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const params = new URLSearchParams();
  params.set("title", String(merged.title || DEFAULT_OPTIONS.title));
  params.set("heading", String(merged.heading || DEFAULT_OPTIONS.heading));
  params.set("message", String(merged.message || DEFAULT_OPTIONS.message));
  params.set("buttonText", String(merged.buttonText || DEFAULT_OPTIONS.buttonText));
  return new Promise((resolve) => {
    const done = (accepted) => resolve({ accepted: accepted === true });
    Events.Once("message-dialog-result", (event) => {
      done(unwrapPayload(event?.data)?.accepted === true);
    });
    void DesktopService.EnsureWindow({
      label: WINDOW_LABEL,
      url: `${WINDOW_URL}?${params.toString()}`,
      title: String(merged.title || DEFAULT_OPTIONS.title),
      width: 456,
      height: 208,
      center_on_main: true,
      resizable: false,
      always_on_top: true,
      decorations: true,
      transparent: false,
      shadow: true,
      skip_taskbar: true,
      focus: true,
      mac_title_bar_style: "hiddenInset",
      invisible_title_bar_height: 44,
    }).catch((error) => {
      console.warn("open message dialog window", error);
      alert(String(merged.message || DEFAULT_OPTIONS.message));
      done(true);
    });
  });
}
