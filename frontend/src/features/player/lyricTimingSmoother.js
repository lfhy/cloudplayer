// Lyric timing smoother projects time between sync ticks and suppresses tiny backward jitter.
export function createLyricTimingSmoother() {
  let lastReportedAudioNow = 0;
  let progressAudioNow = 0;
  let progressLineKey = "";
  let progressValue = 0;
  let syncToken = "";
  let syncedAudioNow = 0;
  let syncedWallNow = 0;
  let wasAudioPlaying = false;

  function syncedCurrentTime(token, anchor) {
    const reportedNow = Number(anchor?.audioNow) || 0;
    const now = performance.now();
    if (syncToken !== token) {
      syncToken = token;
      syncedAudioNow = reportedNow;
      syncedWallNow = now;
      lastReportedAudioNow = reportedNow;
    }
    const projectedNow = syncedAudioNow + Math.max(0, now - syncedWallNow) / 1000;
    if (!anchor?.audioPlaying) {
      if (wasAudioPlaying) {
        const drift = reportedNow - projectedNow;
        syncedAudioNow = drift >= -0.18 ? Math.max(projectedNow, reportedNow) : reportedNow;
      } else if (Math.abs(reportedNow - lastReportedAudioNow) > 0.18) {
        syncedAudioNow = reportedNow;
      }
      syncedWallNow = now;
      lastReportedAudioNow = reportedNow;
      wasAudioPlaying = false;
      return syncedAudioNow;
    }
    wasAudioPlaying = true;
    if (Math.abs(reportedNow - lastReportedAudioNow) > 0.0005) {
      const drift = reportedNow - projectedNow;
      syncedAudioNow = drift >= -0.18 ? Math.max(projectedNow, reportedNow) : reportedNow;
      syncedWallNow = now;
      lastReportedAudioNow = reportedNow;
    }
    return syncedAudioNow + Math.max(0, now - syncedWallNow) / 1000;
  }

  function monotonicProgress(lineKey, audioNow, rawRatio) {
    const clamped = Math.min(1, Math.max(0, Number.isFinite(rawRatio) ? rawRatio : 0));
    const sameLine = progressLineKey === lineKey;
    const backwardSeek = sameLine && audioNow < progressAudioNow - 0.35;
    progressValue = sameLine && !backwardSeek ? Math.max(progressValue, clamped) : clamped;
    progressLineKey = lineKey;
    progressAudioNow = audioNow;
    return progressValue;
  }

  function resetProgress() {
    progressAudioNow = 0;
    progressLineKey = "";
    progressValue = 0;
    syncToken = "";
    syncedAudioNow = 0;
    syncedWallNow = 0;
    lastReportedAudioNow = 0;
    wasAudioPlaying = false;
  }

  return { monotonicProgress, resetProgress, syncedCurrentTime };
}
