// The player dock keeps transport actions, queue flyouts, and now-playing metadata aligned with the legacy Wails footer.

import 'dart:async';

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/child_window_dialog.dart';
import 'package:cloudplayer_flutter/widgets/playback_presence.dart';
import 'package:cloudplayer_flutter/widgets/player_dock_buttons.dart';
import 'package:cloudplayer_flutter/widgets/player_dock_flyouts.dart';
import 'package:cloudplayer_flutter/widgets/player_dock_tools.dart';
import 'package:cloudplayer_flutter/widgets/player_dock_utils.dart';
import 'package:cloudplayer_flutter/widgets/track_artwork.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

class PlayerDock extends StatefulWidget {
  const PlayerDock({super.key, required this.palette});

  final AppPalette palette;

  @override
  State<PlayerDock> createState() => _PlayerDockState();
}

class _PlayerDockState extends State<PlayerDock> {
  final FlyoutController _downloadController = FlyoutController();
  final FlyoutController _moreController = FlyoutController();
  final FlyoutController _queueController = FlyoutController();

  @override
  void dispose() {
    _downloadController.dispose();
    _moreController.dispose();
    _queueController.dispose();
    super.dispose();
  }

  Future<void> _showDownloadMenu(
    AppController controller,
    TrackRow? track,
  ) async {
    if (_downloadController.isOpen || track == null || track.sourceId.isEmpty) {
      return;
    }
    await _downloadController.showFlyout<void>(
      barrierColor: Colors.transparent,
      dismissOnPointerMoveAway: true,
      autoModeConfiguration: FlyoutAutoConfiguration(
        preferredMode: FlyoutPlacementMode.topCenter,
      ),
      builder: (menuContext) => FlyoutContent(
        useAcrylic: false,
        elevation: 10,
        padding: const EdgeInsets.all(6),
        constraints: const BoxConstraints(minWidth: 168, maxWidth: 168),
        color: widget.palette.cardBackground,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: widget.palette.borderColor),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            DockFlyoutActionButton(
              palette: widget.palette,
              label: 'FLAC 无损',
              onPressed: () => _runFlyoutAction(
                menuContext,
                () => controller.enqueueDownload(track, quality: 'flac'),
              ),
            ),
            DockFlyoutActionButton(
              palette: widget.palette,
              label: 'HQ 高品质',
              onPressed: () => _runFlyoutAction(
                menuContext,
                () => controller.enqueueDownload(track, quality: '320'),
              ),
            ),
            DockFlyoutActionButton(
              palette: widget.palette,
              label: '标准 128K',
              onPressed: () => _runFlyoutAction(
                menuContext,
                () => controller.enqueueDownload(track),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showMoreMenu(AppController controller, TrackRow? track) async {
    if (_moreController.isOpen) return;
    await _moreController.showFlyout<void>(
      barrierColor: Colors.transparent,
      dismissOnPointerMoveAway: true,
      autoModeConfiguration: FlyoutAutoConfiguration(
        preferredMode: FlyoutPlacementMode.topCenter,
      ),
      builder: (menuContext) => FlyoutContent(
        useAcrylic: false,
        elevation: 10,
        padding: const EdgeInsets.all(6),
        constraints: const BoxConstraints(minWidth: 188, maxWidth: 188),
        color: widget.palette.cardBackground,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: widget.palette.borderColor),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            DockFlyoutActionButton(
              palette: widget.palette,
              label: '添加到歌单',
              onPressed: track == null
                  ? null
                  : () => _runFlyoutAction(
                      menuContext,
                      () => _addTrackToPlaylist(controller, track),
                    ),
            ),
            DockFlyoutActionButton(
              palette: widget.palette,
              label: '从播放列表删除',
              danger: true,
              onPressed: controller.currentTrack == null
                  ? null
                  : () => _runFlyoutAction(
                      menuContext,
                      controller.removeCurrentFromQueue,
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showQueueMenu(AppController controller) async {
    if (_queueController.isOpen) return;
    await _queueController.showFlyout<void>(
      barrierColor: Colors.transparent,
      dismissOnPointerMoveAway: true,
      autoModeConfiguration: FlyoutAutoConfiguration(
        preferredMode: FlyoutPlacementMode.topCenter,
      ),
      builder: (menuContext) => PlayerQueueFlyout(
        palette: widget.palette,
        tracks: controller.playQueue,
        currentIndex: controller.playIndex,
        onSelect: (index) => _runFlyoutAction(
          menuContext,
          () => controller.playFromQueueIndex(index),
        ),
      ),
    );
  }

  Future<void> _runFlyoutAction(
    BuildContext menuContext,
    FutureOr<void> Function() action,
  ) async {
    Navigator.of(menuContext).pop();
    await Future<void>.delayed(Duration.zero);
    await action();
  }

  Future<void> _addTrackToPlaylist(
    AppController controller,
    TrackRow track,
  ) async {
    if (controller.playlists.isEmpty) return;
    final playlistId = await showPlaylistTargetDialog(
      context: context,
      palette: widget.palette,
      playlists: controller.playlists,
      initialPlaylistId: controller.selectedPlaylist?.id,
    );
    if (playlistId == null || !mounted) return;
    await controller.appendTrackToPlaylist(track, playlistId);
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final track = controller.currentTrack;
    final progressMax = controller.duration.inMilliseconds <= 0
        ? 1.0
        : controller.duration.inMilliseconds.toDouble();
    final progressValue = controller.position.inMilliseconds
        .clamp(0, progressMax.toInt())
        .toDouble();
    final volume = (controller.settings?.volume ?? 0.7) * 100;
    return Container(
      constraints: const BoxConstraints(minHeight: 84),
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: widget.palette.borderColor)),
        color: widget.palette.cardBackground,
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: Colors.black.withValues(
              alpha: widget.palette.brightness == Brightness.light
                  ? 0.06
                  : 0.18,
            ),
            blurRadius: 16,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            flex: 3,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                SizedBox(
                  width: 60,
                  height: 60,
                  child: Button(
                    onPressed: () => unawaited(controller.toggleImmersive()),
                    style: ButtonStyle(
                      padding: WidgetStateProperty.all(EdgeInsets.zero),
                      backgroundColor: WidgetStatePropertyAll<Color>(
                        Colors.transparent,
                      ),
                      shape: WidgetStateProperty.all(
                        RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                    child: TrackArtwork(
                      track: track,
                      palette: widget.palette,
                      size: 60,
                      radius: 12,
                      iconSize: 28,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: PlaybackPresence(
                    playing: controller.isPlaying,
                    pausedOpacity: 0.82,
                    pausedScale: 0.992,
                    pausedOffset: const Offset(0, 0.012),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          track?.title ?? '未播放',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          dockSubtitleForTrack(track),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: widget.palette.mutedForeground,
                            fontSize: 11,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: <Widget>[
                            DockIconButton(
                              palette: widget.palette,
                              active:
                                  track != null &&
                                  controller.favoriteIds.contains(
                                    track.sourceId,
                                  ),
                              tooltip: '喜欢',
                              onPressed: track == null || track.sourceId.isEmpty
                                  ? null
                                  : () => unawaited(
                                      controller.toggleFavorite(track),
                                    ),
                              child: Icon(
                                track != null &&
                                        controller.favoriteIds.contains(
                                          track.sourceId,
                                        )
                                    ? FluentIcons.heart_fill
                                    : FluentIcons.heart,
                                size: 14,
                              ),
                            ),
                            const SizedBox(width: 2),
                            FlyoutTarget(
                              controller: _downloadController,
                              child: DockIconButton(
                                palette: widget.palette,
                                tooltip: '下载（选择音质）',
                                onPressed:
                                    track == null || track.sourceId.isEmpty
                                    ? null
                                    : () =>
                                          _showDownloadMenu(controller, track),
                                child: const Text(
                                  '⇣',
                                  style: TextStyle(
                                    fontSize: 15,
                                    height: 1,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 2),
                            FlyoutTarget(
                              controller: _moreController,
                              child: DockIconButton(
                                palette: widget.palette,
                                tooltip: '更多',
                                child: const Text(
                                  '⋯',
                                  style: TextStyle(
                                    fontSize: 16,
                                    height: 1,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                onPressed: () =>
                                    _showMoreMenu(controller, track),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            flex: 4,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    DockModeButton(
                      palette: widget.palette,
                      transport: true,
                      tooltip: dockPlayModeTip(controller.currentPlayMode),
                      onPressed: controller.settings == null
                          ? null
                          : () => unawaited(
                              controller.setPlayMode(
                                nextDockPlayMode(controller.currentPlayMode),
                              ),
                            ),
                      child: Icon(
                        dockPlayModeIcon(controller.currentPlayMode),
                        size: 15,
                        color: widget.palette.accent.normal,
                      ),
                    ),
                    const SizedBox(width: 10),
                    DockTransportButton(
                      palette: widget.palette,
                      tooltip: '上一首',
                      onPressed: controller.canNavigateQueue
                          ? () => unawaited(controller.playPrevious())
                          : null,
                      child: const Icon(FluentIcons.previous, size: 16),
                    ),
                    const SizedBox(width: 8),
                    DockTransportButton(
                      palette: widget.palette,
                      main: true,
                      tooltip: controller.isPlaying ? '暂停' : '播放',
                      onPressed: controller.currentTrack == null
                          ? null
                          : () => unawaited(controller.togglePlayPause()),
                      child: Icon(
                        controller.isPlaying
                            ? FluentIcons.pause
                            : FluentIcons.play,
                        size: 17,
                      ),
                    ),
                    const SizedBox(width: 8),
                    DockTransportButton(
                      palette: widget.palette,
                      tooltip: '下一首',
                      onPressed: controller.canNavigateQueue
                          ? () => unawaited(controller.playNext())
                          : null,
                      child: const Icon(FluentIcons.next, size: 16),
                    ),
                    const SizedBox(width: 10),
                    FlyoutTarget(
                      controller: _queueController,
                      child: DockModeButton(
                        palette: widget.palette,
                        tooltip: '播放队列',
                        onPressed: () => _showQueueMenu(controller),
                        child: const Text(
                          '☰',
                          style: TextStyle(
                            fontSize: 14,
                            height: 1,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: <Widget>[
                    SizedBox(
                      width: 44,
                      child: Text(
                        formatDockDuration(controller.position),
                        style: TextStyle(
                          color: widget.palette.mutedForeground,
                          fontFeatures: const <FontFeature>[
                            FontFeature.tabularFigures(),
                          ],
                        ),
                      ),
                    ),
                    Expanded(
                      child: Slider(
                        value: progressValue,
                        max: progressMax,
                        onChanged: controller.currentTrack == null
                            ? null
                            : (value) => controller.seekTo(
                                Duration(milliseconds: value.round()),
                              ),
                      ),
                    ),
                    SizedBox(
                      width: 44,
                      child: Text(
                        formatDockDuration(controller.duration),
                        textAlign: TextAlign.end,
                        style: TextStyle(
                          color: widget.palette.mutedForeground,
                          fontFeatures: const <FontFeature>[
                            FontFeature.tabularFigures(),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          PlayerDockToolsSection(
            palette: widget.palette,
            controller: controller,
            volume: volume,
          ),
        ],
      ),
    );
  }
}
