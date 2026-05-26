// Desktop-lyrics control keeps the macOS overlay window synchronized with the
// shared playback and lyric state without bloating the main controller file.

part of 'app_controller.dart';

extension AppControllerDesktopLyrics on AppController {
  bool get desktopLyricsOpen =>
      isDesktopHost && (settings?.desktopLyricsVisible ?? false);

  Future<void> bindDesktopLyrics() async {
    if (!isDesktopHost) return;
    if (_desktopLyricsBound) return;
    _desktopLyricsBound = true;
    DesktopLyricsChannel.instance.bind(_handleDesktopLyricsEvent);
  }

  Future<void> toggleDesktopLyrics() async {
    if (!isDesktopHost) return;
    final current = settings;
    if (current == null) return;
    await updateSettings(
      current.copyWith(desktopLyricsVisible: !current.desktopLyricsVisible),
    );
  }

  Future<void> toggleDesktopLyricsLocked() async {
    if (!isDesktopHost) return;
    final current = settings;
    if (current == null) return;
    await _saveDesktopLyricsSettings(
      current.copyWith(desktopLyricsLocked: !current.desktopLyricsLocked),
      syncWindow: true,
    );
  }

  Future<void> resetDesktopLyricsBounds() async {
    if (!isDesktopHost) return;
    await api.resetDesktopLyricsBounds();
    await DesktopLyricsChannel.instance.resetBounds();
    settings = await api.getSettings();
    _notifyStateChanged();
    await syncDesktopLyricsWindow(immediate: true);
    statusMessage = '桌面歌词位置已重置。';
    _notifyStateChanged();
  }

  Future<void> syncDesktopLyricsWindow({bool immediate = false}) async {
    if (!isDesktopHost) return;
    await bindDesktopLyrics();
    _desktopLyricsSyncTimer?.cancel();
    if (settings == null || !desktopLyricsOpen) {
      await DesktopLyricsChannel.instance.hide();
      return;
    }
    if (currentTrack != null &&
        lyricsEntries.isEmpty &&
        lyricsPayload == null &&
        !lyricsBusy) {
      unawaited(ensureLyricsForCurrentTrack());
    }
    if (immediate) {
      await _pushDesktopLyricsState();
      return;
    }
    _desktopLyricsSyncTimer = Timer(const Duration(milliseconds: 40), () {
      unawaited(_pushDesktopLyricsState());
    });
  }

  Future<void> _pushDesktopLyricsState() async {
    if (!isDesktopHost) return;
    final current = settings;
    if (current == null || !current.desktopLyricsVisible) {
      await DesktopLyricsChannel.instance.hide();
      return;
    }
    final payload = buildDesktopLyricsState(
      settings: current,
      track: currentTrack,
      entries: lyricsEntries,
      payload: lyricsPayload,
      position: position,
      isPlaying: isPlaying,
    );
    await DesktopLyricsChannel.instance.applyState(payload);
  }

  Future<void> _handleDesktopLyricsEvent(
    String method,
    Map<String, dynamic> payload,
  ) async {
    if (!isDesktopHost) return;
    switch (method) {
      case 'closed':
        await _handleDesktopLyricsClosed();
        return;
      case 'lockChanged':
        await _handleDesktopLyricsLockChanged(payload);
        return;
      case 'scaleChanged':
        await _handleDesktopLyricsScaleChanged(payload);
        return;
      case 'boundsChanged':
        _handleDesktopLyricsBoundsChanged(payload);
        return;
      case 'requestSync':
        await syncDesktopLyricsWindow(immediate: true);
        return;
      default:
        return;
    }
  }

  Future<void> _handleDesktopLyricsClosed() async {
    if (!isDesktopHost) return;
    final current = settings;
    if (current == null || !current.desktopLyricsVisible) return;
    settings = current.copyWith(desktopLyricsVisible: false);
    _notifyStateChanged();
    await api.saveSettings(settings!);
  }

  Future<void> _handleDesktopLyricsLockChanged(
    Map<String, dynamic> payload,
  ) async {
    if (!isDesktopHost) return;
    final current = settings;
    if (current == null) return;
    final locked = _payloadBool(payload, 'locked', fallback: true);
    if (locked == current.desktopLyricsLocked) return;
    await _saveDesktopLyricsSettings(
      current.copyWith(desktopLyricsLocked: locked),
      syncWindow: false,
    );
  }

  Future<void> _handleDesktopLyricsScaleChanged(
    Map<String, dynamic> payload,
  ) async {
    if (!isDesktopHost) return;
    final current = settings;
    if (current == null) return;
    final scale = _payloadDouble(payload, 'scale', fallback: 1).clamp(0.5, 2.5);
    if ((scale - current.desktopLyricsScale).abs() < 0.001) return;
    await _saveDesktopLyricsSettings(
      current.copyWith(desktopLyricsScale: scale),
      syncWindow: false,
    );
  }

  void _handleDesktopLyricsBoundsChanged(Map<String, dynamic> payload) {
    if (!isDesktopHost) return;
    final current = settings;
    if (current == null) return;
    final next = current.copyWith(
      desktopLyricsX: _payloadInt(payload, 'x') ?? current.desktopLyricsX,
      desktopLyricsY: _payloadInt(payload, 'y') ?? current.desktopLyricsY,
      desktopLyricsWidth:
          _payloadInt(payload, 'width') ?? current.desktopLyricsWidth,
      desktopLyricsHeight:
          _payloadInt(payload, 'height') ?? current.desktopLyricsHeight,
    );
    settings = next;
    _desktopLyricsPersistTimer?.cancel();
    _desktopLyricsPersistTimer = Timer(
      const Duration(milliseconds: 420),
      () => unawaited(api.saveSettings(next)),
    );
  }

  Future<void> _saveDesktopLyricsSettings(
    AppSettings next, {
    required bool syncWindow,
  }) async {
    if (!isDesktopHost) return;
    settings = next;
    _notifyStateChanged();
    if (syncWindow) {
      await syncDesktopLyricsWindow(immediate: true);
    }
    await api.saveSettings(next);
  }

  bool _payloadBool(
    Map<String, dynamic> payload,
    String key, {
    required bool fallback,
  }) {
    final value = payload[key];
    if (value is bool) return value;
    if (value is num) return value != 0;
    if (value is String) return value == 'true' || value == '1';
    return fallback;
  }

  int? _payloadInt(Map<String, dynamic> payload, String key) {
    final value = payload[key];
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value);
    return null;
  }

  double _payloadDouble(
    Map<String, dynamic> payload,
    String key, {
    required double fallback,
  }) {
    final value = payload[key];
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? fallback;
    return fallback;
  }
}
