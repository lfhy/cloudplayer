import { DesktopService } from "@bindings/cloudplayer/backend/desktop/index.js";
import { isWindowsDesktop } from "../../app/helpers/platformTheme.js";
import { currentWindowLabel } from "../../wails/shared.js";

// Platform dialog helpers split Windows native dialogs from macOS child-window flows without leaking OS checks into feature code.
export function canUseNativeDialogs() {
  return isWindowsDesktop();
}

function normalizedDialogCopy(options = {}) {
  return {
    title: String(options.title || "").trim(),
    heading: String(options.heading || "").trim(),
    message: String(options.message || "").trim(),
  };
}

async function dialogRequest(options = {}) {
  const copy = normalizedDialogCopy(options);
  return {
    title: copy.title,
    heading: copy.heading,
    message: copy.message,
    parent_label: await currentWindowLabel(),
  };
}

export async function showNativeMessageDialog(options = {}) {
  await DesktopService.ShowNativeMessageDialog(await dialogRequest(options));
  return { accepted: true };
}

export async function showNativeQuestionDialog(options = {}) {
  const accepted = await DesktopService.ShowNativeQuestionDialog(await dialogRequest(options));
  return { accepted: accepted === true };
}
