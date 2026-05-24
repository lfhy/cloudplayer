// Shared lyric timing helpers keep active-line detection and per-line progress
// consistent across desktop, mini, and immersive lyric surfaces.

import 'package:cloudplayer_flutter/models/app_models.dart';

int activeLyricIndexAtSeconds(
  List<LyricEntry> entries,
  double currentSeconds, {
  double leadSeconds = 0.12,
}) {
  var activeIndex = 0;
  for (var index = 0; index < entries.length; index += 1) {
    if (entries[index].t <= currentSeconds + leadSeconds) {
      activeIndex = index;
    } else {
      break;
    }
  }
  return activeIndex;
}

int activeLyricIndex(
  List<LyricEntry> entries,
  Duration position, {
  double leadSeconds = 0.12,
}) {
  return activeLyricIndexAtSeconds(
    entries,
    position.inMilliseconds / 1000,
    leadSeconds: leadSeconds,
  );
}

double lyricLineProgress({
  required List<LyricEntry> entries,
  required LyricsPayloadData? payload,
  required double currentSeconds,
  required int index,
}) {
  final wordLine = payload?.wordLines.length == entries.length
      ? payload?.wordLines[index]
      : null;
  if (wordLine != null && wordLine.words.isNotEmpty) {
    final totalChars = wordLine.words.fold<int>(
      0,
      (sum, word) => sum + word.text.runes.length,
    );
    if (totalChars <= 0) return 0;
    var covered = 0.0;
    for (final word in wordLine.words) {
      final start = word.startMs / 1000;
      final end = word.endMs / 1000;
      final duration = end - start;
      final progress = duration > 0
          ? ((currentSeconds - start) / duration).clamp(0.0, 1.0)
          : currentSeconds >= end
          ? 1.0
          : 0.0;
      covered += progress * word.text.runes.length;
    }
    return (covered / totalChars).clamp(0.0, 1.0);
  }
  final start = entries[index].t;
  final end = index + 1 < entries.length ? entries[index + 1].t : start + 4;
  final duration = end - start;
  if (duration <= 0) {
    return 1;
  }
  return ((currentSeconds - start) / duration).clamp(0.0, 1.0);
}
