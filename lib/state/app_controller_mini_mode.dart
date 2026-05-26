// Mini-mode state lives in a dedicated controller part so compact window
// transitions do not bloat the main controller file.

part of 'app_controller.dart';

final Expando<_MiniModeRuntimeState> _miniModeRuntimeStates =
    Expando<_MiniModeRuntimeState>('miniModeRuntimeStates');

class _MiniModeRuntimeState {
  _MiniModeRuntimeState() : window = MiniModeWindowController();

  final MiniModeWindowController window;
  bool open = false;
}

extension AppControllerMiniMode on AppController {
  _MiniModeRuntimeState get _miniModeState =>
      _miniModeRuntimeStates[this] ??= _MiniModeRuntimeState();

  bool get miniModeOpen => _miniModeState.open;

  bool get miniModeAlwaysOnTop => settings?.miniPlayerAlwaysOnTop ?? false;

  Future<void> toggleMiniMode() async {
    await setMiniMode(!miniModeOpen);
  }

  Future<void> closeMiniMode() async {
    await setMiniMode(false);
  }

  Future<void> setMiniMode(bool nextOpen) async {
    if (miniModeOpen == nextOpen) return;
    final state = _miniModeState;
    state.open = nextOpen;
    if (nextOpen) {
      if (immersiveOpen) {
        immersiveOpen = false;
      }
      _notifyStateChanged();
      await ensureLyricsForCurrentTrack();
      if (isDesktopHost) {
        await state.window.enter(alwaysOnTop: miniModeAlwaysOnTop);
      }
      return;
    }
    _notifyStateChanged();
    if (isDesktopHost) {
      await state.window.exit();
    }
  }

  Future<void> toggleMiniModeAlwaysOnTop() async {
    if (!isDesktopHost) return;
    final current = settings;
    if (current == null) return;
    final next = current.copyWith(
      miniPlayerAlwaysOnTop: !current.miniPlayerAlwaysOnTop,
    );
    settings = next;
    _notifyStateChanged();
    await _miniModeState.window.syncAlwaysOnTop(next.miniPlayerAlwaysOnTop);
    await api.saveSettings(next);
  }
}
