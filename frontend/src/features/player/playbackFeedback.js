// Playback feedback helpers centralize the short loading copy and user-facing failure reasons.
const GENERIC_FAILURE_TEXT = new Set([
  "request failed",
  "请求失败",
  "playback failed",
  "audio play failed",
]);

function cleanReason(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isGenericFailureText(value) {
  const normalized = cleanReason(value).toLowerCase();
  return GENERIC_FAILURE_TEXT.has(normalized);
}

function firstReason(candidates) {
  for (const candidate of candidates) {
    const reason = cleanReason(candidate);
    if (!reason || isGenericFailureText(reason)) continue;
    return reason;
  }
  return "";
}

export function playbackLoadingSubtext(artist = "") {
  const name = cleanReason(artist);
  return name ? `${name} · 加载中...` : "加载中...";
}

export function playbackFailureReason(error, { fallback = "播放失败" } = {}) {
  const reason = firstReason([
    error?.message,
    error?.cause?.message,
    error?.data?.message,
    typeof error === "string" ? error : "",
  ]);
  return reason || fallback;
}

export function audioPlaybackFailureReason(audio, { fallback = "播放失败" } = {}) {
  const mediaError = audio?.error;
  const explicitReason = firstReason([mediaError?.message]);
  if (explicitReason) return explicitReason;
  switch (Number(mediaError?.code || 0)) {
    case 1:
      return "播放已取消";
    case 2:
      return "音频加载失败，网络连接已中断";
    case 3:
      return "音频解码失败";
    case 4:
      return "当前音源无法播放";
    default:
      return fallback;
  }
}
