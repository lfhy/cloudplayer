// Android media-session glue keeps system transport controls and notifications
// synced with the existing media_kit player without changing desktop playback.

import 'dart:async';
import 'dart:io';

import 'package:audio_service/audio_service.dart';
import 'package:cloudplayer_flutter/models/app_models.dart';

class CloudPlayerAudioSession {
  CloudPlayerAudioSession._();

  static final CloudPlayerAudioSession instance = CloudPlayerAudioSession._();

  _CloudPlayerAudioHandler? _handler;

  bool get enabled => Platform.isAndroid;

  Future<void> initialize() async {
    if (!enabled || _handler != null) {
      return;
    }
    _handler =
        await AudioService.init(
              builder: _CloudPlayerAudioHandler.new,
              config: const AudioServiceConfig(
                androidNotificationChannelId:
                    'dev.cloudplayer.cloudplayer_flutter.channel.audio',
                androidNotificationChannelName: 'CloudPlayer 播放控制',
                androidNotificationChannelDescription:
                    'CloudPlayer 后台播放与锁屏控制',
                androidStopForegroundOnPause: false,
              ),
            );
  }

  void bindController(CloudPlayerAudioCallbacks callbacks) {
    _handler?.bindCallbacks(callbacks);
  }

  void sync({
    required List<TrackRow> queue,
    required int queueIndex,
    required TrackRow? currentTrack,
    required bool playing,
    required Duration position,
    required Duration duration,
    required String playMode,
  }) {
    _handler?.syncState(
      queue: queue,
      queueIndex: queueIndex,
      currentTrack: currentTrack,
      playing: playing,
      position: position,
      duration: duration,
      playMode: playMode,
    );
  }
}

class CloudPlayerAudioCallbacks {
  const CloudPlayerAudioCallbacks({
    required this.onResume,
    required this.onPause,
    required this.onStop,
    required this.onSkipNext,
    required this.onSkipPrevious,
    required this.onSeek,
    required this.onSkipToQueueItem,
  });

  final Future<void> Function() onResume;
  final Future<void> Function() onPause;
  final Future<void> Function() onStop;
  final Future<void> Function() onSkipNext;
  final Future<void> Function() onSkipPrevious;
  final Future<void> Function(Duration position) onSeek;
  final Future<void> Function(int index) onSkipToQueueItem;
}

class _CloudPlayerAudioHandler extends BaseAudioHandler
    with QueueHandler, SeekHandler {
  CloudPlayerAudioCallbacks? _callbacks;

  void bindCallbacks(CloudPlayerAudioCallbacks callbacks) {
    _callbacks = callbacks;
  }

  void syncState({
    required List<TrackRow> queue,
    required int queueIndex,
    required TrackRow? currentTrack,
    required bool playing,
    required Duration position,
    required Duration duration,
    required String playMode,
  }) {
    final items = queue.map(_mediaItemForTrack).toList(growable: false);
    this.queue.add(items);
    final currentItem = currentTrack == null ? null : _mediaItemForTrack(currentTrack);
    mediaItem.add(currentItem);
    playbackState.add(
      playbackState.value.copyWith(
        controls: <MediaControl>[
          MediaControl.skipToPrevious,
          playing ? MediaControl.pause : MediaControl.play,
          MediaControl.skipToNext,
          MediaControl.stop,
        ],
        systemActions: const <MediaAction>{
          MediaAction.seek,
          MediaAction.seekForward,
          MediaAction.seekBackward,
        },
        androidCompactActionIndices: const <int>[0, 1, 2],
        processingState: _processingStateFor(currentItem, playing, position, duration),
        playing: playing,
        updatePosition: position,
        bufferedPosition: duration,
        speed: 1.0,
        queueIndex: queueIndex >= 0 ? queueIndex : null,
        repeatMode: _repeatModeFor(playMode),
        shuffleMode: playMode == 'shuffle'
            ? AudioServiceShuffleMode.all
            : AudioServiceShuffleMode.none,
      ),
    );
  }

  @override
  Future<void> play() async {
    await _callbacks?.onResume();
  }

  @override
  Future<void> pause() async {
    await _callbacks?.onPause();
  }

  @override
  Future<void> stop() async {
    await _callbacks?.onStop();
    await super.stop();
  }

  @override
  Future<void> skipToNext() async {
    await _callbacks?.onSkipNext();
  }

  @override
  Future<void> skipToPrevious() async {
    await _callbacks?.onSkipPrevious();
  }

  @override
  Future<void> seek(Duration position) async {
    await _callbacks?.onSeek(position);
  }

  @override
  Future<void> skipToQueueItem(int index) async {
    await _callbacks?.onSkipToQueueItem(index);
  }

  MediaItem _mediaItemForTrack(TrackRow track) {
    return MediaItem(
      id: track.localPath.isNotEmpty ? track.localPath : track.sourceId,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.durationMs > 0
          ? Duration(milliseconds: track.durationMs)
          : null,
      artUri: _artUriForTrack(track),
      extras: <String, dynamic>{
        'sourceId': track.sourceId,
        'localPath': track.localPath,
        'providerKey': track.providerKey,
        'kind': track.kind,
      },
    );
  }

  Uri? _artUriForTrack(TrackRow track) {
    if (track.coverCachePath.isNotEmpty) {
      return Uri.file(track.coverCachePath);
    }
    if (track.coverUrl.isNotEmpty) {
      return Uri.tryParse(track.coverUrl);
    }
    return null;
  }

  AudioProcessingState _processingStateFor(
    MediaItem? item,
    bool playing,
    Duration position,
    Duration duration,
  ) {
    if (item == null) {
      return AudioProcessingState.idle;
    }
    if (!playing &&
        duration > Duration.zero &&
        position >= duration &&
        duration.inMilliseconds > 0) {
      return AudioProcessingState.completed;
    }
    return AudioProcessingState.ready;
  }

  AudioServiceRepeatMode _repeatModeFor(String playMode) {
    return switch (playMode) {
      'one' => AudioServiceRepeatMode.one,
      'shuffle' => AudioServiceRepeatMode.all,
      _ => AudioServiceRepeatMode.all,
    };
  }
}
