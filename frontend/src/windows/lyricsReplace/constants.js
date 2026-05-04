// Lyrics replace window constants keep cross-window addressing in one place.
import { Window as RuntimeWindow } from "@wailsio/runtime";

export const MAIN_WW = { kind: "WebviewWindow", label: "main" };
export const CURRENT_WW_LABEL = "lyrics-replace";
export const currentWindow = RuntimeWindow.Get(CURRENT_WW_LABEL);
export const MSG_REQUEST_FAILED = "请求失败";
