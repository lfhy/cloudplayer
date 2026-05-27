// Desktop playlist detail keeps the hero summary and track table separate so
// the main playlist page can stay focused on shared state and mobile behavior.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/track_artwork.dart';
import 'package:cloudplayer_flutter/widgets/track_list.dart';
import 'package:fluent_ui/fluent_ui.dart';

class DesktopPlaylistDetail extends StatelessWidget {
  const DesktopPlaylistDetail({
    super.key,
    required this.palette,
    required this.controller,
    required this.playlist,
    required this.coverTrack,
    required this.selectionMode,
    required this.selectedTrackIds,
    required this.toolbar,
    required this.onToggleSelection,
  });

  final AppPalette palette;
  final AppController controller;
  final PlaylistRow playlist;
  final TrackRow? coverTrack;
  final bool selectionMode;
  final Set<int> selectedTrackIds;
  final Widget toolbar;
  final ValueChanged<TrackRow> onToggleSelection;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const SizedBox(height: 24),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.16),
                    blurRadius: 26,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: TrackArtwork(
                track: coverTrack,
                palette: palette,
                size: 120,
                radius: 12,
                iconSize: 42,
                placeholderIcon: FluentIcons.album,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      playlist.name,
                      style: const TextStyle(
                        fontSize: 42,
                        height: 1.05,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      playlist.isCloud ? '云端歌单' : '本地歌单',
                      style: TextStyle(
                        fontSize: 16,
                        color: palette.mutedForeground,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '共 ${controller.playlistTracks.length} 首曲目',
                      style: TextStyle(
                        fontSize: 14,
                        color: palette.mutedForeground,
                      ),
                    ),
                    const SizedBox(height: 10),
                    toolbar,
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Expanded(
          child: TrackListView(
            tracks: controller.playlistTracks,
            palette: palette,
            favoriteIds: controller.favoriteIds,
            onPlay: (track, index) => controller.playTrack(
              track,
              queue: controller.playlistTracks,
              index: index,
            ),
            onToggleFavorite: controller.toggleFavorite,
            onDownload: controller.enqueueDownload,
            currentTrack: controller.currentTrack,
            currentTrackPlaying: controller.isPlaying,
            showDownloadAction: false,
            selectionMode: selectionMode,
            selectedTrackIds: selectedTrackIds,
            onToggleSelection: onToggleSelection,
            onArtistSearch: (keyword) => controller.triggerTrackSearch(keyword),
            onAlbumSearch: (keyword) => controller.triggerTrackSearch(keyword),
            emptyText: '这个歌单里还没有曲目。',
          ),
        ),
      ],
    );
  }
}
