// Mini player swaps the main shell for a compact same-window playback surface
// that mirrors the legacy Wails mini mode layout and controls.

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/utils/platform_environment.dart';
import 'package:cloudplayer_flutter/widgets/mini_player_controls.dart';
import 'package:cloudplayer_flutter/widgets/mini_player_lyrics.dart';
import 'package:cloudplayer_flutter/widgets/track_artwork.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';
import 'package:window_manager/window_manager.dart';

class MiniPlayer extends StatefulWidget {
  const MiniPlayer({super.key, required this.palette});

  final AppPalette palette;

  @override
  State<MiniPlayer> createState() => _MiniPlayerState();
}

class _MiniPlayerState extends State<MiniPlayer> {
  bool _draggingSeek = false;
  double _seekPreviewMs = 0;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final visible = controller.miniModeOpen;
    if (!visible) {
      return const SizedBox.shrink();
    }
    final track = controller.currentTrack;
    final totalMs = _totalDurationMs(controller);
    final currentMs = _draggingSeek
        ? _seekPreviewMs
        : controller.position.inMilliseconds.toDouble();
    return AnimatedOpacity(
      opacity: visible ? 1 : 0,
      duration: const Duration(milliseconds: 180),
      child: Shortcuts(
        shortcuts: const <ShortcutActivator, Intent>{
          SingleActivator(LogicalKeyboardKey.escape): DismissIntent(),
        },
        child: Actions(
          actions: <Type, Action<Intent>>{
            DismissIntent: CallbackAction<DismissIntent>(
              onInvoke: (_) {
                unawaited(controller.closeMiniMode());
                return null;
              },
            ),
          },
          child: Focus(
            autofocus: true,
              child: DecoratedBox(
                decoration: BoxDecoration(gradient: _backgroundGradient()),
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(
                      16,
                      defaultTargetPlatform == TargetPlatform.macOS ? 38 : 8,
                      16,
                      16,
                    ),
                  child: Column(
                    children: <Widget>[
                      _miniHeader(controller, track),
                      const SizedBox(height: 14),
                      MiniPlayerProgressBar(
                        palette: widget.palette,
                        currentMs: currentMs,
                        totalMs: totalMs,
                        enabled: controller.currentTrack != null,
                        onSeekStart: () => setState(() {
                          _draggingSeek = true;
                          _seekPreviewMs = currentMs;
                        }),
                        onSeekChanged: (value) => setState(() {
                          _seekPreviewMs = value;
                        }),
                        onSeekEnd: (value) async {
                          await controller.seekTo(
                            Duration(milliseconds: value.round()),
                          );
                          if (!mounted) return;
                          setState(() {
                            _draggingSeek = false;
                            _seekPreviewMs = value;
                          });
                        },
                      ),
                      const SizedBox(height: 14),
                      Expanded(
                        child: MiniPlayerLyricsPanel(
                          palette: widget.palette,
                          track: track,
                          entries: controller.lyricsEntries,
                          payload: controller.lyricsPayload,
                          position: controller.position,
                          busy: controller.lyricsBusy,
                          isPlaying: controller.isPlaying,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _miniHeader(AppController controller, dynamic track) {
    final header = MiniPlayerHeader(
      palette: widget.palette,
      trackTitle: track?.title ?? '未播放',
      trackSubtitle: _miniSubtitle(track),
      onPrevious: controller.canNavigateQueue
          ? () => unawaited(controller.playPrevious())
          : null,
      onPlayPause: controller.currentTrack == null
          ? null
          : () => unawaited(controller.togglePlayPause()),
      onNext: controller.canNavigateQueue
          ? () => unawaited(controller.playNext())
          : null,
      onTogglePin: controller.settings == null || !isDesktopHost
          ? null
          : () => unawaited(controller.toggleMiniModeAlwaysOnTop()),
      onOpenImmersive: controller.currentTrack == null
          ? null
          : () => unawaited(controller.openImmersive()),
      onExit: () => unawaited(controller.closeMiniMode()),
      isPlaying: controller.isPlaying,
      pinned: controller.miniModeAlwaysOnTop,
      showPinAction: isDesktopHost,
      cover: TrackArtwork(
        track: track,
        palette: widget.palette,
        size: 64,
        radius: 14,
        iconSize: 28,
      ),
    );
    return isDesktopHost ? DragToMoveArea(child: header) : header;
  }

  Gradient _backgroundGradient() {
    if (widget.palette.brightness == Brightness.light) {
      return const LinearGradient(
        colors: <Color>[Color(0xFAFFFFFF), Color(0xFFF8FAFC)],
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
      );
    }
    return const LinearGradient(
      colors: <Color>[Color(0xFA111827), Color(0xF50A0E18)],
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
    );
  }

  double _totalDurationMs(AppController controller) {
    final streamDuration = controller.duration.inMilliseconds.toDouble();
    if (streamDuration > 0) {
      return streamDuration;
    }
    final track = controller.currentTrack;
    return track == null ? 1 : track.durationMs.clamp(1, 1 << 31).toDouble();
  }

  String _miniSubtitle(dynamic track) {
    if (track == null) {
      return '选择曲目后可进入歌词 Mini 模式';
    }
    final artist = track.artist.trim();
    if (artist.isNotEmpty) {
      return artist;
    }
    return '未知艺术家';
  }
}
