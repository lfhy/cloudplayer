import { showMessageDialog } from "../window/messageDialog.js";

// Playback failure dialog keeps player-side error prompts on the shared child-window pattern.
export function showPlaybackFailureDialog(title, reason) {
  const trackTitle = String(title || "").trim() || "当前歌曲";
  const message = String(reason || "").trim() || "请稍后重试。";
  return showMessageDialog({
    title: "播放失败",
    heading: `${trackTitle} 无法播放`,
    message,
    buttonText: "知道了",
  });
}
