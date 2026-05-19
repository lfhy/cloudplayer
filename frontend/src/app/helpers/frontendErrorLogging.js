const FRONTEND_LOGGING_FLAG = "__cloudplayerFrontendErrorLoggingInstalled__";
const MAX_LOG_FIELD_LENGTH = 2400;

function limitLogText(value, fallback = "") {
  const resolved = typeof value === "string" ? value : String(value ?? fallback);
  const trimmed = resolved.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.length > MAX_LOG_FIELD_LENGTH ? `${trimmed.slice(0, MAX_LOG_FIELD_LENGTH)}...` : trimmed;
}

function compactWhitespace(value) {
  return limitLogText(String(value ?? "").replace(/\s+/g, " "), "");
}

function describeValue(value, seen = new WeakSet()) {
  if (value instanceof Error) {
    return {
      name: value.name || "Error",
      message: value.message || "",
      stack: typeof value.stack === "string" ? limitLogText(value.stack, "") : "",
    };
  }
  if (value == null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "bigint") {
    return `${value}n`;
  }
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  if (typeof value !== "object") {
    return String(value);
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => describeValue(item, seen));
  }
  const out = {};
  Object.entries(value).slice(0, 16).forEach(([key, item]) => {
    out[key] = describeValue(item, seen);
  });
  return out;
}

function serializeArgs(args) {
  try {
    return limitLogText(JSON.stringify(args.map((item) => describeValue(item))), "");
  } catch {
    return limitLogText(args.map((item) => compactWhitespace(item)).filter(Boolean).join(" | "), "");
  }
}

function extractPrimaryMessage(args) {
  for (const item of args) {
    if (item instanceof Error && item.message) {
      return limitLogText(item.message, "");
    }
    if (typeof item === "string" && item.trim()) {
      return limitLogText(item, "");
    }
  }
  const fallback = serializeArgs(args);
  return fallback || "frontend runtime issue";
}

function extractStack(args) {
  for (const item of args) {
    if (item instanceof Error && typeof item.stack === "string" && item.stack.trim()) {
      return limitLogText(item.stack, "");
    }
    if (item && typeof item === "object" && typeof item.stack === "string" && item.stack.trim()) {
      return limitLogText(item.stack, "");
    }
  }
  return "";
}

async function emitFrontendLog(windowLabelPromise, invokeImpl, scope, payload) {
  try {
    const windowLabel = await windowLabelPromise;
    const detail = limitLogText(
      JSON.stringify({
        href: globalThis.location?.href || "",
        ...payload,
      }),
      ""
    );
    await invokeImpl("log_frontend_debug", {
      scope,
      stage: windowLabel || "main",
      detail,
    });
  } catch {
    // Swallow logging failures so diagnostics never become another user-facing failure.
  }
}

function installConsoleBridge(windowLabelPromise, deps) {
  const { consoleObject, invokeImpl, originalWarn, originalError } = deps;
  consoleObject.warn = (...args) => {
    originalWarn(...args);
    void emitFrontendLog(windowLabelPromise, invokeImpl, "runtime-console-warn", {
      source: "console.warn",
      message: extractPrimaryMessage(args),
      stack: extractStack(args),
      args: serializeArgs(args),
    });
  };
  consoleObject.error = (...args) => {
    originalError(...args);
    void emitFrontendLog(windowLabelPromise, invokeImpl, "runtime-console-error", {
      source: "console.error",
      message: extractPrimaryMessage(args),
      stack: extractStack(args),
      args: serializeArgs(args),
    });
  };
}

function installGlobalErrorBridge(windowLabelPromise, deps) {
  const { targetWindow, invokeImpl } = deps;
  targetWindow.addEventListener("error", (event) => {
    void emitFrontendLog(windowLabelPromise, invokeImpl, "runtime-window-error", {
      source: "window.error",
      message: limitLogText(event?.error?.message || event?.message || "uncaught window error", "uncaught window error"),
      stack: extractStack([event?.error]),
      args: serializeArgs([{
        filename: event?.filename || "",
        lineno: event?.lineno || 0,
        colno: event?.colno || 0,
        message: event?.message || "",
      }]),
    });
  });
  targetWindow.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    void emitFrontendLog(windowLabelPromise, invokeImpl, "runtime-unhandled-rejection", {
      source: "window.unhandledrejection",
      message: extractPrimaryMessage([reason]),
      stack: extractStack([reason]),
      args: serializeArgs([reason]),
    });
  });
}

// Frontend error logging forwards release-only runtime failures into the desktop log files.
export function installFrontendErrorLoggingWithDependencies(options = {}) {
  const {
    consoleObject = console,
    targetWindow = window,
    invokeImpl,
    currentWindowLabelImpl,
  } = options;
  if (targetWindow[FRONTEND_LOGGING_FLAG]) {
    return;
  }
  targetWindow[FRONTEND_LOGGING_FLAG] = true;
  const windowLabelPromise = Promise.resolve(typeof currentWindowLabelImpl === "function" ? currentWindowLabelImpl() : "main").catch(() => "main");
  const deps = {
    consoleObject,
    invokeImpl: typeof invokeImpl === "function" ? invokeImpl : async () => {},
    originalWarn: consoleObject.warn.bind(consoleObject),
    originalError: consoleObject.error.bind(consoleObject),
    targetWindow,
  };
  installConsoleBridge(windowLabelPromise, deps);
  installGlobalErrorBridge(windowLabelPromise, deps);
}
