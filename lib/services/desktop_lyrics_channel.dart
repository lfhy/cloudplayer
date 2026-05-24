// Desktop-lyrics platform channel keeps the macOS overlay window isolated from
// the Flutter widget tree and exposes a small command/event surface.

import 'dart:io';

import 'package:flutter/services.dart';

typedef DesktopLyricsEventHandler =
    Future<void> Function(String method, Map<String, dynamic> payload);

class DesktopLyricsChannel {
  DesktopLyricsChannel._();

  static final DesktopLyricsChannel instance = DesktopLyricsChannel._();

  final MethodChannel _channel = const MethodChannel(
    'cloudplayer/desktop_lyrics',
  );

  DesktopLyricsEventHandler? _eventHandler;
  bool _bound = false;

  void bind(DesktopLyricsEventHandler handler) {
    _eventHandler = handler;
    if (_bound || !Platform.isMacOS) return;
    _bound = true;
    _channel.setMethodCallHandler((call) async {
      final payload = switch (call.arguments) {
        final Map<Object?, Object?> value =>
          value.map<String, dynamic>((key, data) {
            return MapEntry(key.toString(), data);
          }),
        _ => <String, dynamic>{},
      };
      await _eventHandler?.call(call.method, payload);
      return null;
    });
  }

  Future<void> applyState(Map<String, dynamic> payload) async {
    if (!Platform.isMacOS) return;
    await _channel.invokeMethod<void>('applyState', payload);
  }

  Future<void> hide() async {
    if (!Platform.isMacOS) return;
    await _channel.invokeMethod<void>('hide');
  }

  Future<Map<String, dynamic>> resetBounds() async {
    if (!Platform.isMacOS) return <String, dynamic>{};
    final payload = await _channel.invokeMapMethod<String, dynamic>(
      'resetBounds',
    );
    return payload ?? <String, dynamic>{};
  }
}
