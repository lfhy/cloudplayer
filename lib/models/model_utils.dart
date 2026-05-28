// Shared model parsing helpers keep the typed DTO files compact and consistent.

import 'dart:convert';

const List<String> musicSourceProviderChoiceOrder = <String>[
  'pjmp3',
  'gequhai',
  'kugou',
  'netease',
];

const List<String> playbackFallbackProviderDefaultOrder = <String>[
  'kugou',
  'pjmp3',
  'netease',
  'gequhai',
];

String readModelString(
  Map<String, dynamic> json,
  String key, {
  String fallback = '',
}) {
  final value = json[key];
  if (value == null) return fallback;
  return value.toString();
}

bool readModelBool(
  Map<String, dynamic> json,
  String key, {
  bool fallback = false,
}) {
  final value = json[key];
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) return value == 'true' || value == '1';
  return fallback;
}

double readModelDouble(
  Map<String, dynamic> json,
  String key, {
  double fallback = 0,
}) {
  final value = json[key];
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

int readModelInt(Map<String, dynamic> json, String key, {int fallback = 0}) {
  final value = json[key];
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

int readModelInt64(Map<String, dynamic> json, String key, {int fallback = 0}) {
  return readModelInt(json, key, fallback: fallback);
}

int? readNullableModelInt64(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value == null) return null;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

String sourceProviderKeyForSourceId(String sourceId) {
  if (sourceId.startsWith('kugou:')) return 'kugou';
  if (sourceId.startsWith('netease:')) return 'netease';
  if (sourceId.startsWith('pjmp3:')) return 'pjmp3';
  if (sourceId.startsWith('gequhai:')) return 'gequhai';
  return '';
}

String musicSourceProviderLabel(String providerKey) {
  switch (providerKey.trim().toLowerCase()) {
    case 'pjmp3':
      return '泡椒音乐源';
    case 'gequhai':
      return '歌曲海源';
    case 'kugou':
      return '酷狗概念版';
    case 'netease':
      return '网易云';
    default:
      return providerKey;
  }
}

List<String> normalizedPlaybackFallbackProviders(String raw) {
  final seen = <String>{};
  final ordered = <String>[];
  for (final part in raw.split(',')) {
    final key = part.trim().toLowerCase();
    if (!playbackFallbackProviderDefaultOrder.contains(key) || !seen.add(key)) {
      continue;
    }
    ordered.add(key);
  }
  for (final key in playbackFallbackProviderDefaultOrder) {
    if (seen.add(key)) {
      ordered.add(key);
    }
  }
  return ordered;
}

String normalizedPlaybackFallbackChain(String raw) {
  return normalizedPlaybackFallbackProviders(raw).join(',');
}

String prettyJson(Map<String, dynamic> value) {
  const encoder = JsonEncoder.withIndent('  ');
  return encoder.convert(value);
}
