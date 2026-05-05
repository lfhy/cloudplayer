// Tray label sync keeps macOS menu bar lyrics in step with the active line without spamming IPC.
import { isMacDesktop } from "../../app/helpers/platformTheme.js";

const TRAY_LABEL_MAX = 28;

function normalizeTrayLabel(value) {
  const normalized = String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized === "—") return "";
  return normalized.length > TRAY_LABEL_MAX
    ? `${normalized.slice(0, TRAY_LABEL_MAX - 1)}…`
    : normalized;
}

export function createTrayLabelSync({ invoke }) {
  const enabled = isMacDesktop();
  let lastLabel = null;

  async function pushLabel(value) {
    if (!enabled) return;
    const normalized = normalizeTrayLabel(value);
    if (normalized === lastLabel) return;
    lastLabel = normalized;
    try {
      await invoke("set_tray_label", { text: normalized });
    } catch (error) {
      console.warn("set_tray_label", error);
    }
  }

  async function sync(payload, currentTrack, audioPlaying) {
    if (!audioPlaying || !currentTrack) {
      await pushLabel("");
      return;
    }
    const activeLine = payload?.activeSlot === 2 ? payload?.line2 : payload?.line1;
    await pushLabel(activeLine || currentTrack.title || "");
  }

  return {
    isEnabled: () => enabled,
    sync,
  };
}
