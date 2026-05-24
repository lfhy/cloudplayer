// Shared model parsing helpers keep the typed DTO files compact and consistent.

import 'dart:convert';

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
  return '';
}

String prettyJson(Map<String, dynamic> value) {
  const encoder = JsonEncoder.withIndent('  ');
  return encoder.convert(value);
}
