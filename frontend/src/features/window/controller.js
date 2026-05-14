import { wireWindowChrome } from "./chrome.js";

// Window chrome wiring keeps the frameless controls in one place so the shell stays declarative.
export function createWindowChromeController() {
  return {
    wireWindowControls() {
      wireWindowChrome({ windowName: "main" });
    },
  };
}
