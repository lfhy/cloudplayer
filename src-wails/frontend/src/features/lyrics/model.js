// Lyrics model helpers stay pure so the window controller can focus on side effects.
const LYRICS_IDLE_LINE1 = "CloudPlayer";
const LYRICS_IDLE_LINE2 = "让音乐陪你此刻";

export function parseLrc(text) {
  const lines = [];
  const pattern = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(pattern);
    if (!match) continue;
    const min = parseInt(match[1], 10);
    const sec = parseInt(match[2], 10);
    const frac = match[3] ? match[3].padEnd(3, "0").slice(0, 3) : "000";
    lines.push({ t: min * 60 + sec + parseInt(frac, 10) / 1000, text: line.slice(match[0].length).trim() });
  }
  lines.sort((a, b) => a.t - b.t);
  return lines;
}

export function isSamePlayableIdentity(a, b) {
  if (!a || !b) return false;
  return (a.local_path || "") === (b.local_path || "") && (a.source_id || "").trim() === (b.source_id || "").trim();
}

export function currentPlayableKey(track) {
  if (!track) return "";
  return track.local_path ? `local:${track.local_path}` : (track.source_id || "").trim();
}

export function currentLyricsReplaceContext(track, audioDurationSeconds) {
  const durationMs = audioDurationSeconds && Number.isFinite(audioDurationSeconds) && audioDurationSeconds > 0 ? Math.round(audioDurationSeconds * 1000) : null;
  return {
    trackKey: currentPlayableKey(track),
    title: track?.title || "",
    artist: track?.artist || "",
    album: track?.album || "",
    durationMs,
  };
}

export function lyricDisplayForDesktop({ currentTrack, currentTime, lrcEntries, wordLines, idleLine1, idleLine2 }) {
  const now = Number(currentTime) || 0;
  const idleLine1Text = String(idleLine1 || LYRICS_IDLE_LINE1).trim() || LYRICS_IDLE_LINE1;
  const idleLine2Text = String(idleLine2 || LYRICS_IDLE_LINE2).trim() || LYRICS_IDLE_LINE2;
  if (!currentTrack) {
    return { line1: idleLine1Text, line2: idleLine2Text, idleMode: true, activeSlot: 1, line1StartT: 0, line1EndT: 1, line2StartT: 0, line2EndT: 1, line1Words: null, line2Words: null, audioNow: now };
  }
  if (!lrcEntries.length) {
    return { line1: currentTrack.title || "—", line2: currentTrack.artist || "在线试听", activeSlot: 1, line1StartT: 0, line1EndT: 1, line2StartT: 0, line2EndT: 1, line1Words: null, line2Words: null, audioNow: now };
  }
  let index = 0;
  for (let cursor = 0; cursor < lrcEntries.length; cursor += 1) {
    if (lrcEntries[cursor].t <= now + 0.12) index = cursor;
    else break;
  }
  const currentLine = lrcEntries[index];
  const prevLine = index > 0 ? lrcEntries[index - 1] : null;
  const nextLine = lrcEntries[index + 1];
  const startT = currentLine?.t ?? 0;
  const endT = nextLine ? nextLine.t : startT + 4;
  if (index % 2 === 0) {
    return { line1: currentLine?.text || "—", line2: nextLine?.text || "\u00a0", activeSlot: 1, line1StartT: startT, line1EndT: endT, line2StartT: 0, line2EndT: 0, line1Words: wordLines?.[index] ?? null, line2Words: nextLine ? wordLines?.[index + 1] ?? null : null, audioNow: now };
  }
  return { line1: prevLine?.text || "\u00a0", line2: currentLine?.text || "—", activeSlot: 2, line1StartT: 0, line1EndT: 0, line2StartT: startT, line2EndT: endT, line1Words: prevLine ? wordLines?.[index - 1] ?? null : null, line2Words: wordLines?.[index] ?? null, audioNow: now };
}
