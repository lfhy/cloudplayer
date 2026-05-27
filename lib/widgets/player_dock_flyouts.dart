// Player-dock flyout widgets keep queue and action menus reusable without bloating the main dock file.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/track_artwork.dart';
import 'package:fluent_ui/fluent_ui.dart';

class PlayerQueueFlyout extends StatelessWidget {
  const PlayerQueueFlyout({
    super.key,
    required this.palette,
    required this.tracks,
    required this.currentIndex,
    required this.onSelect,
  });

  final AppPalette palette;
  final List<TrackRow> tracks;
  final int currentIndex;
  final Future<void> Function(int index) onSelect;

  @override
  Widget build(BuildContext context) {
    return FlyoutContent(
      useAcrylic: false,
      elevation: 10,
      padding: const EdgeInsets.all(8),
      constraints: const BoxConstraints(minWidth: 344, maxWidth: 344),
      color: palette.cardBackground,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: palette.borderColor),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 4, 8, 10),
            child: Row(
              children: <Widget>[
                Text(
                  '播放队列',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: palette.strongForeground,
                  ),
                ),
                const Spacer(),
                Text(
                  '${tracks.length} 首',
                  style: TextStyle(
                    fontSize: 11,
                    color: palette.mutedForeground,
                  ),
                ),
              ],
            ),
          ),
          if (tracks.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
              child: Text(
                '播放队列为空',
                style: TextStyle(fontSize: 12, color: palette.mutedForeground),
              ),
            )
          else
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 324),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: tracks.length,
                separatorBuilder: (_, _) => const SizedBox(height: 4),
                itemBuilder: (context, index) {
                  final track = tracks[index];
                  return _QueueItemButton(
                    palette: palette,
                    track: track,
                    active: index == currentIndex,
                    index: index,
                    onPressed: () => onSelect(index),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class DockFlyoutActionButton extends StatelessWidget {
  const DockFlyoutActionButton({
    super.key,
    required this.palette,
    required this.label,
    required this.onPressed,
    this.icon,
    this.danger = false,
  });

  final AppPalette palette;
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final foreground = danger
        ? const Color(0xFFC63F36)
        : palette.strongForeground;
    final iconColor = danger ? foreground : palette.accent.normal;
    return SizedBox(
      width: double.infinity,
      child: HoverButton(
        onPressed: onPressed,
        builder: (context, states) => AnimatedContainer(
          duration: const Duration(milliseconds: 110),
          curve: Curves.easeOutCubic,
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: states.isHovered
                ? palette.subtleBackground
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: <Widget>[
              SizedBox(
                width: 18,
                child: icon == null
                    ? null
                    : Icon(icon, size: 14, color: iconColor),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  textAlign: TextAlign.left,
                  style: TextStyle(
                    fontSize: 12,
                    color: onPressed == null
                        ? foreground.withValues(alpha: 0.42)
                        : foreground,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QueueItemButton extends StatelessWidget {
  const _QueueItemButton({
    required this.palette,
    required this.track,
    required this.active,
    required this.index,
    required this.onPressed,
  });

  final AppPalette palette;
  final TrackRow track;
  final bool active;
  final int index;
  final Future<void> Function() onPressed;

  @override
  Widget build(BuildContext context) {
    return HoverButton(
      onPressed: () => onPressed(),
      builder: (context, states) {
        final hovered = states.isHovered;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 110),
          curve: Curves.easeOutCubic,
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: active
                ? palette.accent.normal.withValues(alpha: 0.1)
                : hovered
                ? palette.subtleBackground
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: <Widget>[
              SizedBox(
                width: 28,
                child: Text(
                  '${index + 1}'.padLeft(2, '0'),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: active
                        ? palette.accent.normal
                        : palette.mutedForeground,
                  ),
                ),
              ),
              TrackArtwork(
                track: track,
                palette: palette,
                size: 48,
                radius: 12,
                iconSize: 18,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      track.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: active
                            ? palette.accent.normal
                            : palette.strongForeground,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      track.artist.trim().isEmpty
                          ? (track.localPath.trim().isEmpty ? '在线曲目' : '本地音乐')
                          : track.artist,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        color: palette.mutedForeground,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
