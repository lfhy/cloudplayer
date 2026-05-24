// Immersive lyrics panel renders the currently active lyric line set and keeps
// the active line centered while playback advances.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/services/lyrics_timing.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/playback_presence.dart';
import 'package:fluent_ui/fluent_ui.dart';

class ImmersiveLyricsPanel extends StatefulWidget {
  const ImmersiveLyricsPanel({
    super.key,
    required this.palette,
    required this.track,
    required this.entries,
    required this.payload,
    required this.position,
    required this.busy,
    required this.isPlaying,
  });

  final AppPalette palette;
  final TrackRow? track;
  final List<LyricEntry> entries;
  final LyricsPayloadData? payload;
  final Duration position;
  final bool busy;
  final bool isPlaying;

  @override
  State<ImmersiveLyricsPanel> createState() => _ImmersiveLyricsPanelState();
}

class _ImmersiveLyricsPanelState extends State<ImmersiveLyricsPanel> {
  final ScrollController _scrollController = ScrollController();
  final Map<int, GlobalKey> _lineKeys = <int, GlobalKey>{};
  int _activeIndex = -1;
  bool _autoScrolling = false;
  DateTime _manualScrollUntil = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final entries = widget.entries;
    if (widget.track == null) {
      return _EmptyLyricsState(
        message: '选择歌曲后即可进入沉浸歌词模式',
        palette: widget.palette,
      );
    }
    if (widget.busy && entries.isEmpty) {
      return _EmptyLyricsState(message: '歌词加载中...', palette: widget.palette);
    }
    if (entries.isEmpty) {
      return _FallbackLyricsState(
        palette: widget.palette,
        title: widget.track?.title ?? '当前歌曲',
        subtitle: widget.track?.artist.trim().isEmpty ?? true
            ? '暂无滚动歌词'
            : widget.track!.artist,
        isPlaying: widget.isPlaying,
      );
    }
    final nextActiveIndex = _activeLyricIndex(entries, widget.position);
    _scheduleAutoScroll(nextActiveIndex);
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (_autoScrolling) {
          return false;
        }
        if (notification is ScrollStartNotification ||
            notification is ScrollUpdateNotification) {
          _manualScrollUntil = DateTime.now().add(
            const Duration(milliseconds: 1800),
          );
        }
        return false;
      },
      child: ScrollConfiguration(
        behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false),
        child: SingleChildScrollView(
          controller: _scrollController,
          padding: const EdgeInsets.symmetric(vertical: 40),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: Column(
              children: List<Widget>.generate(entries.length, (index) {
                final progress = _lineProgress(
                  entries: entries,
                  index: index,
                  activeIndex: nextActiveIndex,
                  payload: widget.payload,
                  position: widget.position,
                );
                return Padding(
                  key: _lineKeys.putIfAbsent(index, GlobalKey.new),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: _ImmersiveLyricLine(
                    palette: widget.palette,
                    text: entries[index].text,
                    progress: progress,
                    state: _lineState(index, nextActiveIndex),
                    isPlaying: widget.isPlaying,
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }

  void _scheduleAutoScroll(int nextActiveIndex) {
    if (nextActiveIndex < 0 || nextActiveIndex == _activeIndex) {
      return;
    }
    _activeIndex = nextActiveIndex;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted || DateTime.now().isBefore(_manualScrollUntil)) {
        return;
      }
      final targetContext = _lineKeys[nextActiveIndex]?.currentContext;
      if (targetContext == null) {
        return;
      }
      _autoScrolling = true;
      await Scrollable.ensureVisible(
        targetContext,
        alignment: 0.5,
        duration: const Duration(milliseconds: 360),
        curve: Curves.easeOutCubic,
      );
      _autoScrolling = false;
    });
  }

  int _activeLyricIndex(List<LyricEntry> entries, Duration position) {
    return activeLyricIndex(entries, position);
  }

  _LyricVisualState _lineState(int index, int activeIndex) {
    if (index == activeIndex) {
      return _LyricVisualState.active;
    }
    if (index < activeIndex) {
      return _LyricVisualState.past;
    }
    return _LyricVisualState.future;
  }

  double _lineProgress({
    required List<LyricEntry> entries,
    required int index,
    required int activeIndex,
    required LyricsPayloadData? payload,
    required Duration position,
  }) {
    if (index < activeIndex) return 1;
    if (index > activeIndex) return 0;
    return lyricLineProgress(
      entries: entries,
      payload: payload,
      currentSeconds: position.inMilliseconds / 1000,
      index: index,
    );
  }
}

class _FallbackLyricsState extends StatelessWidget {
  const _FallbackLyricsState({
    required this.palette,
    required this.title,
    required this.subtitle,
    required this.isPlaying,
  });

  final AppPalette palette;
  final String title;
  final String subtitle;
  final bool isPlaying;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: <Widget>[
        _ImmersiveLyricLine(
          palette: palette,
          text: title,
          progress: 1,
          state: _LyricVisualState.active,
          isPlaying: isPlaying,
        ),
        const SizedBox(height: 12),
        _ImmersiveLyricLine(
          palette: palette,
          text: subtitle,
          progress: 0,
          state: _LyricVisualState.future,
          isPlaying: isPlaying,
        ),
      ],
    );
  }
}

class _EmptyLyricsState extends StatelessWidget {
  const _EmptyLyricsState({required this.message, required this.palette});

  final String message;
  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        message,
        style: TextStyle(
          fontSize: 16,
          color: Colors.white.withValues(alpha: 0.6),
        ),
      ),
    );
  }
}

class _ImmersiveLyricLine extends StatelessWidget {
  const _ImmersiveLyricLine({
    required this.palette,
    required this.text,
    required this.progress,
    required this.state,
    required this.isPlaying,
  });

  final AppPalette palette;
  final String text;
  final double progress;
  final _LyricVisualState state;
  final bool isPlaying;

  @override
  Widget build(BuildContext context) {
    final baseStyle = TextStyle(
      fontSize: 26,
      height: 1.5,
      fontWeight: state == _LyricVisualState.active
          ? FontWeight.w600
          : FontWeight.w500,
      color: _textColor(),
    );
    final child = Text(
      text.isEmpty ? ' ' : text,
      textAlign: TextAlign.center,
      style: baseStyle,
    );
    if (state != _LyricVisualState.active) {
      return PlaybackPresence(
        playing: isPlaying,
        pausedOpacity: state == _LyricVisualState.past ? 0.6 : 0.3,
        pausedScale: state == _LyricVisualState.past ? 0.988 : 0.974,
        pausedOffset: state == _LyricVisualState.past
            ? const Offset(0, -0.01)
            : const Offset(0, 0.014),
        child: child,
      );
    }
    return PlaybackPresence(
      playing: isPlaying,
      pausedOpacity: 0.8,
      pausedScale: 1,
      pausedOffset: const Offset(0, 0.01),
      duration: const Duration(milliseconds: 320),
      child: ShaderMask(
        blendMode: BlendMode.srcIn,
        shaderCallback: (bounds) => LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: <Color>[
            Colors.white,
            Colors.white,
            Colors.white.withValues(alpha: 0.24),
            Colors.white.withValues(alpha: 0.24),
          ],
          stops: <double>[
            0,
            progress.clamp(0.0, 1.0),
            progress.clamp(0.0, 1.0),
            1,
          ],
        ).createShader(bounds),
        child: Text(
          text.isEmpty ? ' ' : text,
          textAlign: TextAlign.center,
          style: baseStyle.copyWith(color: Colors.white),
        ),
      ),
    );
  }

  Color _textColor() {
    return switch (state) {
      _LyricVisualState.active => Colors.white,
      _LyricVisualState.past => Colors.white.withValues(alpha: 0.74),
      _LyricVisualState.future => Colors.white.withValues(alpha: 0.32),
    };
  }
}

enum _LyricVisualState { past, active, future }
