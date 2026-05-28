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
  Future<void> Function()? _systemBackHandler;

  void setSystemBackHandler(Future<void> Function()? handler) {
    _systemBackHandler = handler;
    if (!Platform.isAndroid) {
      return;
    }
    if (handler == null) {
      _channel.setMethodCallHandler(null);
      return;
    }
    _channel.setMethodCallHandler((call) async {
      switch (call.method) {
        case 'systemBack':
          await _systemBackHandler?.call();
          return null;
        default:
          throw MissingPluginException(
            'Unhandled android_app_host call: ${call.method}',
          );
      }
    });
  }

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
