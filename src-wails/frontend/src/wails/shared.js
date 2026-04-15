import { Events } from "@wailsio/runtime";
import { DesktopService } from "../../bindings/cloudplayer";

const pseudoListeners = new Map();
const pseudoSubscribedLabels = new Set();

function ensurePseudoSubscription(label) {
  if (!label || pseudoSubscribedLabels.has(label)) {
    return;
  }
  pseudoSubscribedLabels.add(label);
  Events.On("wails:window:closing", (event) => {
    if (event?.data?.name !== label) {
      return;
    }
    dispatchPseudo(label, "tauri://destroyed", event.data);
  });
}

function dispatchPseudo(label, eventName, payload) {
  const key = `${label}:${eventName}`;
  const listeners = pseudoListeners.get(key);
  if (!listeners?.length) {
    return;
  }
  pseudoListeners.set(
    key,
    listeners.filter((listener) => {
      try {
        listener.callback(payload);
      } catch (error) {
        console.error(error);
      }
      return !listener.once;
    }),
  );
}

export function onPseudo(label, eventName, callback, once = false) {
  ensurePseudoSubscription(label);
  const key = `${label}:${eventName}`;
  const listeners = pseudoListeners.get(key) || [];
  listeners.push({ callback, once });
  pseudoListeners.set(key, listeners);
}

export function emitPseudo(label, eventName, payload) {
  dispatchPseudo(label, eventName, payload);
}

function resolveBootstrapWindowLabel() {
  const injected = globalThis.__CLOUDPLAYER_WINDOW_NAME__;
  if (typeof injected === "string" && injected.trim()) {
    return injected.trim();
  }
  const path = globalThis.location?.pathname || "/";
  if (path === "/desktop_lyrics.html") {
    return "lyrics";
  }
  return "main";
}

export async function currentWindowLabel() {
  return resolveBootstrapWindowLabel();
}

export function normalizeTarget(target) {
  if (!target) {
    return "";
  }
  if (typeof target === "string") {
    return target;
  }
  if (typeof target === "object" && typeof target.label === "string") {
    return target.label;
  }
  return "";
}

export function makeLogicalRect(rect) {
  return {
    ...rect,
    toLogical() {
      return { ...rect };
    },
  };
}

export async function getWindowInfo(label) {
  return DesktopService.GetWindowInfo(label);
}

export async function isEventForCurrentWindow(payload) {
  if (!payload || typeof payload !== "object" || !payload.__tauriTarget) {
    return true;
  }
  const current = await currentWindowLabel();
  return payload.__tauriTarget === current;
}

export function unwrapPayload(payload) {
  if (payload && typeof payload === "object" && "payload" in payload) {
    return payload.payload;
  }
  return payload;
}
