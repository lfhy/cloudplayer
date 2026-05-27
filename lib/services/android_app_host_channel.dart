// Android app-host channel exposes backgrounding actions that Flutter cannot
// express directly through the desktop-first shell.

import 'dart:io';

import 'package:flutter/services.dart';

class AndroidAppHostChannel {
  AndroidAppHostChannel._();

  static final AndroidAppHostChannel instance = AndroidAppHostChannel._();
  static const MethodChannel _channel = MethodChannel(
    'cloudplayer/android_app_host',
  );

  Future<void> moveTaskToBack() async {
    if (!Platform.isAndroid) {
      return;
    }
    await _channel.invokeMethod<bool>('moveTaskToBack');
  }

  Future<bool> isProbablyEmulator() async {
    if (!Platform.isAndroid) {
      return false;
    }
    return await _channel.invokeMethod<bool>('isProbablyEmulator') ?? false;
  }
}
