// Lyrics models keep bridge payload parsing and line extraction isolated from
// controller and widget code so immersive mode can reuse the same snapshot.

import 'package:cloudplayer_flutter/models/model_utils.dart';

class LyricsPayloadData {
  LyricsPayloadData({
    required this.lrcText,
    required this.wordLines,
  });

  factory LyricsPayloadData.fromJson(Map<String, dynamic> json) {
    final wordLines = (json['wordLines'] as List<dynamic>? ?? <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(LyricsWordLine.fromJson)
        .toList(growable: false);
    return LyricsPayloadData(
      lrcText: readModelString(json, 'lrcText'),
      wordLines: wordLines,
    );
  }

  final String lrcText;
  final List<LyricsWordLine> wordLines;

  List<LyricEntry> entries() {
    if (wordLines.isNotEmpty) {
      final rows = wordLines
          .map((line) => LyricEntry(
                t: line.startMs / 1000,
                text: line.words.map((word) => word.text).join().trim(),
              ))
          .where((entry) => entry.text.isNotEmpty)
          .toList(growable: false);
      if (rows.isNotEmpty) {
        return rows;
      }
    }
    final pattern = RegExp(r'\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]');
    final rows = <LyricEntry>[];
    for (final rawLine in lrcText.split(RegExp(r'\r?\n'))) {
      final matches = pattern.allMatches(rawLine).toList(growable: false);
      if (matches.isEmpty) {
        continue;
      }
      final text = rawLine.replaceAll(pattern, '').trim();
      if (text.isEmpty) {
        continue;
      }
      for (final match in matches) {
        final minute = int.tryParse(match.group(1) ?? '') ?? 0;
        final second = int.tryParse(match.group(2) ?? '') ?? 0;
        final millisText =
            (match.group(3) ?? '').padRight(3, '0').substring(0, 3);
        final millis = int.tryParse(millisText) ?? 0;
        rows.add(
          LyricEntry(
            t: minute * 60 + second + millis / 1000,
            text: text,
          ),
        );
      }
    }
    rows.sort((left, right) => left.t.compareTo(right.t));
    return rows;
  }
}

class LyricsWordLine {
  LyricsWordLine({
    required this.startMs,
    required this.endMs,
    required this.words,
  });

  factory LyricsWordLine.fromJson(Map<String, dynamic> json) {
    final words = (json['words'] as List<dynamic>? ?? <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(LyricsWordTiming.fromJson)
        .toList(growable: false);
    return LyricsWordLine(
      startMs: readModelInt64(json, 'startMs'),
      endMs: readModelInt64(json, 'endMs'),
      words: words,
    );
  }

  final int startMs;
  final int endMs;
  final List<LyricsWordTiming> words;
}

class LyricsWordTiming {
  LyricsWordTiming({
    required this.startMs,
    required this.endMs,
    required this.text,
  });

  factory LyricsWordTiming.fromJson(Map<String, dynamic> json) {
    return LyricsWordTiming(
      startMs: readModelInt64(json, 'startMs'),
      endMs: readModelInt64(json, 'endMs'),
      text: readModelString(json, 'text'),
    );
  }

  final int startMs;
  final int endMs;
  final String text;
}

class LyricEntry {
  const LyricEntry({
    required this.t,
    required this.text,
  });

  final double t;
  final String text;
}
