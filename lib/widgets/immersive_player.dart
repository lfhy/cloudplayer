// In-window immersive mode overlays the main shell with large artwork, shared transport controls, and synced lyrics from the bridge-backed lyric cache.
import 'dart:ui';
import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/utils/platform_environment.dart';
import 'package:cloudplayer_flutter/widgets/immersive_player_lyrics.dart';
import 'package:cloudplayer_flutter/widgets/playback_presence.dart';
import 'package:cloudplayer_flutter/widgets/track_artwork.dart';
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
    final totalMs = _totalDurationMs(controller);
    final currentMs = _draggingSeek
        ? _seekPreviewMs
        : _currentPositionMs(controller);
    return IgnorePointer(
      ignoring: !visible,
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
                      onTap: controller.closeImmersive,
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
                                child: _GlowOrb(
                                  color: widget.palette.accent.normal
                                      .withValues(alpha: 0.20),
                                  size: 360,
                                ),
                              ),
                              const Positioned(
                                right: -90,
                                bottom: -110,
                                child: _GlowOrb(
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
                  Positioned(
                    top: 18,
                    right: 18,
                    child: SafeArea(
                      bottom: false,
                      left: false,
                      child: _ImmersiveCloseButton(
                        onPressed: controller.closeImmersive,
                      ),
                    ),
                  ),
                  Positioned.fill(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(
                        isMobileHost ? 18 : 64,
                        isMobileHost ? 28 : 48,
                        isMobileHost ? 18 : 64,
                        isMobileHost ? 12 : 40,
                      ),
                      child: LayoutBuilder(
                        builder: (context, constraints) => _buildLayout(
                          controller: controller,
                          track: track,
                          currentMs: currentMs,
                          totalMs: totalMs,
                          compact:
                              constraints.maxWidth < _compactWidthThreshold ||
                              (isMobileHost && constraints.maxHeight < 740),
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
    );
  }

  double _currentPositionMs(AppController controller) {
    return controller.position.inMilliseconds.toDouble();
  }

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
    required bool compact,
  }) {
    final showLyrics = !isMobileHost || controller.immersiveLyricsVisible;
    final metaPanel = _MetaPanel(
      palette: widget.palette,
      track: track,
      isPlaying: controller.isPlaying,
      currentMs: currentMs,
      totalMs: totalMs,
      compact: compact,
      showLyricsHint: isMobileHost && !showLyrics,
      onArtworkPressed: controller.currentTrack == null || !isMobileHost
          ? null
          : () { controller.toggleImmersiveLyricsView(); },
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
      if (!showLyrics) {
        return Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 320),
            child: metaPanel,
          ),
        );
      }
      return Column(
        children: <Widget>[
          metaPanel,
          const SizedBox(height: 12),
          Expanded(child: lyricsPanel),
        ],
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
}

class _MetaPanel extends StatelessWidget {
  const _MetaPanel({
    required this.palette,
    required this.track,
    required this.isPlaying,
    required this.currentMs,
    required this.totalMs,
    required this.compact,
    required this.showLyricsHint,
    required this.onArtworkPressed,
    required this.onPlayPause,
    required this.onPrevious,
    required this.onNext,
    required this.onSeekStart,
    required this.onSeekChanged,
    required this.onSeekEnd,
  });

  final AppPalette palette;
  final TrackRow? track;
  final bool isPlaying;
  final double currentMs;
  final double totalMs;
  final bool compact;
  final bool showLyricsHint;
  final VoidCallback? onArtworkPressed;
  final Future<void> Function()? onPlayPause;
  final Future<void> Function()? onPrevious;
  final Future<void> Function()? onNext;
  final VoidCallback onSeekStart;
  final ValueChanged<double> onSeekChanged;
  final ValueChanged<double> onSeekEnd;

  @override
  Widget build(BuildContext context) {
    final dense = compact && MediaQuery.sizeOf(context).height < 760;
    return PlaybackPresence(
      playing: isPlaying,
      pausedOpacity: 0.8,
      pausedScale: 0.99,
      pausedOffset: const Offset(-0.012, 0.01),
      duration: const Duration(milliseconds: 320),
      child: Column(
        mainAxisAlignment: compact
            ? MainAxisAlignment.start
            : MainAxisAlignment.center,
        children: <Widget>[
          Button(
            onPressed: onArtworkPressed,
            style: ButtonStyle(
              padding: WidgetStateProperty.all(EdgeInsets.zero),
              backgroundColor: const WidgetStatePropertyAll<Color>(
                Colors.transparent,
              ),
            ),
            child: TrackArtwork(
              track: track,
              palette: palette,
              size: dense ? 124 : compact ? 148 : 240,
              radius: dense ? 18 : compact ? 20 : 24,
              iconSize: dense ? 40 : compact ? 44 : 76,
            ),
          ),
          SizedBox(height: dense ? 14 : compact ? 18 : 24),
          Text(
            track?.title ?? '未播放',
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: dense ? 16 : compact ? 18 : 22,
              height: 1.25,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            track == null
                ? '选择曲目开始播放'
                : track!.artist.trim().isEmpty
                ? '未知艺术家'
                : track!.artist,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: dense ? 12 : compact ? 13 : 14,
              color: Colors.white.withValues(alpha: 0.78),
            ),
          ),
          SizedBox(height: dense ? 2 : 4),
          Text(
            showLyricsHint
                ? '点击封面查看歌词'
                : track == null
                ? '在这里查看歌词沉浸模式'
                : track!.album.trim().isEmpty
                ? (track!.localPath.trim().isEmpty ? '正在聆听' : '本地音乐')
                : track!.album,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: dense ? 10 : compact ? 11 : 12,
              color: Colors.white.withValues(alpha: 0.52),
            ),
          ),
          SizedBox(height: dense ? 16 : compact ? 20 : 28),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              _ImmersiveTransportButton(
                icon: FluentIcons.previous,
                onPressed: onPrevious == null ? null : () => onPrevious!.call(),
              ),
              SizedBox(width: dense ? 14 : 20),
              _ImmersiveTransportButton(
                icon: isPlaying ? FluentIcons.pause : FluentIcons.play,
                onPressed: onPlayPause == null
                    ? null
                    : () => onPlayPause!.call(),
                main: true,
              ),
              SizedBox(width: dense ? 14 : 20),
              _ImmersiveTransportButton(
                icon: FluentIcons.next,
                onPressed: onNext == null ? null : () => onNext!.call(),
              ),
            ],
          ),
          SizedBox(height: dense ? 14 : compact ? 18 : 26),
          Row(
            children: <Widget>[
              SizedBox(
                width: 40,
                child: Text(
                  _formatDuration(currentMs.round()),
                  style: TextStyle(
                    fontSize: compact ? 10 : 11,
                    color: Colors.white.withValues(alpha: 0.6),
                  ),
                ),
              ),
              Expanded(
                child: Slider(
                  value: currentMs.clamp(0, totalMs),
                  max: totalMs <= 0 ? 1 : totalMs,
                  onChangeStart: (_) => onSeekStart(),
                  onChanged: track == null ? null : onSeekChanged,
                  onChangeEnd: track == null ? null : onSeekEnd,
                ),
              ),
              SizedBox(
                width: 40,
                child: Text(
                  _formatDuration(totalMs.round()),
                  textAlign: TextAlign.end,
                  style: TextStyle(
                    fontSize: compact ? 10 : 11,
                    color: Colors.white.withValues(alpha: 0.6),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatDuration(int totalMs) {
    if (totalMs <= 0) return '0:00';
    final totalSeconds = totalMs ~/ 1000;
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }
}

class _ImmersiveCloseButton extends StatelessWidget {
  const _ImmersiveCloseButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 48,
      height: 48,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(EdgeInsets.zero),
          backgroundColor: WidgetStatePropertyAll<Color>(
            Colors.white.withValues(alpha: 0.10),
          ),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(999),
              side: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
            ),
          ),
        ),
        child: const Icon(FluentIcons.chrome_close, color: Colors.white),
      ),
    );
  }
}

class _ImmersiveTransportButton extends StatelessWidget {
  const _ImmersiveTransportButton({
    required this.icon,
    required this.onPressed,
    this.main = false,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final bool main;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: main ? 56 : 44,
      height: main ? 56 : 44,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(EdgeInsets.zero),
          backgroundColor: WidgetStateProperty.resolveWith((state) {
            if (main) {
              return const Color(0xFFC62F2F);
            }
            return Colors.white.withValues(
              alpha: state.isHovered ? 0.12 : 0.06,
            );
          }),
          foregroundColor: const WidgetStatePropertyAll<Color>(Colors.white),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(999),
              side: BorderSide(
                color: main
                    ? const Color(0x66C62F2F)
                    : Colors.white.withValues(alpha: 0.08),
              ),
            ),
          ),
        ),
        child: Icon(icon, size: main ? 22 : 18),
      ),
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({required this.color, required this.size});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: <Color>[color, Colors.transparent]),
        ),
      ),
    );
  }
}
