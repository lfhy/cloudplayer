// Immersive-mode lyrics state lives in a separate controller part so playback
// and library concerns do not bloat the main app controller file.

part of 'app_controller.dart';

extension AppControllerLyrics on AppController {
  Future<void> toggleImmersive({bool? showLyrics}) async {
    if (immersiveOpen) {
      closeImmersive();
      return;
    }
    await openImmersive(showLyrics: showLyrics);
  }

  Future<void> openImmersive({bool? showLyrics}) async {
    if (miniModeOpen) {
      await setMiniMode(false);
    }
    final nextShowLyrics = showLyrics ?? !isMobileHost;
    if (immersiveOpen) {
      if (immersiveLyricsVisible != nextShowLyrics) {
        immersiveLyricsVisible = nextShowLyrics;
        _notifyStateChanged();
      }
      if (immersiveLyricsVisible) {
        await ensureLyricsForCurrentTrack(
          force: lyricsPayload == null && lyricsEntries.isEmpty,
        );
      }
      return;
    }
    immersiveLyricsVisible = nextShowLyrics;
    immersiveOpen = true;
    _notifyStateChanged();
    if (immersiveLyricsVisible) {
      await ensureLyricsForCurrentTrack(
        force: lyricsPayload == null && lyricsEntries.isEmpty,
      );
      return;
    }
    unawaited(
      ensureLyricsForCurrentTrack(
        force: lyricsPayload == null && lyricsEntries.isEmpty,
      ),
    );
  }

  void closeImmersive() {
    if (!immersiveOpen) return;
    immersiveOpen = false;
    immersiveLyricsVisible = false;
    _notifyStateChanged();
  }

  Future<void> toggleImmersiveLyricsView() async {
    if (!immersiveOpen || !isMobileHost) return;
    immersiveLyricsVisible = !immersiveLyricsVisible;
    _notifyStateChanged();
    if (!immersiveLyricsVisible) {
      return;
    }
    await ensureLyricsForCurrentTrack(
      force: lyricsPayload == null && lyricsEntries.isEmpty,
    );
  }

  Future<void> ensureLyricsForCurrentTrack({bool force = false}) async {
    final track = currentTrack;
    if (track == null) {
      _clearLyricsState();
      return;
    }
    final trackKey = _playableTrackKey(track);
    if (!force &&
        trackKey == lyricsTrackKey &&
        (lyricsPayload != null ||
            lyricsEntries.isNotEmpty ||
            lyricsError.isNotEmpty)) {
      return;
    }
    lyricsBusy = true;
    lyricsError = '';
    lyricsTrackKey = trackKey;
    _notifyStateChanged();
    try {
      final payload = await api.fetchSongLrcEnriched(
        track,
        durationMs: _lyricsDurationMs(track),
      );
      if (lyricsTrackKey != trackKey) {
        return;
      }
      lyricsPayload = payload;
      lyricsEntries = payload.entries();
      lyricsError = '';
    } catch (error) {
      if (lyricsTrackKey != trackKey) {
        return;
      }
      lyricsPayload = null;
      lyricsEntries = <LyricEntry>[];
      lyricsError = error.toString();
    } finally {
      if (lyricsTrackKey == trackKey) {
        lyricsBusy = false;
        _notifyStateChanged();
        if (desktopLyricsOpen) {
          unawaited(syncDesktopLyricsWindow(immediate: true));
        }
        unawaited(syncTrayState());
      }
    }
  }

  void _clearLyricsState() {
    lyricsBusy = false;
    lyricsPayload = null;
    lyricsEntries = <LyricEntry>[];
    lyricsTrackKey = '';
    lyricsError = '';
    _notifyStateChanged();
    if (desktopLyricsOpen) {
      unawaited(syncDesktopLyricsWindow(immediate: true));
    }
    unawaited(syncTrayState());
  }

  int _lyricsDurationMs(TrackRow track) {
    if (duration.inMilliseconds > 0) {
      return duration.inMilliseconds;
    }
    return track.durationMs;
  }

  String _playableTrackKey(TrackRow track) {
    if (track.localPath.trim().isNotEmpty) {
      return 'local:${track.localPath}';
    }
    return track.sourceId.trim();
  }
}
