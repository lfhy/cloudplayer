import { currentWindowLabel } from "../../wails/shared.js";
import { invoke } from "../../wails/tauri-core.js";
import { installFrontendErrorLoggingWithDependencies } from "./frontendErrorLogging.js";

// Runtime installer binds the pure frontend-error bridge to the real Wails invoke/window-label adapters.
export function installFrontendErrorLogging() {
  installFrontendErrorLoggingWithDependencies({
    invokeImpl: invoke,
    currentWindowLabelImpl: currentWindowLabel,
  });
}
