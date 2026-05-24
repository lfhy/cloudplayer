// Track list renders a compact table-like layout so the main content pages stay close to the legacy Wails presentation.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/legacy_track_icons.dart';
import 'package:cloudplayer_flutter/widgets/track_inline_action.dart';
import 'package:cloudplayer_flutter/widgets/track_artwork.dart';
import 'package:fluent_ui/fluent_ui.dart';

class TrackListView extends StatelessWidget {
  const TrackListView({
    super.key,
    required this.tracks,
    required this.palette,
    required this.favoriteIds,
    required this.onPlay,
    required this.onToggleFavorite,
    required this.onDownload,
    this.currentTrack,
    this.currentTrackPlaying = false,
    this.emptyText = '当前没有可显示的曲目。',
    this.showIndex = false,
    this.showFavoriteAction = true,
    this.showDownloadAction = false,
    this.selectionMode = false,
    this.selectedTrackIds = const <int>{},
    this.onToggleSelection,
    this.onArtistSearch,
    this.onAlbumSearch,
  });

  final List<TrackRow> tracks;
  final AppPalette palette;
  final Set<String> favoriteIds;
  final Future<void> Function(TrackRow track, int index) onPlay;
  final Future<void> Function(TrackRow track) onToggleFavorite;
  final Future<void> Function(TrackRow track) onDownload;
  final TrackRow? currentTrack;
  final bool currentTrackPlaying;
  final String emptyText;
  final bool showIndex;
  final bool showFavoriteAction;
  final bool showDownloadAction;
  final bool selectionMode;
  final Set<int> selectedTrackIds;
  final ValueChanged<TrackRow>? onToggleSelection;
  final ValueChanged<String>? onArtistSearch;
  final ValueChanged<String>? onAlbumSearch;

  @override
  Widget build(BuildContext context) {
    if (tracks.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: palette.subtleBackground,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: palette.borderColor),
        ),
        child: Text(
          emptyText,
          textAlign: TextAlign.center,
          style: TextStyle(color: palette.mutedForeground),
        ),
      );
    }
    final currentPlaybackKey = _trackPlaybackKey(currentTrack);
    final effectiveShowFavoriteAction = selectionMode
        ? false
        : showFavoriteAction;
    final effectiveShowDownloadAction = selectionMode
        ? false
        : showDownloadAction;
    return Column(
      children: <Widget>[
        _TrackHeader(
          palette: palette,
          showIndex: showIndex,
          showFavoriteAction: effectiveShowFavoriteAction,
          showDownloadAction: effectiveShowDownloadAction,
          selectionMode: selectionMode,
        ),
        Expanded(
          child: ListView.builder(
            itemCount: tracks.length,
            itemBuilder: (context, index) {
              final track = tracks[index];
              final isFavorite = favoriteIds.contains(track.sourceId);
              final isCurrentTrack =
                  currentPlaybackKey.isNotEmpty &&
                  currentPlaybackKey == _trackPlaybackKey(track);
              return _TrackRow(
                palette: palette,
                track: track,
                index: index,
                isFavorite: isFavorite,
                isCurrentTrack: isCurrentTrack,
                isNowPlaying: isCurrentTrack && currentTrackPlaying,
                onPlay: onPlay,
                onToggleFavorite: onToggleFavorite,
                onDownload: onDownload,
                showIndex: showIndex,
                showFavoriteAction: effectiveShowFavoriteAction,
                showDownloadAction: effectiveShowDownloadAction,
                selectionMode: selectionMode,
                selected: selectedTrackIds.contains(track.id),
                onToggleSelection: onToggleSelection,
                onArtistSearch: onArtistSearch,
                onAlbumSearch: onAlbumSearch,
              );
            },
          ),
        ),
      ],
    );
  }
}

class _TrackHeader extends StatelessWidget {
  const _TrackHeader({
    required this.palette,
    required this.showIndex,
    required this.showFavoriteAction,
    required this.showDownloadAction,
    required this.selectionMode,
  });

  final AppPalette palette;
  final bool showIndex;
  final bool showFavoriteAction;
  final bool showDownloadAction;
  final bool selectionMode;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: palette.borderColor)),
      ),
      child: Row(
        children: <Widget>[
          if (selectionMode)
            SizedBox(
              width: 44,
              child: _HeaderText('选择', palette, center: true),
            ),
          if (showIndex) SizedBox(width: 36, child: _HeaderText('#', palette)),
          const SizedBox(width: 52),
          Expanded(flex: 4, child: _HeaderText('标题', palette)),
          Expanded(flex: 3, child: _HeaderText('专辑', palette)),
          if (showFavoriteAction)
            SizedBox(
              width: 52,
              child: _HeaderText('喜欢', palette, center: true),
            ),
          if (showDownloadAction)
            SizedBox(
              width: 52,
              child: _HeaderText('下载', palette, center: true),
            ),
          SizedBox(width: 56, child: _HeaderText('时长', palette, right: true)),
        ],
      ),
    );
  }
}

class _HeaderText extends StatelessWidget {
  const _HeaderText(
    this.label,
    this.palette, {
    this.center = false,
    this.right = false,
  });

  final String label;
  final AppPalette palette;
  final bool center;
  final bool right;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      textAlign: center
          ? TextAlign.center
          : right
          ? TextAlign.right
          : TextAlign.left,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: palette.mutedForeground,
      ),
    );
  }
}

class _TrackRow extends StatelessWidget {
  const _TrackRow({
    required this.palette,
    required this.track,
    required this.index,
    required this.isFavorite,
    required this.isCurrentTrack,
    required this.isNowPlaying,
    required this.onPlay,
    required this.onToggleFavorite,
    required this.onDownload,
    required this.showIndex,
    required this.showFavoriteAction,
    required this.showDownloadAction,
    required this.selectionMode,
    required this.selected,
    required this.onToggleSelection,
    required this.onArtistSearch,
    required this.onAlbumSearch,
  });

  final AppPalette palette;
  final TrackRow track;
  final int index;
  final bool isFavorite;
  final bool isCurrentTrack;
  final bool isNowPlaying;
  final Future<void> Function(TrackRow track, int index) onPlay;
  final Future<void> Function(TrackRow track) onToggleFavorite;
  final Future<void> Function(TrackRow track) onDownload;
  final bool showIndex;
  final bool showFavoriteAction;
  final bool showDownloadAction;
  final bool selectionMode;
  final bool selected;
  final ValueChanged<TrackRow>? onToggleSelection;
  final ValueChanged<String>? onArtistSearch;
  final ValueChanged<String>? onAlbumSearch;

  @override
  Widget build(BuildContext context) {
    final selectHandler = onToggleSelection;
    return HoverButton(
      onPressed: selectionMode
          ? selectHandler == null
                ? null
                : () => selectHandler(track)
          : () => onPlay(track, index),
      builder: (context, states) {
        final hovered = states.isHovered;
        return Container(
          constraints: const BoxConstraints(minHeight: 62),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: _rowBackgroundColor(hovered),
            gradient: _rowBackgroundGradient(),
            border: Border(bottom: BorderSide(color: palette.borderColor)),
          ),
          child: Row(
            children: <Widget>[
              if (selectionMode)
                SizedBox(
                  width: 44,
                  child: IgnorePointer(
                    child: Center(
                      child: Checkbox(checked: selected, onChanged: (_) {}),
                    ),
                  ),
                ),
              if (showIndex)
                SizedBox(
                  width: 36,
                  child: Text(
                    '${index + 1}',
                    textAlign: TextAlign.left,
                    style: TextStyle(
                      fontSize: 12,
                      color: palette.mutedForeground,
                    ),
                  ),
                ),
              if (showIndex) const SizedBox(width: 12),
              TrackArtwork(
                track: track,
                palette: palette,
                size: 40,
                radius: 4,
                iconSize: 16,
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 4,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      track.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isNowPlaying
                            ? palette.accent.normal
                            : palette.strongForeground,
                      ),
                    ),
                    const SizedBox(height: 2),
                    TrackInlineAction(
                      label: track.artist.ifEmpty('未知歌手'),
                      value: track.artist,
                      onPressed: onArtistSearch,
                      palette: palette,
                    ),
                  ],
                ),
              ),
              Expanded(
                flex: 3,
                child: Padding(
                  padding: const EdgeInsets.only(left: 12),
                  child: TrackInlineAction(
                    label: track.album.ifEmpty('未补全播放信息'),
                    value: track.album,
                    onPressed: onAlbumSearch,
                    palette: palette,
                  ),
                ),
              ),
              if (showFavoriteAction)
                SizedBox(
                  width: 52,
                  child: Button(
                    onPressed: track.sourceId.isEmpty
                        ? null
                        : () => onToggleFavorite(track),
                    style: ButtonStyle(
                      padding: WidgetStateProperty.all(EdgeInsets.zero),
                      backgroundColor: WidgetStateProperty.resolveWith(
                        (_) => Colors.transparent,
                      ),
                      foregroundColor: WidgetStateProperty.resolveWith(
                        (states) => isFavorite || states.isHovered
                            ? palette.accent.normal
                            : palette.mutedForeground,
                      ),
                      shape: WidgetStateProperty.all(
                        RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                    ),
                    child: LegacyFavoriteIcon(
                      color: isFavorite
                          ? palette.accent.normal
                          : palette.mutedForeground,
                      filled: isFavorite,
                    ),
                  ),
                ),
              if (showDownloadAction)
                SizedBox(
                  width: 52,
                  child: IconButton(
                    icon: const Icon(FluentIcons.download, size: 16),
                    onPressed: track.sourceId.isEmpty
                        ? null
                        : () => onDownload(track),
                  ),
                ),
              SizedBox(
                width: 56,
                child: Text(
                  _formatDuration(track.durationMs),
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    color: palette.mutedForeground,
                    fontFeatures: const <FontFeature>[
                      FontFeature.tabularFigures(),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _formatDuration(int durationMs) {
    if (durationMs <= 0) return '--:--';
    final totalSeconds = durationMs ~/ 1000;
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  Color _rowBackgroundColor(bool hovered) {
    if (selectionMode && selected) {
      return palette.accent.normal.withValues(alpha: 0.10);
    }
    if (isCurrentTrack || isNowPlaying) {
      return Colors.transparent;
    }
    return hovered
        ? palette.accent.normal.withValues(alpha: 0.06)
        : Colors.transparent;
  }

  Gradient? _rowBackgroundGradient() {
    if (selectionMode) {
      return null;
    }
    if (isNowPlaying) {
      return LinearGradient(
        colors: <Color>[
          palette.accent.normal.withValues(alpha: 0.16),
          palette.accent.normal.withValues(alpha: 0.04),
          Colors.transparent,
        ],
        stops: const <double>[0, 0.42, 1],
      );
    }
    if (isCurrentTrack) {
      return LinearGradient(
        colors: <Color>[
          palette.accent.normal.withValues(alpha: 0.12),
          palette.accent.normal.withValues(alpha: 0.02),
          Colors.transparent,
        ],
        stops: const <double>[0, 0.42, 1],
      );
    }
    return null;
  }
}

extension on String {
  String ifEmpty(String fallback) => trim().isEmpty ? fallback : this;
}

String _trackPlaybackKey(TrackRow? track) {
  if (track == null) {
    return '';
  }
  final sourceId = track.sourceId.trim();
  if (sourceId.isNotEmpty) {
    return 'sid:$sourceId';
  }
  final localPath = track.localPath.trim();
  if (localPath.isNotEmpty) {
    return 'file:$localPath';
  }
  return '';
}
