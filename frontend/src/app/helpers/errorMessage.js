// Error-message helpers normalize Wails/runtime payloads so child dialogs only show user-facing text.
export function cleanErrorText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function looksLikeJSON(text) {
  return text.startsWith("{") || text.startsWith("[");
}

export function extractStructuredErrorText(value, depth = 0) {
  if (depth > 4 || value == null) return "";
  if (typeof value === "string") {
    const text = cleanErrorText(value);
    if (!text) return "";
    if (looksLikeJSON(text)) {
      try {
        return extractStructuredErrorText(JSON.parse(text), depth + 1);
      } catch {
        return text;
      }
    }
    return text;
  }
  if (value instanceof Error) {
    return extractStructuredErrorText(value.message, depth + 1);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = extractStructuredErrorText(item, depth + 1);
      if (message) return message;
    }
    return "";
  }
  if (typeof value === "object") {
    for (const key of ["message", "error", "reason", "detail", "details", "msg", "body", "data", "cause"]) {
      const message = extractStructuredErrorText(value[key], depth + 1);
      if (message) return message;
    }
  }
  return "";
}
