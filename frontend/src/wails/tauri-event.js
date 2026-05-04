// Event helpers keep the old per-window subscription contract on top of Wails events.
import { Events } from "@wailsio/runtime";
import { currentWindowLabel, isEventForCurrentWindow, normalizeTarget, unwrapPayload } from "./shared.js";

export function listen(eventName, handler) {
  return Events.On(eventName, async (event) => {
    if (!(await isEventForCurrentWindow(event?.data))) {
      return;
    }
    handler({
      event: eventName,
      windowLabel: await currentWindowLabel(),
      payload: unwrapPayload(event?.data),
    });
  });
}

export async function emitTo(target, eventName, payload) {
  return Events.Emit(eventName, {
    __tauriTarget: normalizeTarget(target),
    payload,
  });
}
