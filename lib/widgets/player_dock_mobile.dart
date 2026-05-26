// Mobile player dock uses a compact floating-island layout instead of the
// desktop footer so phone screens keep playback controls readable.

import 'dart:async';
import 'dart:ui';

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/playback_presence.dart';
import 'package:cloudplayer_flutter/widgets/player_dock_buttons.dart';
import 'package:cloudplayer_flutter/widgets/player_dock_tools.dart';
import 'package:cloudplayer_flutter/widgets/track_artwork.dart';
import 'package:fluent_ui/fluent_ui.dart';

class MobilePlayerDockLayout extends StatelessWidget {
  const MobilePlayerDockLayout({
    super.key,
    required this.palette,
    required this.controller,
    required this.track,
    required this.volume,
  });

  final AppPalette palette;
  final AppController controller;
  final TrackRow? track;
  final double volume;

  @override
  Widget build(BuildContext context) {
    final fillColor = palette.brightness == Brightness.light
        ? const Color(0xF7FCFCFC)
        : const Color(0xEA14171B);
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 420),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: fillColor,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: palette.brightness == Brightness.light
                    ? const Color(0x14000000)
                    : const Color(0x22FFFFFF),
              ),
              boxShadow: <BoxShadow>[
                BoxShadow(
                  color: Colors.black.withValues(
                    alpha: palette.brightness == Brightness.light
                        ? 0.06
                        : 0.22,
                  ),
                  blurRadius: 28,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              child: Row(
                children: <Widget>[
                  SizedBox(
                    width: 42,
                    height: 42,
                    child: Button(
                      onPressed: () => unawaited(controller.toggleMiniMode()),
                      style: ButtonStyle(
                        padding: WidgetStateProperty.all(EdgeInsets.zero),
                        backgroundColor: const WidgetStatePropertyAll<Color>(
                          Colors.transparent,
                        ),
                        shape: WidgetStateProperty.all(
                          RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(11),
                          ),
                        ),
                      ),
                      child: TrackArtwork(
                        track: track,
                        palette: palette,
                        size: 42,
                        radius: 11,
                        iconSize: 20,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: PlaybackPresence(
                      playing: controller.isPlaying,
                      pausedOpacity: 0.82,
                      pausedScale: 0.992,
                      pausedOffset: const Offset(0, 0.012),
                      child: Text(
                        track?.title ?? '未播放',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  DockIconButton(
                    palette: palette,
                    active:
                        track != null &&
                        controller.favoriteIds.contains(track!.sourceId),
                    tooltip: '喜欢',
                    onPressed: track == null || track!.sourceId.isEmpty
                        ? null
                        : () => unawaited(controller.toggleFavorite(track!)),
                    child: Icon(
                      track != null &&
                              controller.favoriteIds.contains(track!.sourceId)
                          ? FluentIcons.heart_fill
                          : FluentIcons.heart,
                      size: 14,
                    ),
                  ),
                  const SizedBox(width: 6),
                  DockTransportButton(
                    palette: palette,
                    tooltip: '上一首',
                    onPressed: controller.canNavigateQueue
                        ? () => unawaited(controller.playPrevious())
                        : null,
                    child: const Icon(FluentIcons.previous, size: 15),
                  ),
                  const SizedBox(width: 6),
                  DockTransportButton(
                    palette: palette,
                    main: true,
                    tooltip: controller.isPlaying ? '暂停' : '播放',
                    onPressed: controller.currentTrack == null
                        ? null
                        : () => unawaited(controller.togglePlayPause()),
                    child: Icon(
                      controller.isPlaying
                          ? FluentIcons.pause
                          : FluentIcons.play,
                      size: 16,
                    ),
                  ),
                  const SizedBox(width: 6),
                  DockTransportButton(
                    palette: palette,
                    tooltip: '下一首',
                    onPressed: controller.canNavigateQueue
                        ? () => unawaited(controller.playNext())
                        : null,
                    child: const Icon(FluentIcons.next, size: 15),
                  ),
                  const SizedBox(width: 8),
                  PlayerDockToolsSection(
                    palette: palette,
                    controller: controller,
                    volume: volume,
                    compact: true,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
