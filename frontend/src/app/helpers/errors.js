import { showMessageDialog } from "../../features/window/messageDialog.js";

// Error helpers keep the user-facing message policy consistent across modules.
export const MSG_REQUEST_FAILED = "请求失败";
const GENERIC_ERROR_MESSAGES = new Set(["request failed", "请求失败", "failed", "error"]);

function cleanErrorText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function looksLikeJSON(text) {
  return text.startsWith("{") || text.startsWith("[");
}

function extractStructuredMessage(value, depth = 0) {
  if (depth > 4 || value == null) return "";
  if (typeof value === "string") {
    const text = cleanErrorText(value);
    if (!text) return "";
    if (looksLikeJSON(text)) {
      try {
        return extractStructuredMessage(JSON.parse(text), depth + 1);
      } catch {
        return text;
      }
    }
    return text;
  }
  if (value instanceof Error) {
    return extractStructuredMessage(value.message, depth + 1);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = extractStructuredMessage(item, depth + 1);
      if (message) return message;
    }
    return "";
  }
  if (typeof value === "object") {
    for (const key of ["message", "error", "reason", "detail", "details", "msg", "body", "data"]) {
      const message = extractStructuredMessage(value[key], depth + 1);
      if (message) return message;
    }
  }
  return "";
}

function extractErrorMessage(error) {
  const candidates = [
    error?.message,
    error?.cause,
    error?.data,
    error,
  ];
  for (const candidate of candidates) {
    const text = cleanErrorText(extractStructuredMessage(candidate));
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
