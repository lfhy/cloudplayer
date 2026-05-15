import { showMessageDialog } from "../window/messageDialog.js";

// Online-mode playlist dialog centralizes the Kugou-only cloud-playlist restriction copy.
export function showOnlineModePlaylistRestriction() {
  return showMessageDialog({
    title: "无法添加到歌单",
    heading: "当前歌曲无法加入云歌单",
    message: "在线模式下只能把酷狗云端歌曲添加到云歌单。",
    buttonText: "知道了",
  });
}
