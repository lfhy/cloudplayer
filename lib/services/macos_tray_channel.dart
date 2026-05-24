// macOS tray channel keeps the native menu-bar item synchronized with Flutter
// playback state and routes native playback commands back into Dart.

import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';

typedef MacosTrayEventHandler =
    Future<void> Function(String method, Map<String, dynamic> payload);

class MacosTrayChannel {
  MacosTrayChannel._();

  static final MacosTrayChannel instance = MacosTrayChannel._();

  final MethodChannel _channel = const MethodChannel('cloudplayer/macos_tray');
  bool _bound = false;
  String _lastSignature = '';

  Future<void> bind(MacosTrayEventHandler handler) async {
    if (_bound || !Platform.isMacOS) return;
    _bound = true;
    _channel.setMethodCallHandler((call) async {
      final payload = Map<String, dynamic>.from(
        call.arguments as Map<dynamic, dynamic>? ?? const <dynamic, dynamic>{},
      );
      await handler(call.method, payload);
    });
  }

  Future<void> syncState(Map<String, dynamic> payload) async {
    if (!Platform.isMacOS) return;
    final signature = jsonEncode(payload);
    if (signature == _lastSignature) return;
    _lastSignature = signature;
    await _channel.invokeMethod<void>('syncState', payload);
  }

  Future<void> hideMainWindow() async {
    if (!Platform.isMacOS) return;
    await _channel.invokeMethod<void>('hideMainWindow');
  }

  Future<void> showMainWindow() async {
    if (!Platform.isMacOS) return;
    await _channel.invokeMethod<void>('showMainWindow');
  }

  Future<void> terminateApp() async {
    if (!Platform.isMacOS) return;
    await _channel.invokeMethod<void>('terminateApp');
  }

  void clearCache() {
    _lastSignature = '';
  }
}
