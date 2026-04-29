// Play button icon helper keeps transport icon swaps consistent across controllers.
import { iconSvgByName } from "../../app/helpers/icons.js";

const PLAY_ICON = iconSvgByName("play-bold");
const PAUSE_ICON = iconSvgByName("pause-bold");

export function setPlayButtonIcon(button, playing) {
  if (!button) return;
  button.dataset.playIcon = playing ? "pause" : "play";
  button.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
}
