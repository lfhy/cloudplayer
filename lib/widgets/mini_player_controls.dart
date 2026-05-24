// Mini-player controls are split out so the compact shell can stay under the
// repository file-size limit while preserving the legacy Wails layout.

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/legacy_dock_icons.dart';
import 'package:cloudplayer_flutter/widgets/playback_presence.dart';
import 'package:cloudplayer_flutter/widgets/player_dock_utils.dart';
import 'package:fluent_ui/fluent_ui.dart';

class MiniPlayerHeader extends StatelessWidget {
  const MiniPlayerHeader({
    super.key,
    required this.palette,
    required this.trackTitle,
    required this.trackSubtitle,
    required this.cover,
    required this.isPlaying,
    required this.pinned,
    required this.onPrevious,
    required this.onPlayPause,
    required this.onNext,
    required this.onTogglePin,
    required this.onExit,
  });

  final AppPalette palette;
  final String trackTitle;
  final String trackSubtitle;
  final Widget cover;
  final bool isPlaying;
  final bool pinned;
  final VoidCallback? onPrevious;
  final VoidCallback? onPlayPause;
  final VoidCallback? onNext;
  final VoidCallback? onTogglePin;
  final VoidCallback? onExit;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final stacked = constraints.maxWidth < 420;
        final actions = _MiniPlayerActions(
          palette: palette,
          isPlaying: isPlaying,
          pinned: pinned,
          onPrevious: onPrevious,
          onPlayPause: onPlayPause,
          onNext: onNext,
          onTogglePin: onTogglePin,
          onExit: onExit,
        );
        return Column(
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: <Widget>[
                cover,
                const SizedBox(width: 12),
                Expanded(
                  child: PlaybackPresence(
                    playing: isPlaying,
                    pausedOpacity: 0.8,
                    pausedScale: 0.99,
                    pausedOffset: const Offset(0, 0.012),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          trackTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: palette.strongForeground,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          trackSubtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            color: palette.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (!stacked) ...<Widget>[const SizedBox(width: 14), actions],
              ],
            ),
            if (stacked) ...<Widget>[
              const SizedBox(height: 12),
              Align(alignment: Alignment.centerRight, child: actions),
            ],
          ],
        );
      },
    );
  }
}

class MiniPlayerProgressBar extends StatelessWidget {
  const MiniPlayerProgressBar({
    super.key,
    required this.palette,
    required this.currentMs,
    required this.totalMs,
    required this.enabled,
    required this.onSeekStart,
    required this.onSeekChanged,
    required this.onSeekEnd,
  });

  final AppPalette palette;
  final double currentMs;
  final double totalMs;
  final bool enabled;
  final VoidCallback onSeekStart;
  final ValueChanged<double> onSeekChanged;
  final ValueChanged<double> onSeekEnd;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        SizedBox(
          width: 40,
          child: Text(
            formatDockDuration(Duration(milliseconds: currentMs.round())),
            style: TextStyle(
              fontSize: 11,
              color: palette.mutedForeground,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
        ),
        Expanded(
          child: Slider(
            value: currentMs.clamp(0, totalMs).toDouble(),
            max: totalMs,
            onChangeStart: enabled ? (_) => onSeekStart() : null,
            onChanged: enabled ? onSeekChanged : null,
            onChangeEnd: enabled ? onSeekEnd : null,
          ),
        ),
        SizedBox(
          width: 40,
          child: Text(
            formatDockDuration(Duration(milliseconds: totalMs.round())),
            textAlign: TextAlign.end,
            style: TextStyle(
              fontSize: 11,
              color: palette.mutedForeground,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
        ),
      ],
    );
  }
}

class _MiniPlayerActions extends StatelessWidget {
  const _MiniPlayerActions({
    required this.palette,
    required this.isPlaying,
    required this.pinned,
    required this.onPrevious,
    required this.onPlayPause,
    required this.onNext,
    required this.onTogglePin,
    required this.onExit,
  });

  final AppPalette palette;
  final bool isPlaying;
  final bool pinned;
  final VoidCallback? onPrevious;
  final VoidCallback? onPlayPause;
  final VoidCallback? onNext;
  final VoidCallback? onTogglePin;
  final VoidCallback? onExit;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        _MiniTransportButton(
          palette: palette,
          tooltip: '上一首',
          onPressed: onPrevious,
          icon: LegacyDockGlyph.skipPreviousBold,
        ),
        const SizedBox(width: 8),
        _MiniTransportButton(
          palette: palette,
          tooltip: isPlaying ? '暂停' : '播放',
          onPressed: onPlayPause,
          icon: isPlaying
              ? LegacyDockGlyph.pauseBold
              : LegacyDockGlyph.playBold,
          main: true,
        ),
        const SizedBox(width: 8),
        _MiniTransportButton(
          palette: palette,
          tooltip: '下一首',
          onPressed: onNext,
          icon: LegacyDockGlyph.skipNextBold,
        ),
        const SizedBox(width: 8),
        _MiniIconButton(
          palette: palette,
          tooltip: pinned ? '关闭 Mini 置顶' : '开启 Mini 置顶',
          onPressed: onTogglePin,
          active: pinned,
          icon: LegacyDockGlyph.pinCircle,
        ),
        const SizedBox(width: 8),
        _MiniIconButton(
          palette: palette,
          tooltip: '退出 Mini 模式',
          onPressed: onExit,
          icon: LegacyDockGlyph.exitMini,
        ),
      ],
    );
  }
}

class _MiniTransportButton extends StatelessWidget {
  const _MiniTransportButton({
    required this.palette,
    required this.tooltip,
    required this.onPressed,
    required this.icon,
    this.main = false,
  });

  final AppPalette palette;
  final String tooltip;
  final VoidCallback? onPressed;
  final LegacyDockGlyph icon;
  final bool main;

  @override
  Widget build(BuildContext context) {
    final button = SizedBox(
      width: main ? 44 : 38,
      height: main ? 44 : 38,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(EdgeInsets.zero),
          backgroundColor: WidgetStateProperty.resolveWith((state) {
            if (main) {
              return palette.accent.normal.withValues(
                alpha: state.isHovered ? 0.98 : 0.9,
              );
            }
            if (state.isHovered) {
              return palette.brightness == Brightness.light
                  ? Colors.white.withValues(alpha: 0.74)
                  : Colors.white.withValues(alpha: 0.10);
            }
            return palette.brightness == Brightness.light
                ? Colors.white.withValues(alpha: 0.62)
                : Colors.white.withValues(alpha: 0.06);
          }),
          foregroundColor: WidgetStateProperty.all(
            main ? Colors.white : palette.strongForeground,
          ),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(999),
              side: BorderSide(color: palette.borderColor),
            ),
          ),
        ),
        child: LegacyDockIcon(
          glyph: icon,
          size: main ? 18 : 16,
          color: main ? Colors.white : palette.strongForeground,
        ),
      ),
    );
    return Tooltip(message: tooltip, child: button);
  }
}

class _MiniIconButton extends StatelessWidget {
  const _MiniIconButton({
    required this.palette,
    required this.tooltip,
    required this.onPressed,
    required this.icon,
    this.active = false,
  });

  final AppPalette palette;
  final String tooltip;
  final VoidCallback? onPressed;
  final LegacyDockGlyph icon;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final button = SizedBox(
      width: 34,
      height: 34,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(EdgeInsets.zero),
          backgroundColor: WidgetStateProperty.resolveWith((state) {
            if (active) {
              return palette.accent.normal.withValues(alpha: 0.86);
            }
            if (state.isHovered) {
              return palette.brightness == Brightness.light
                  ? Colors.white.withValues(alpha: 0.74)
                  : Colors.white.withValues(alpha: 0.10);
            }
            return palette.brightness == Brightness.light
                ? Colors.white.withValues(alpha: 0.62)
                : Colors.white.withValues(alpha: 0.06);
          }),
          foregroundColor: WidgetStateProperty.all(
            active ? Colors.white : palette.strongForeground,
          ),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: BorderSide(color: palette.borderColor),
            ),
          ),
        ),
        child: LegacyDockIcon(
          glyph: icon,
          size: 16,
          color: active ? Colors.white : palette.strongForeground,
        ),
      ),
    );
    return Tooltip(message: tooltip, child: button);
  }
}
