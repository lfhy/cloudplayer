import { showMessageDialog } from "../../features/window/messageDialog.js";
import { cleanErrorText, extractStructuredErrorText } from "./errorMessage.js";

// Error helpers keep the user-facing message policy consistent across modules.
export const MSG_REQUEST_FAILED = "请求失败";
const GENERIC_ERROR_MESSAGES = new Set(["request failed", "请求失败", "failed", "error"]);

function extractErrorMessage(error) {
  const candidates = [
    error?.message,
    error?.cause,
    error?.data,
    error,
  ];
  for (const candidate of candidates) {
    const text = cleanErrorText(extractStructuredErrorText(candidate));
    if (!text) continue;
    if (GENERIC_ERROR_MESSAGES.has(text.toLowerCase())) continue;
    return text;
  }
  return "";
}

export function warnRequestFailed(error, label) {
  if (label) console.warn(label, error);
  else console.warn(error);
}

export async function alertRequestFailed(error, label, options = {}) {
  warnRequestFailed(error, label);
  const message = extractErrorMessage(error) || String(options.message || "请稍后重试。");
  return showMessageDialog({
    title: options.title || "提示",
    heading: options.heading || MSG_REQUEST_FAILED,
    message,
    buttonText: options.buttonText || "知道了",
  });
}
