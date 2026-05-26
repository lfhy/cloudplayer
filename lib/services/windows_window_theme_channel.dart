// Windows window-theme channel keeps the native title bar brightness aligned
// with the in-app Fluent theme instead of the OS-wide app theme setting.

import 'dart:io';

import 'package:flutter/services.dart';

class WindowsWindowThemeChannel {
  WindowsWindowThemeChannel._();

  static final WindowsWindowThemeChannel instance =
      WindowsWindowThemeChannel._();

  static const MethodChannel _channel = MethodChannel(
    'cloudplayer/windows_window_theme',
  );

  String? _lastSignature;

  Future<void> sync({
    required bool darkMode,
    required int captionColor,
    required int textColor,
  }) async {
    if (!Platform.isWindows) return;
    final signature = '$darkMode:$captionColor:$textColor';
    if (_lastSignature == signature) return;
    _lastSignature = signature;
    await _channel.invokeMethod<void>('setWindowTheme', <String, Object>{
      'darkMode': darkMode,
      'captionColor': captionColor,
      'textColor': textColor,
    });
  }
}
