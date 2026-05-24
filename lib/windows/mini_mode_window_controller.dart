// Mini-mode window transitions keep the compact shell reversible while matching
// the legacy Wails window sizing and always-on-top behavior.

import 'dart:math' as math;

import 'package:fluent_ui/fluent_ui.dart';
import 'package:window_manager/window_manager.dart';

const Size kMainWindowMinimumSize = Size(1000, 680);
const Size kMiniWindowMinimumSize = Size(360, 260);
const Size kMiniWindowDefaultSize = Size(460, 360);

class MiniModeWindowController {
  _MiniWindowSnapshot? _savedState;
  bool _active = false;

  Future<void> enter({required bool alwaysOnTop}) async {
    _savedState ??= await _captureWindowState();
    _active = true;
    if (await windowManager.isMinimized()) {
      await _runStep(() => windowManager.restore());
    }
    if (_savedState!.wasFullScreen) {
      await _runStep(() => windowManager.setFullScreen(false));
    }
    if (_savedState!.wasMaximized) {
      await _runStep(() => windowManager.unmaximize());
    }
    final bounds = _miniBoundsFrom(_savedState!);
    await _runStep(() => windowManager.setResizable(true));
    await _runStep(() => windowManager.setMinimumSize(kMiniWindowMinimumSize));
    await _runStep(() => windowManager.setSize(bounds.size));
    await _runStep(() => windowManager.setPosition(bounds.topLeft));
    await _runStep(() => windowManager.setAlwaysOnTop(alwaysOnTop));
    await _runStep(() => windowManager.focus());
  }

  Future<void> exit() async {
    final state = _savedState;
    _savedState = null;
    _active = false;
    await _runStep(() => windowManager.setAlwaysOnTop(false));
    await _runStep(() => windowManager.setResizable(true));
    await _runStep(() => windowManager.setMinimumSize(kMainWindowMinimumSize));
    if (state == null) return;
    if (state.wasFullScreen) {
      await _runStep(() => windowManager.setFullScreen(true));
      return;
    }
    if (state.wasMaximized) {
      await _runStep(() => windowManager.maximize());
      return;
    }
    await _runStep(
      () => windowManager.setSize(
        Size(
          math.max(kMainWindowMinimumSize.width, state.size.width),
          math.max(kMainWindowMinimumSize.height, state.size.height),
        ),
      ),
    );
    await _runStep(
      () => windowManager.setPosition(
        Offset(
          math.max(0, state.position.dx),
          math.max(0, state.position.dy),
        ),
      ),
    );
  }

  Future<void> syncAlwaysOnTop(bool alwaysOnTop) async {
    if (!_active) return;
    await _runStep(() => windowManager.setAlwaysOnTop(alwaysOnTop));
  }

  Future<_MiniWindowSnapshot> _captureWindowState() async {
    final position = await _readWindowValue(
      () => windowManager.getPosition(),
      const Offset(0, 0),
    );
    final size = await _readWindowValue(
      () => windowManager.getSize(),
      kMiniWindowDefaultSize,
    );
    final wasFullScreen = await _readWindowValue(
      () => windowManager.isFullScreen(),
      false,
    );
    final wasMaximized = await _readWindowValue(
      () => windowManager.isMaximized(),
      false,
    );
    return _MiniWindowSnapshot(
      position: position,
      size: size,
      wasFullScreen: wasFullScreen,
      wasMaximized: wasMaximized,
    );
  }

  Rect _miniBoundsFrom(_MiniWindowSnapshot saved) {
    final width = math.min(
      kMiniWindowDefaultSize.width,
      math.max(kMiniWindowMinimumSize.width, saved.size.width),
    );
    final height = math.min(
      kMiniWindowDefaultSize.height,
      math.max(kMiniWindowMinimumSize.height, saved.size.height),
    );
    return Rect.fromLTWH(
      math.max(0, saved.position.dx + (saved.size.width - width) / 2),
      math.max(
        0,
        saved.position.dy +
            math.min(48, math.max(16, (saved.size.height - height) / 3)),
      ),
      width,
      height,
    );
  }

  Future<T> _readWindowValue<T>(
    Future<T> Function() action,
    T fallback,
  ) async {
    try {
      return await action();
    } catch (_) {
      return fallback;
    }
  }

  Future<void> _runStep(Future<void> Function() action) async {
    try {
      await action();
    } catch (_) {}
  }
}

class _MiniWindowSnapshot {
  const _MiniWindowSnapshot({
    required this.position,
    required this.size,
    required this.wasFullScreen,
    required this.wasMaximized,
  });

  final Offset position;
  final Size size;
  final bool wasFullScreen;
  final bool wasMaximized;
}
