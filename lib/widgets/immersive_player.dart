// In-window immersive mode overlays the main shell with large artwork, shared transport controls, and synced lyrics from the bridge-backed lyric cache.
import 'dart:ui';
import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/utils/platform_environment.dart';
import 'package:cloudplayer_flutter/widgets/immersive_player_chrome.dart';
import 'package:cloudplayer_flutter/widgets/immersive_player_lyrics.dart';
import 'package:cloudplayer_flutter/widgets/immersive_player_meta.dart';
import 'package:cloudplayer_flutter/widgets/player_dock_utils.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

class ImmersivePlayer extends StatefulWidget {
  const ImmersivePlayer({super.key, required this.palette});
  final AppPalette palette;
  @override
  State<ImmersivePlayer> createState() => _ImmersivePlayerState();
}

class _ImmersivePlayerState extends State<ImmersivePlayer> {
  bool _draggingSeek = false;
  double _seekPreviewMs = 0;
  static const double _compactWidthThreshold = 560;
  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final track = controller.currentTrack;
    final visible = controller.immersiveOpen;
    final viewPadding = MediaQuery.viewPaddingOf(context);
    final totalMs = _totalDurationMs(controller);
    final currentMs = _draggingSeek
        ? _seekPreviewMs
        : _currentPositionMs(controller);
    return IgnorePointer(
      ignoring: !visible,
      child: AnimatedSlide(
        duration: const Duration(milliseconds: 280),
        curve: const Cubic(0.22, 1, 0.36, 1),
        offset: visible ? Offset.zero : const Offset(0, 0.12),
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 220),
          opacity: visible ? 1 : 0,
          child: Shortcuts(
            shortcuts: <ShortcutActivator, Intent>{
              SingleActivator(LogicalKeyboardKey.escape): const DismissIntent(),
            },
            child: Actions(
              actions: <Type, Action<Intent>>{
                DismissIntent: CallbackAction<DismissIntent>(
                  onInvoke: (_) => controller.closeImmersive(),
                ),
              },
              child: Focus(
                autofocus: visible,
                child: Stack(
                  children: <Widget>[
                    Positioned.fill(
                      child: GestureDetector(
                        onTap: isMobileHost ? null : controller.closeImmersive,
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: <Color>[
                                  const Color(0xF10A0F1E),
                                  const Color(0xF1080C1C),
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                            child: Stack(
                              children: <Widget>[
                                Positioned(
                                  left: -120,
                                  top: -80,
                                  child: ImmersiveGlowOrb(
                                    color: widget.palette.accent.normal
                                        .withValues(alpha: 0.20),
                                    size: 360,
                                  ),
                                ),
                                const Positioned(
                                  right: -90,
                                  bottom: -110,
                                  child: ImmersiveGlowOrb(
                                    color: Color(0x22FFFFFF),
                                    size: 320,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (!isMobileHost)
                      Positioned(
                        top: 18,
                        right: 18,
                        child: SafeArea(
                          bottom: false,
                          left: false,
                          child: ImmersiveCloseButtonChrome(
                            onPressed: controller.closeImmersive,
                          ),
                        ),
                      ),
                    Positioned.fill(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(
                          isMobileHost ? 18 : 64,
                          isMobileHost ? viewPadding.top + 16 : 48,
                          isMobileHost ? 18 : 64,
                          isMobileHost ? viewPadding.bottom + 28 : 40,
                        ),
                        child: LayoutBuilder(
                          builder: (context, constraints) => _buildLayout(
                            controller: controller,
                            track: track,
                            currentMs: currentMs,
                            totalMs: totalMs,
                            maxHeight: constraints.maxHeight,
                            compact:
                                isMobileHost ||
                                constraints.maxWidth < _compactWidthThreshold ||
                                constraints.maxHeight < 740,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  double _currentPositionMs(AppController controller) =>
      controller.position.inMilliseconds.toDouble();

  double _totalDurationMs(AppController controller) {
    final currentTrack = controller.currentTrack;
    final streamDuration = controller.duration.inMilliseconds.toDouble();
    if (streamDuration > 0) {
      return streamDuration;
    }
    return currentTrack == null
        ? 1
        : currentTrack.durationMs.clamp(1, 1 << 31).toDouble();
  }

  Widget _buildLayout({
    required AppController controller,
    required TrackRow? track,
    required double currentMs,
    required double totalMs,
    required double maxHeight,
    required bool compact,
  }) {
    final showLyrics = !isMobileHost || controller.immersiveLyricsVisible;
    final metaPanel = ImmersiveMetaPanel(
      palette: widget.palette,
      track: track,
      onBackToPage: isMobileHost ? controller.closeImmersive : null,
      isPlaying: controller.isPlaying,
      currentMs: currentMs,
      totalMs: totalMs,
      compact: compact,
      showLyricsHint: isMobileHost && !showLyrics,
      onArtworkPressed: controller.currentTrack == null || !isMobileHost
          ? null
          : () {
              controller.toggleImmersiveLyricsView();
            },
      onPlayPause: controller.currentTrack == null
          ? null
          : controller.togglePlayPause,
      onPrevious: controller.canNavigateQueue ? controller.playPrevious : null,
      onNext: controller.canNavigateQueue ? controller.playNext : null,
      onSeekStart: () => setState(() {
        _draggingSeek = true;
        _seekPreviewMs = currentMs;
      }),
      onSeekChanged: (value) => setState(() {
        _seekPreviewMs = value;
      }),
      onSeekEnd: (value) async {
        await controller.seekTo(Duration(milliseconds: value.round()));
        if (!mounted) return;
        setState(() {
          _draggingSeek = false;
          _seekPreviewMs = value;
        });
      },
      showVolumeControl: isAndroidHost,
      volume: controller.effectiveVolumeFraction,
      onVolumeChanged: !isAndroidHost
          ? null
          : (value) => controller.setVolume(value),
      onToggleMute: !isAndroidHost ? null : controller.toggleMute,
      playMode: controller.currentPlayMode,
      onPlayModePressed: controller.settings == null
          ? null
          : () => controller.setPlayMode(
              nextDockPlayMode(controller.currentPlayMode),
            ),
    );
    final lyricsPanel = ImmersiveLyricsPanel(
      palette: widget.palette,
      track: track,
      entries: controller.lyricsEntries,
      payload: controller.lyricsPayload,
      position: controller.position,
      busy: controller.lyricsBusy,
      isPlaying: controller.isPlaying,
    );
    if (compact) {
      return SizedBox.expand(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 260),
          switchInCurve: const Cubic(0.22, 1, 0.36, 1),
          switchOutCurve: Curves.easeOut,
          transitionBuilder: _mobileTransition,
          child: showLyrics
              ? GestureDetector(
                  key: const ValueKey<String>('mobile-lyrics'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => controller.toggleImmersiveLyricsView(),
                  child: lyricsPanel,
                )
              : Center(
                  key: const ValueKey<String>('mobile-player'),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 320),
                    child: SizedBox(height: maxHeight, child: metaPanel),
                  ),
                ),
        ),
      );
    }
    return Row(
      children: <Widget>[
        SizedBox(width: 320, child: metaPanel),
        const SizedBox(width: 72),
        Expanded(child: Center(child: lyricsPanel)),
      ],
    );
  }

  Widget _mobileTransition(Widget child, Animation<double> animation) {
    return FadeTransition(
      opacity: animation,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.025),
          end: Offset.zero,
        ).animate(animation),
        child: child,
      ),
    );
  }
}
