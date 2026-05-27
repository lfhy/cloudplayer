// Android volume integration keeps mobile playback aligned with the platform
// media stream instead of persisting a separate in-app volume value.

part of 'app_controller.dart';

extension AppControllerAndroidVolume on AppController {
  bool get usesPlatformSystemVolume => isAndroidHost;

  double get effectiveVolumeFraction {
    if (usesPlatformSystemVolume) {
      if (_androidSystemVolumeMax <= 0) return 0;
      return (_androidSystemVolume / _androidSystemVolumeMax).clamp(0.0, 1.0);
    }
    return (settings?.volume ?? 0.7).clamp(0.0, 1.0);
  }

  int get systemVolumeStep => _androidSystemVolume;

  int get systemVolumeMaxStep => _androidSystemVolumeMax;

  Future<void> _bindAndroidSystemVolume() async {
    final snapshot = await AndroidSystemVolumeService.instance.getSnapshot();
    _applyAndroidSystemVolume(snapshot, notify: false);
    _androidSystemVolumeSub?.cancel();
    _androidSystemVolumeSub = AndroidSystemVolumeService.instance
        .watch()
        .listen((next) => _applyAndroidSystemVolume(next));
  }

  Future<void> _configureAndroidAudioOutput() async {
    if (!usesPlatformSystemVolume) return;
    if (!await AndroidAppHostChannel.instance.isProbablyEmulator()) {
      return;
    }
    final platform = _player.platform;
    if (platform is! NativePlayer) {
      return;
    }
    try {
      await platform.setProperty('ao', 'audiotrack');
      await platform.setProperty('audio-channels', 'stereo');
    } catch (_) {
      // Keep the default backend if this media_kit build does not expose the override.
    }
  }

  Future<void> setSystemVolumeFraction(double value) async {
    if (!usesPlatformSystemVolume) return;
    final snapshot = await AndroidSystemVolumeService.instance.setFraction(
      value,
    );
    _applyAndroidSystemVolume(snapshot);
  }

  Future<void> toggleSystemMute() async {
    if (!usesPlatformSystemVolume) return;
    if (effectiveVolumeFraction <= 0.001) {
      final fallback = _lastNonZeroVolume > 0.001 ? _lastNonZeroVolume : 0.7;
      await setSystemVolumeFraction(fallback);
      return;
    }
    if (effectiveVolumeFraction > 0.001) {
      _lastNonZeroVolume = effectiveVolumeFraction;
    }
    await setSystemVolumeFraction(0);
  }

  void _applyAndroidSystemVolume(
    AndroidSystemVolumeSnapshot snapshot, {
    bool notify = true,
  }) {
    _androidSystemVolume = snapshot.current;
    _androidSystemVolumeMax = snapshot.max <= 0 ? 15 : snapshot.max;
    if (snapshot.fraction > 0.001) {
      _lastNonZeroVolume = snapshot.fraction;
    }
    if (notify) {
      _notifyStateChanged();
    }
  }
}
