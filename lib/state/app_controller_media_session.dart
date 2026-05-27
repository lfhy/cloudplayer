// Android media-session sync is kept in its own part so playback logic can
// publish lock-screen and notification controls without bloating the core file.

part of 'app_controller.dart';

extension AppControllerMediaSession on AppController {
  void _bindAudioSession() {
    _audioSession.bindController(
      CloudPlayerAudioCallbacks(
        onResume: _resumeFromAudioSession,
        onPause: _pauseFromAudioSession,
        onStop: _pauseFromAudioSession,
        onSkipNext: playNext,
        onSkipPrevious: playPrevious,
        onSeek: seekTo,
        onSkipToQueueItem: playFromQueueIndex,
      ),
    );
  }

  void _syncAudioSession() {
    _audioSession.sync(
      queue: playQueue,
      queueIndex: playIndex,
      currentTrack: currentTrack,
      playing: isPlaying,
      position: position,
      duration: duration,
      playMode: currentPlayMode,
    );
  }

  Future<void> _resumeFromAudioSession() async {
    if (currentTrack == null) {
      return;
    }
    if (_player.state.playlist.medias.isEmpty) {
      await playFromQueueIndex(playIndex < 0 ? 0 : playIndex);
      return;
    }
    await _player.play();
  }

  Future<void> _pauseFromAudioSession() async {
    if (currentTrack == null) {
      return;
    }
    await _player.pause();
  }
}
