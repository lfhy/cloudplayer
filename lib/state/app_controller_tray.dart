// macOS tray state stays in its own controller part so menu-bar behavior does
// not bloat the main controller or the desktop-lyrics integration.

part of 'app_controller.dart';

const int _trayLabelMaxLength = 28;

extension AppControllerTray on AppController {
  Future<void> bindTray() async {
    if (!isDesktopHost) return;
    await MacosTrayChannel.instance.bind(_handleTrayEvent);
  }

  Future<void> syncTrayState() async {
    if (!isDesktopHost) return;
    await bindTray();
    final track = currentTrack;
    await MacosTrayChannel.instance.syncState(<String, dynamic>{
      'themeMode': _trayThemeMode(),
      'title': _trayTitle(track),
      'subtitle': _traySubtitle(track),
      'label': _trayLabel(track),
      'coverSource': _trayCoverSource(track),
      'playing': isPlaying,
      'hasTrack': track != null,
      'hasPrev': track != null && canNavigateQueue,
      'hasNext': track != null && canNavigateQueue,
      'progressValue': _trayProgressValue(track),
    });
  }

  String _trayThemeMode() {
    return settings?.appThemeMode == 'light' ? 'light' : 'dark';
  }

  Future<void> _handleTrayEvent(
    String method,
    Map<String, dynamic> payload,
  ) async {
    if (!isDesktopHost) return;
    if (method != 'command') return;
    switch (payload['action']) {
      case 'prev':
        await playPrevious();
        return;
      case 'toggle':
        await togglePlayPause();
        return;
      case 'next':
        await playNext();
        return;
      case 'seek':
        final value = (payload['value'] as num?)?.toDouble();
        if (value == null || duration.inMilliseconds <= 0) return;
        await seekTo(
          Duration(
            milliseconds:
                (duration.inMilliseconds * (value.clamp(0, 1000) / 1000))
                    .round(),
          ),
        );
        return;
      default:
        return;
    }
  }

  String _trayTitle(TrackRow? track) {
    final title = track?.title.trim() ?? '';
    return title.isEmpty ? 'CloudPlayer' : title;
  }

  String _traySubtitle(TrackRow? track) {
    final artist = track?.artist.trim() ?? '';
    if (artist.isNotEmpty) return artist;
    return track == null ? '从菜单栏快速控制当前播放' : '从菜单栏快速控制当前播放';
  }

  String _trayLabel(TrackRow? track) {
    if (!isPlaying || track == null) return '';
    final current = settings;
    if (current != null) {
      final projection = buildDesktopLyricsState(
        settings: current,
        track: track,
        entries: lyricsEntries,
        payload: lyricsPayload,
        position: position,
        isPlaying: isPlaying,
      );
      final activeSlot = projection['activeSlot'] as int? ?? 1;
      final activeLine =
          (activeSlot == 2 ? projection['line2'] : projection['line1'])
              ?.toString();
      final normalized = _normalizeTrayLabel(activeLine ?? '');
      if (normalized.isNotEmpty) {
        return normalized;
      }
    }
    return _normalizeTrayLabel(track.title);
  }

  String _trayCoverSource(TrackRow? track) {
    if (track == null) return '';
    final cached = track.coverCachePath.trim();
    if (cached.isNotEmpty) {
      return cached;
    }
    final coverUrl = track.coverUrl.trim();
    if (coverUrl.isEmpty) {
      return '';
    }
    final mediaProxyBase = api.mediaProxyBase.trim();
    if (mediaProxyBase.isEmpty ||
        coverUrl.startsWith('file://') ||
        coverUrl.startsWith('http://127.0.0.1:') ||
        coverUrl.startsWith('http://localhost:')) {
      return coverUrl;
    }
    return '$mediaProxyBase/__remote_media__?url=${Uri.encodeComponent(coverUrl)}';
  }

  double _trayProgressValue(TrackRow? track) {
    final totalMs = duration.inMilliseconds > 0
        ? duration.inMilliseconds
        : (track?.durationMs ?? 0);
    if (totalMs <= 0) return 0;
    return ((position.inMilliseconds / totalMs) * 1000).clamp(0, 1000);
  }

  String _normalizeTrayLabel(String value) {
    final normalized = value
        .replaceAll('\u00A0', ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    if (normalized.isEmpty || normalized == '—') {
      return '';
    }
    final chars = normalized.runes.toList(growable: false);
    if (chars.length <= _trayLabelMaxLength) {
      return normalized;
    }
    return '${String.fromCharCodes(chars.take(_trayLabelMaxLength - 1))}…';
  }
}
