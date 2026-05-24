// Playback state and queue mutations live in a separate part so the main app controller stays within repository size limits.

part of 'app_controller.dart';

extension AppControllerPlayback on AppController {
  String get currentPlayMode => settings?.playMode ?? 'loop_list';

  bool get canNavigateQueue => playQueue.isNotEmpty;

  bool get isEffectivelyMuted => (settings?.volume ?? 0) <= 0.001;

  Future<void> playTrack(
    TrackRow track, {
    List<TrackRow>? queue,
    int? index,
  }) async {
    final nextQueue = queue ?? <TrackRow>[track];
    playQueue = nextQueue;
    playIndex = index ?? nextQueue.indexOf(track);
    if (playIndex < 0) {
      playIndex = 0;
    }
    _notifyStateChanged();
    unawaited(_persistPlaybackSnapshot(force: true));
    await _openCurrentTrack();
  }

  Future<void> playDailyAll() async {
    final rows = dailyRecommendation?.rows ?? <TrackRow>[];
    if (rows.isNotEmpty) {
      await playTrack(rows.first, queue: rows, index: 0);
    }
  }

  Future<void> playPlaylistAll() async {
    if (playlistTracks.isNotEmpty) {
      await playTrack(playlistTracks.first, queue: playlistTracks, index: 0);
    }
  }

  Future<void> playFromQueueIndex(int index) async {
    if (playQueue.isEmpty) return;
    final nextIndex = index.clamp(0, playQueue.length - 1);
    playIndex = nextIndex;
    _notifyStateChanged();
    unawaited(_persistPlaybackSnapshot(force: true));
    await _openCurrentTrack();
  }

  Future<void> togglePlayPause() async {
    if (currentTrack == null) return;
    if (!isPlaying && _player.state.playlist.medias.isEmpty) {
      await playFromQueueIndex(playIndex < 0 ? 0 : playIndex);
      return;
    }
    if (isPlaying) {
      await _player.pause();
    } else {
      await _player.play();
    }
  }

  Future<void> playNext() async {
    if (playQueue.isEmpty) return;
    if (currentPlayMode == 'shuffle' && playQueue.length > 1) {
      await playFromQueueIndex(_randomNextIndex());
      return;
    }
    final nextIndex = (playIndex + 1) % playQueue.length;
    await playFromQueueIndex(nextIndex);
  }

  Future<void> playPrevious() async {
    if (playQueue.isEmpty) return;
    final previousIndex = (playIndex - 1 + playQueue.length) % playQueue.length;
    await playFromQueueIndex(previousIndex);
  }

  Future<void> handlePlaybackCompleted() async {
    if (playQueue.isEmpty) return;
    switch (currentPlayMode) {
      case 'one':
        await _player.seek(Duration.zero);
        await _player.play();
        return;
      case 'shuffle':
        await playFromQueueIndex(_randomNextIndex());
        return;
      default:
        await playNext();
    }
  }

  Future<void> seekTo(Duration value) async {
    await _player.seek(value);
  }

  Future<void> setVolume(double value, {bool persist = true}) async {
    final current = settings;
    if (current == null) return;
    final nextVolume = value.clamp(0.0, 1.0);
    if (nextVolume > 0.001) {
      _lastNonZeroVolume = nextVolume;
    }
    settings = current.copyWith(volume: nextVolume);
    await _player.setVolume(nextVolume * 100);
    _notifyStateChanged();
    if (persist) {
      await api.saveSettings(settings!);
    }
  }

  Future<void> toggleMute() async {
    if (isEffectivelyMuted) {
      await setVolume(_lastNonZeroVolume > 0.001 ? _lastNonZeroVolume : 0.7);
      return;
    }
    await setVolume(0);
  }

  Future<void> setPlayMode(String mode) async {
    final current = settings;
    if (current == null) return;
    settings = current.copyWith(playMode: mode);
    _notifyStateChanged();
    await api.saveSettings(settings!);
  }

  Future<void> removeCurrentFromQueue() async {
    if (playQueue.isEmpty || currentTrack == null) return;
    final nextQueue = List<TrackRow>.from(playQueue)..removeAt(playIndex);
    if (nextQueue.isEmpty) {
      playQueue = <TrackRow>[];
      playIndex = -1;
      position = Duration.zero;
      duration = Duration.zero;
      isPlaying = false;
      await _player.stop();
      _clearLyricsState();
      await _clearPersistedPlaybackSnapshot();
      unawaited(syncDesktopLyricsWindow(immediate: true));
      unawaited(syncTrayState());
      return;
    }
    playQueue = nextQueue;
    if (playIndex >= playQueue.length) {
      playIndex = playQueue.length - 1;
    }
    _notifyStateChanged();
    unawaited(_persistPlaybackSnapshot(force: true));
    await _openCurrentTrack();
  }

  Future<void> appendTrackToPlaylist(TrackRow track, int playlistId) async {
    await api.appendPlaylistItems(playlistId, <TrackRow>[track]);
    statusMessage = '已把 ${track.title} 添加到歌单。';
    if (selectedPlaylist?.id == playlistId) {
      await loadSelectedPlaylist();
    }
    _notifyStateChanged();
  }

  Future<void> restorePersistedPlayback() async {
    final current = settings;
    if (current == null || current.playQueue.isEmpty) {
      return;
    }
    final restoredQueue = <TrackRow>[];
    for (final track in current.playQueue) {
      if (track.localPath.isNotEmpty &&
          !await api.localPathAccessible(track.localPath)) {
        continue;
      }
      restoredQueue.add(track);
    }
    if (restoredQueue.isEmpty) {
      await _clearPersistedPlaybackSnapshot();
      return;
    }
    var restoredIndex = current.playQueueIndex.clamp(
      0,
      restoredQueue.length - 1,
    );
    final savedTrackKey = current.playbackTrackKey.trim();
    if (savedTrackKey.isNotEmpty) {
      final matchedIndex = restoredQueue.indexWhere(
        (track) => _playableTrackKey(track) == savedTrackKey,
      );
      if (matchedIndex >= 0) {
        restoredIndex = matchedIndex;
      }
    }
    playQueue = restoredQueue;
    playIndex = restoredIndex;
    position = Duration(milliseconds: current.playbackPositionMs);
    final seededDurationMs = current.playbackDurationMs > 0
        ? current.playbackDurationMs
        : restoredQueue[restoredIndex].durationMs;
    duration = Duration(milliseconds: seededDurationMs);
    _notifyStateChanged();
    _restoringPlaybackSnapshot = true;
    try {
      await _openCurrentTrack(
        autoplay: false,
        recordRecent: false,
        initialPosition: position,
        showStatus: false,
      );
    } catch (error) {
      statusMessage = '恢复播放进度失败：$error';
      _notifyStateChanged();
    } finally {
      _restoringPlaybackSnapshot = false;
      await _persistPlaybackSnapshot(force: true);
    }
  }

  Future<void> _openCurrentTrack({
    bool autoplay = true,
    bool recordRecent = true,
    Duration initialPosition = Duration.zero,
    bool showStatus = true,
  }) async {
    final track = currentTrack;
    if (track == null) return;
    try {
      final media = await _resolveMedia(track);
      await _player.open(media, play: autoplay);
      if (initialPosition > Duration.zero) {
        await _player.seek(initialPosition);
      }
      if (recordRecent) {
        await api.recordRecentPlay(track);
      }
      if ((settings?.autoCacheOnPlay ?? false) && track.sourceId.isNotEmpty) {
        unawaited(api.enqueueDownload(track));
      }
      unawaited(ensureLyricsForCurrentTrack(force: true));
      unawaited(syncDesktopLyricsWindow(immediate: true));
      unawaited(syncTrayState());
      if (recordRecent) {
        await refreshRecent();
      }
      await _persistPlaybackSnapshot(force: true);
      if (showStatus) {
        statusMessage = autoplay ? '正在播放 ${track.title}' : '已加载 ${track.title}';
      }
      _notifyStateChanged();
    } catch (error) {
      statusMessage = error.toString();
      _notifyStateChanged();
    }
  }

  Future<Media> _resolveMedia(TrackRow track) async {
    if (track.localPath.isNotEmpty) {
      return Media(track.localPath);
    }
    final resolved = await api.resolveOnlinePlay(track);
    if (resolved.kind == 'file' && resolved.path.isNotEmpty) {
      return Media(resolved.path);
    }
    if (resolved.url.isNotEmpty) {
      return Media(resolved.url);
    }
    throw StateError('无法解析播放地址。');
  }

  void _wirePlayer() {
    _player.stream.playing.listen((value) {
      isPlaying = value;
      _notifyStateChanged();
      unawaited(_persistPlaybackSnapshot(force: true));
      if (desktopLyricsOpen) {
        unawaited(syncDesktopLyricsWindow());
      }
      unawaited(syncTrayState());
    });
    _player.stream.position.listen((value) {
      position = value;
      _notifyStateChanged();
      unawaited(_persistPlaybackSnapshot());
      if (desktopLyricsOpen) {
        unawaited(syncDesktopLyricsWindow());
      }
      unawaited(syncTrayState());
    });
    _player.stream.duration.listen((value) {
      duration = value;
      _notifyStateChanged();
      unawaited(_persistPlaybackSnapshot(force: true));
      if (desktopLyricsOpen) {
        unawaited(syncDesktopLyricsWindow());
      }
      unawaited(syncTrayState());
    });
    _player.stream.completed.listen((value) {
      if (value) {
        unawaited(handlePlaybackCompleted());
      }
    });
  }

  int _randomNextIndex() {
    if (playQueue.length <= 1) return 0;
    var nextIndex = playIndex;
    var guard = 0;
    while (nextIndex == playIndex && guard < 12) {
      nextIndex = math.Random().nextInt(playQueue.length);
      guard += 1;
    }
    return nextIndex;
  }

  Future<void> _clearPersistedPlaybackSnapshot() async {
    final current = settings;
    if (current == null) return;
    settings = current.copyWith(
      playQueue: <TrackRow>[],
      playQueueIndex: 0,
      playbackTrackKey: '',
      playbackPositionMs: 0,
      playbackDurationMs: 0,
    );
    _rememberPersistedPlaybackState(
      trackKey: '',
      secondBucket: -1,
      durationMs: 0,
      playQueueIndex: 0,
      playQueueLength: 0,
    );
    await api.savePlaybackSnapshot(
      playQueue: const <TrackRow>[],
      playQueueIndex: 0,
      playbackTrackKey: '',
      playbackPositionMs: 0,
      playbackDurationMs: 0,
    );
  }

  Future<void> _persistPlaybackSnapshot({bool force = false}) async {
    final current = settings;
    if (current == null || _restoringPlaybackSnapshot) {
      return;
    }
    final queue = List<TrackRow>.from(playQueue);
    final queueLength = queue.length;
    final queueIndex = queueLength == 0
        ? 0
        : (playIndex < 0 ? 0 : playIndex.clamp(0, queueLength - 1));
    final selectedTrack = queueLength == 0 ? null : queue[queueIndex];
    final trackKey = selectedTrack == null
        ? ''
        : _playableTrackKey(selectedTrack);
    final durationMs = selectedTrack == null
        ? 0
        : (duration.inMilliseconds > 0
              ? duration.inMilliseconds
              : selectedTrack.durationMs);
    final rawPositionMs = selectedTrack == null ? 0 : position.inMilliseconds;
    final positionMs = durationMs > 0
        ? rawPositionMs.clamp(0, durationMs)
        : math.max(0, rawPositionMs);
    final secondBucket = selectedTrack == null ? -1 : positionMs ~/ 1000;
    if (!force &&
        trackKey == _lastPersistedPlaybackTrackKey &&
        secondBucket == _lastPersistedPlaybackSecond &&
        durationMs == _lastPersistedPlaybackDurationMs &&
        queueIndex == _lastPersistedPlaybackQueueIndex &&
        queueLength == _lastPersistedPlaybackQueueLength) {
      return;
    }
    settings = current.copyWith(
      playQueue: queue,
      playQueueIndex: queueIndex,
      playbackTrackKey: trackKey,
      playbackPositionMs: positionMs,
      playbackDurationMs: durationMs,
    );
    _rememberPersistedPlaybackState(
      trackKey: trackKey,
      secondBucket: secondBucket,
      durationMs: durationMs,
      playQueueIndex: queueIndex,
      playQueueLength: queueLength,
    );
    await api.savePlaybackSnapshot(
      playQueue: queue,
      playQueueIndex: queueIndex,
      playbackTrackKey: trackKey,
      playbackPositionMs: positionMs,
      playbackDurationMs: durationMs,
    );
  }

  void _rememberPersistedPlaybackState({
    required String trackKey,
    required int secondBucket,
    required int durationMs,
    required int playQueueIndex,
    required int playQueueLength,
  }) {
    _lastPersistedPlaybackTrackKey = trackKey;
    _lastPersistedPlaybackSecond = secondBucket;
    _lastPersistedPlaybackDurationMs = durationMs;
    _lastPersistedPlaybackQueueIndex = playQueueIndex;
    _lastPersistedPlaybackQueueLength = playQueueLength;
  }
}
