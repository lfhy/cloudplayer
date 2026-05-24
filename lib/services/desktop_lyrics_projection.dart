// Desktop-lyrics projection derives the two visible lines plus the timing
// anchors that let the native macOS overlay interpolate highlight progress.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/services/lyrics_timing.dart';

const String _desktopIdleLine1 = 'CloudPlayer';
const String _desktopIdleLine2 = '让音乐陪你此刻';
const String _blankDesktopLine = '\u00A0';

Map<String, dynamic> buildDesktopLyricsState({
  required AppSettings settings,
  required TrackRow? track,
  required List<LyricEntry> entries,
  required LyricsPayloadData? payload,
  required Duration position,
  required bool isPlaying,
}) {
  final now = position.inMilliseconds / 1000;
  final idleLine1 = _fallbackDesktopLine(
    settings.desktopLyricsIdleLine1,
    _desktopIdleLine1,
  );
  final idleLine2 = _fallbackDesktopLine(
    settings.desktopLyricsIdleLine2,
    _desktopIdleLine2,
  );
  final projection = _projectDesktopLyrics(
    track: track,
    entries: entries,
    payload: payload,
    currentSeconds: now,
    idleLine1: idleLine1,
    idleLine2: idleLine2,
    isPlaying: isPlaying,
  );
  return <String, dynamic>{
    'visible': settings.desktopLyricsVisible,
    'locked': settings.desktopLyricsLocked,
    'scale': settings.desktopLyricsScale,
    'x': settings.desktopLyricsX,
    'y': settings.desktopLyricsY,
    'width': settings.desktopLyricsWidth,
    'height': settings.desktopLyricsHeight,
    'baseColor': settings.desktopLyricsColorBase,
    'highlightColor': settings.desktopLyricsColorHighlight,
    'idleLine1': idleLine1,
    'idleLine2': idleLine2,
    ...projection,
  };
}

Map<String, dynamic> _projectDesktopLyrics({
  required TrackRow? track,
  required List<LyricEntry> entries,
  required LyricsPayloadData? payload,
  required double currentSeconds,
  required String idleLine1,
  required String idleLine2,
  required bool isPlaying,
}) {
  if (track == null) {
    return <String, dynamic>{
      'line1': idleLine1,
      'line2': idleLine2,
      'idleMode': true,
      'activeSlot': 1,
      'line1StartT': 0.0,
      'line1EndT': 1.0,
      'line2StartT': 0.0,
      'line2EndT': 1.0,
      'line1Words': null,
      'line2Words': null,
      'audioNow': currentSeconds,
      'audioPlaying': false,
      'line1Progress': 0.0,
      'line2Progress': 1.0,
    };
  }
  if (entries.isEmpty) {
    return <String, dynamic>{
      'line1': track.title.trim().isEmpty ? '—' : track.title,
      'line2': track.artist.trim().isEmpty ? '在线试听' : track.artist,
      'idleMode': false,
      'activeSlot': 1,
      'line1StartT': 0.0,
      'line1EndT': 1.0,
      'line2StartT': 0.0,
      'line2EndT': 1.0,
      'line1Words': null,
      'line2Words': null,
      'audioNow': currentSeconds,
      'audioPlaying': isPlaying,
      'line1Progress': 1.0,
      'line2Progress': 0.0,
    };
  }
  final index = activeLyricIndexAtSeconds(entries, currentSeconds);
  final currentLine = entries[index];
  final previousLine = index > 0 ? entries[index - 1] : null;
  final nextLine = index + 1 < entries.length ? entries[index + 1] : null;
  final wordLines = payload?.wordLines.length == entries.length
      ? payload?.wordLines
      : null;
  final startT = currentLine.t;
  final endT = nextLine?.t ?? (startT + 4);
  final currentProgress = lyricLineProgress(
    entries: entries,
    payload: payload,
    currentSeconds: currentSeconds,
    index: index,
  );
  if (index.isOdd) {
    return <String, dynamic>{
      'line1': _desktopTextOrFallback(
        previousLine?.text ?? '',
        _blankDesktopLine,
      ),
      'line2': _desktopTextOrFallback(currentLine.text, '—'),
      'idleMode': false,
      'activeSlot': 2,
      'line1StartT': 0.0,
      'line1EndT': 0.0,
      'line2StartT': startT,
      'line2EndT': endT,
      'line1Words': previousLine == null
          ? null
          : _wordLinePayload(wordLines?[index - 1]),
      'line2Words': _wordLinePayload(wordLines?[index]),
      'audioNow': currentSeconds,
      'audioPlaying': isPlaying,
      'line1Progress': 1.0,
      'line2Progress': currentProgress,
    };
  }
  return <String, dynamic>{
    'line1': _desktopTextOrFallback(currentLine.text, '—'),
    'line2': _desktopTextOrFallback(nextLine?.text ?? '', _blankDesktopLine),
    'idleMode': false,
    'activeSlot': 1,
    'line1StartT': startT,
    'line1EndT': endT,
    'line2StartT': 0.0,
    'line2EndT': 0.0,
    'line1Words': _wordLinePayload(wordLines?[index]),
    'line2Words': nextLine == null
        ? null
        : _wordLinePayload(wordLines?[index + 1]),
    'audioNow': currentSeconds,
    'audioPlaying': isPlaying,
    'line1Progress': currentProgress,
    'line2Progress': 0.0,
  };
}

Map<String, dynamic>? _wordLinePayload(LyricsWordLine? line) {
  if (line == null) {
    return null;
  }
  return <String, dynamic>{
    'startMs': line.startMs,
    'endMs': line.endMs,
    'words': line.words
        .map(
          (word) => <String, dynamic>{
            'startMs': word.startMs,
            'endMs': word.endMs,
            'text': word.text,
          },
        )
        .toList(growable: false),
  };
}

String _fallbackDesktopLine(String value, String fallback) {
  final trimmed = value.trim();
  return trimmed.isEmpty ? fallback : trimmed;
}

String _desktopTextOrFallback(String text, String fallback) {
  final trimmed = text.trim();
  return trimmed.isEmpty ? fallback : trimmed;
}
