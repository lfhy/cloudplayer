import { Events, Window as RuntimeWindow } from "@wailsio/runtime";
import { DesktopService } from "@bindings/cloudplayer/backend/app/index.js";
import { currentWindowLabel, emitPseudo, getWindowInfo, onPseudo } from "./shared.js";

function unwrap(event) {
  const payload = event?.data;
  if (payload && typeof payload === "object" && "payload" in payload) {
    return payload.payload;
  }
  return payload;
}

export class WebviewWindow {
  constructor(label = "", options = {}, autoCreate = true) {
    this.label = label || "";
    this.labelPromise = this.label ? Promise.resolve(this.label) : currentWindowLabel();
    this.options = options;
    this.autoCreate = autoCreate && !!label;

    if (this.autoCreate) {
      queueMicrotask(async () => {
        const resolvedLabel = await this.getResolvedLabel();
        try {
          await DesktopService.EnsureWindow({
            label: resolvedLabel,
            url: options.url || "/",
            title: options.title || resolvedLabel,
            width: options.width || 900,
            height: options.height || 600,
            x: options.x ?? 80,
            y: options.y ?? 80,
            resizable: options.resizable !== false,
            always_on_top: !!options.alwaysOnTop,
            decorations: options.decorations !== false,
            transparent: !!options.transparent,
            shadow: options.shadow !== false,
            skip_taskbar: !!options.skipTaskbar,
            focus: options.focus !== false,
            mac_title_bar_style: options.macTitleBarStyle || "",
            invisible_title_bar_height: options.invisibleTitleBarHeight || 0,
          });
          emitPseudo(resolvedLabel, "tauri://created", { label: resolvedLabel });
        } catch (error) {
          emitPseudo(resolvedLabel, "tauri://error", error);
        }
      });
    }
  }

  static getCurrent() {
    return new CurrentWebviewWindow();
  }

  static async getByLabel(label) {
    const info = await getWindowInfo(label);
    if (!info?.exists) {
      return null;
    }
    return new NamedWebviewWindow(label);
  }

  once(eventName, callback) {
    void this.getResolvedLabel().then((label) => {
      onPseudo(label, eventName, callback, true);
    });
  }

  async listen(eventName, callback) {
    const label = await this.getResolvedLabel();
    return Events.On(eventName, (event) => {
      const payload = event?.data;
      if (payload && typeof payload === "object" && payload.__tauriTarget && payload.__tauriTarget !== label) {
        return;
      }
      callback({ event: eventName, payload: unwrap(event) });
    });
  }

  async show() {
    await DesktopService.ShowWindow(await this.getResolvedLabel());
  }

  async hide() {
    await DesktopService.HideWindow(await this.getResolvedLabel());
  }

  async setFocus() {
    await DesktopService.FocusWindow(await this.getResolvedLabel());
  }

  async isVisible() {
    const info = await getWindowInfo(await this.getResolvedLabel());
    return !!info?.visible;
  }

  async scaleFactor() {
    return window.devicePixelRatio || 1;
  }

  async outerPosition() {
    const windowRef = await this.getRuntimeWindow();
    const pos = await windowRef.Position();
    return {
      ...pos,
      toLogical(scaleFactor = 1) {
        const factor = Number(scaleFactor) || 1;
        return {
          x: pos.x / factor,
          y: pos.y / factor,
        };
      },
    };
  }

  async outerSize() {
    const windowRef = await this.getRuntimeWindow();
    const size = await windowRef.Size();
    return {
      ...size,
      toLogical() {
        return {
          width: size.width,
          height: size.height,
        };
      },
    };
  }

  async setIgnoreCursorEvents(ignore) {
    await DesktopService.SetWindowIgnoreMouseEvents(await this.getResolvedLabel(), !!ignore);
  }

  async onMoved(callback) {
    const label = await this.getResolvedLabel();
    return Events.On(Events.Types.Common.WindowDidMove, (event) => {
      if (event?.sender === label) {
        callback(event);
      }
    });
  }

  async onResized(callback) {
    const label = await this.getResolvedLabel();
    return Events.On(Events.Types.Common.WindowDidResize, (event) => {
      if (event?.sender === label) {
        callback(event);
      }
    });
  }

  async getResolvedLabel() {
    if (this.label) {
      return this.label;
    }
    const resolved = (await this.labelPromise) || "main";
    this.label = resolved;
    return this.label;
  }

  async getRuntimeWindow() {
    const label = await this.getResolvedLabel();
    return RuntimeWindow.Get(label);
  }
}

class NamedWebviewWindow extends WebviewWindow {
  constructor(label) {
    super(label, {}, false);
  }
}

class CurrentWebviewWindow extends WebviewWindow {
  constructor() {
    super("", {}, false);
  }

  async getRuntimeWindow() {
    const label = await this.getResolvedLabel();
    return RuntimeWindow.Get(label);
  }
}
