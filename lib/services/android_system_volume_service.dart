// Android system volume service bridges Flutter playback UI to the platform
// media stream so mobile builds do not maintain a second app-local volume.

import 'dart:async';

import 'package:flutter/services.dart';

class AndroidSystemVolumeSnapshot {
  const AndroidSystemVolumeSnapshot({required this.current, required this.max});

  final int current;
  final int max;

  double get fraction {
    if (max <= 0) return 0;
    return (current / max).clamp(0.0, 1.0);
  }
}

class AndroidSystemVolumeService {
  AndroidSystemVolumeService._();

  static const MethodChannel _methodChannel = MethodChannel(
    'cloudplayer/android_system_volume',
  );
  static const EventChannel _eventChannel = EventChannel(
    'cloudplayer/android_system_volume_events',
  );

  static final AndroidSystemVolumeService instance =
      AndroidSystemVolumeService._();

  Stream<AndroidSystemVolumeSnapshot>? _stream;

  Future<AndroidSystemVolumeSnapshot> getSnapshot() async {
    final payload =
        await _methodChannel.invokeMapMethod<String, dynamic>('getVolume') ??
        const <String, dynamic>{};
    return _fromPayload(payload);
  }

  Future<AndroidSystemVolumeSnapshot> setFraction(double fraction) async {
    final payload =
        await _methodChannel.invokeMapMethod<String, dynamic>(
          'setVolume',
          <String, dynamic>{'fraction': fraction.clamp(0.0, 1.0)},
        ) ??
        const <String, dynamic>{};
    return _fromPayload(payload);
  }

  Stream<AndroidSystemVolumeSnapshot> watch() {
    return _stream ??= _eventChannel.receiveBroadcastStream().map((payload) {
      return _fromPayload(
        payload as Map<dynamic, dynamic>? ?? const <dynamic, dynamic>{},
      );
    }).asBroadcastStream();
  }

  AndroidSystemVolumeSnapshot _fromPayload(Map<dynamic, dynamic> payload) {
    return AndroidSystemVolumeSnapshot(
      current: (payload['current'] as num? ?? 0).toInt(),
      max: (payload['max'] as num? ?? 15).toInt(),
    );
  }
}
