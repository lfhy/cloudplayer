// Mini-player lyrics render a compact synchronized panel without scrollbars so
// the compact shell can stay close to the legacy Wails behavior.

import 'dart:ui';

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/services/lyrics_timing.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/playback_presence.dart';
import 'package:fluent_ui/fluent_ui.dart';

class MiniPlayerLyricsPanel extends StatefulWidget {
  const MiniPlayerLyricsPanel({
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
  State<MiniPlayerLyricsPanel> createState() => _MiniPlayerLyricsPanelState();
}

class _MiniPlayerLyricsPanelState extends State<MiniPlayerLyricsPanel> {
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
    final child = _buildChild(entries);
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: _panelBorderColor()),
            color: _panelBackgroundColor(),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: child,
          ),
        ),
      ),
    );
  }

  Widget _buildChild(List<LyricEntry> entries) {
    if (widget.track == null) {
      return _MiniLyricsEmptyState(
        palette: widget.palette,
        message: '选择曲目后可进入歌词 Mini 模式',
      );
    }
    if (widget.busy && entries.isEmpty) {
      return _MiniLyricsEmptyState(
        palette: widget.palette,
        message: '歌词加载中...',
      );
    }
    if (entries.isEmpty) {
      return _MiniLyricsFallbackState(
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
                padding: const EdgeInsets.symmetric(vertical: 7),
                child: _MiniLyricLine(
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
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
      );
      _autoScrolling = false;
    });
  }

  int _activeLyricIndex(List<LyricEntry> entries, Duration position) {
    return activeLyricIndex(entries, position);
  }

  _MiniLyricVisualState _lineState(int index, int activeIndex) {
    if (index == activeIndex) {
      return _MiniLyricVisualState.active;
    }
    if (index < activeIndex) {
      return _MiniLyricVisualState.past;
    }
    return _MiniLyricVisualState.future;
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

  Color _panelBorderColor() {
    return widget.palette.brightness == Brightness.light
        ? const Color(0x2994A3B8)
        : const Color(0x2694A3B8);
  }

  Color _panelBackgroundColor() {
    return widget.palette.brightness == Brightness.light
        ? Colors.white.withValues(alpha: 0.42)
        : Colors.white.withValues(alpha: 0.05);
  }
}

class _MiniLyricsFallbackState extends StatelessWidget {
  const _MiniLyricsFallbackState({
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
        _MiniLyricLine(
          palette: palette,
          text: title,
          progress: 1,
          state: _MiniLyricVisualState.active,
          isPlaying: isPlaying,
        ),
        const SizedBox(height: 6),
        _MiniLyricLine(
          palette: palette,
          text: subtitle,
          progress: 0,
          state: _MiniLyricVisualState.future,
          isPlaying: isPlaying,
        ),
      ],
    );
  }
}

class _MiniLyricsEmptyState extends StatelessWidget {
  const _MiniLyricsEmptyState({required this.palette, required this.message});

  final AppPalette palette;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 14, color: palette.mutedForeground),
      ),
    );
  }
}

class _MiniLyricLine extends StatelessWidget {
  const _MiniLyricLine({
    required this.palette,
    required this.text,
    required this.progress,
    required this.state,
    required this.isPlaying,
  });

  final AppPalette palette;
  final String text;
  final double progress;
  final _MiniLyricVisualState state;
  final bool isPlaying;

  @override
  Widget build(BuildContext context) {
    final lineText = text.isEmpty ? ' ' : text;
    final baseStyle = TextStyle(
      fontSize: 16,
      height: 1.55,
      fontWeight: state == _MiniLyricVisualState.active
          ? FontWeight.w600
          : FontWeight.w500,
      color: _textColor(),
    );
    final baseChild = Text(
      lineText,
      textAlign: TextAlign.center,
      style: baseStyle,
    );
    if (state != _MiniLyricVisualState.active) {
      return PlaybackPresence(
        playing: isPlaying,
        pausedOpacity: state == _MiniLyricVisualState.past ? 0.72 : 0.46,
        pausedScale: 0.992,
        pausedOffset: state == _MiniLyricVisualState.past
            ? const Offset(0, -0.01)
            : const Offset(0, 0.01),
        child: baseChild,
      );
    }
    return PlaybackPresence(
      playing: isPlaying,
      pausedOpacity: 0.82,
      pausedScale: 1,
      pausedOffset: const Offset(0, 0.008),
      child: Transform.scale(
        scale: 1.01,
        child: ShaderMask(
          blendMode: BlendMode.srcIn,
          shaderCallback: (bounds) => LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: <Color>[
              palette.accent.normal,
              palette.accent.normal,
              _futureColor(),
              _futureColor(),
            ],
            stops: <double>[
              0,
              progress.clamp(0.0, 1.0),
              progress.clamp(0.0, 1.0),
              1,
            ],
          ).createShader(bounds),
          child: Text(
            lineText,
            textAlign: TextAlign.center,
            style: baseStyle.copyWith(color: palette.strongForeground),
          ),
        ),
      ),
    );
  }

  Color _textColor() {
    return switch (state) {
      _MiniLyricVisualState.active => palette.strongForeground,
      _MiniLyricVisualState.past => palette.accent.normal.withValues(
        alpha: 0.82,
      ),
      _MiniLyricVisualState.future => _futureColor(),
    };
  }

  Color _futureColor() {
    return widgetPaletteFutureColor(palette);
  }
}

Color widgetPaletteFutureColor(AppPalette palette) {
  return palette.brightness == Brightness.light
      ? const Color(0xC764748B)
      : const Color(0xADCBD5E1);
}

enum _MiniLyricVisualState { past, active, future }
