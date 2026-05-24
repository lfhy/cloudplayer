// Playlist detail page keeps the old hero summary while reusing the shared track list below.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/legacy_action_button.dart';
import 'package:cloudplayer_flutter/widgets/track_artwork.dart';
import 'package:cloudplayer_flutter/widgets/track_list.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

class PlaylistPage extends StatefulWidget {
  const PlaylistPage({super.key, required this.palette});

  final AppPalette palette;

  @override
  State<PlaylistPage> createState() => _PlaylistPageState();
}

class _PlaylistPageState extends State<PlaylistPage> {
  bool _selectionMode = false;
  Set<int> _selectedTrackIds = <int>{};
  int? _selectionPlaylistId;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final playlist = controller.selectedPlaylist;
    final coverTrack = controller.playlistTracks.isNotEmpty
        ? controller.playlistTracks.first
        : null;
    _syncSelectionState(playlist?.id, controller.playlistTracks);
    if (playlist == null) {
      return Center(
        child: Text(
          '暂无歌单。',
          style: TextStyle(color: widget.palette.mutedForeground),
        ),
      );
    }
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
                palette: widget.palette,
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
                        color: widget.palette.mutedForeground,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '共 ${controller.playlistTracks.length} 首曲目',
                      style: TextStyle(
                        fontSize: 14,
                        color: widget.palette.mutedForeground,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _buildToolbar(context, controller),
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
            palette: widget.palette,
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
            selectionMode: _selectionMode,
            selectedTrackIds: _selectedTrackIds,
            onToggleSelection: _toggleTrackSelection,
            onArtistSearch: (keyword) => controller.triggerTrackSearch(keyword),
            onAlbumSearch: (keyword) => controller.triggerTrackSearch(keyword),
            emptyText: '这个歌单里还没有曲目。',
          ),
        ),
      ],
    );
  }

  Widget _buildToolbar(BuildContext context, AppController controller) {
    if (_selectionMode) {
      return Wrap(
        spacing: 8,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: <Widget>[
          Text(
            '已选 ${_selectedTrackIds.length} 首',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: widget.palette.mutedForeground,
            ),
          ),
          LegacyActionButton(
            palette: widget.palette,
            onPressed: _exitSelectionMode,
            label: '取消批量',
          ),
          LegacyActionButton(
            palette: widget.palette,
            onPressed: controller.playlistTracks.isEmpty
                ? null
                : _selectAllTracks,
            label: '全选',
          ),
          LegacyActionButton(
            palette: widget.palette,
            onPressed: _selectedTrackIds.isEmpty
                ? null
                : () => _removeSelectedTracks(controller),
            label: '从歌单移除',
          ),
        ],
      );
    }
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: <Widget>[
        LegacyActionButton(
          palette: widget.palette,
          accent: true,
          showPlayGlyph: true,
          onPressed: controller.playlistTracks.isEmpty
              ? null
              : controller.playPlaylistAll,
          label: '播放全部',
        ),
        LegacyActionButton(
          palette: widget.palette,
          onPressed: controller.playlistTracks.isEmpty
              ? null
              : _enterSelectionMode,
          label: '批量操作',
        ),
        LegacyActionButton(
          palette: widget.palette,
          onPressed: controller.loadSelectedPlaylist,
          label: '刷新歌单',
        ),
        LegacyActionButton(
          palette: widget.palette,
          onPressed: controller.enrichCurrentPlaylist,
          label: '补全播放信息',
        ),
      ],
    );
  }

  void _syncSelectionState(int? playlistId, List<TrackRow> tracks) {
    if (_selectionPlaylistId != playlistId) {
      _selectionPlaylistId = playlistId;
      _selectionMode = false;
      _selectedTrackIds = <int>{};
      return;
    }
    final validIds = tracks
        .map((track) => track.id)
        .where((id) => id > 0)
        .toSet();
    final filtered = _selectedTrackIds.intersection(validIds);
    if (filtered.length != _selectedTrackIds.length) {
      _selectedTrackIds = filtered;
    }
  }

  void _enterSelectionMode() {
    setState(() {
      _selectionMode = true;
      _selectedTrackIds = <int>{};
    });
  }

  void _exitSelectionMode() {
    setState(() {
      _selectionMode = false;
      _selectedTrackIds = <int>{};
    });
  }

  void _toggleTrackSelection(TrackRow track) {
    if (track.id <= 0) {
      return;
    }
    setState(() {
      final next = Set<int>.from(_selectedTrackIds);
      if (!next.add(track.id)) {
        next.remove(track.id);
      }
      _selectedTrackIds = next;
    });
  }

  void _selectAllTracks() {
    final controller = context.read<AppController>();
    setState(() {
      _selectedTrackIds = controller.playlistTracks
          .map((track) => track.id)
          .where((id) => id > 0)
          .toSet();
    });
  }

  Future<void> _removeSelectedTracks(AppController controller) async {
    final selectedIds = _selectedTrackIds.toList(growable: false);
    await controller.removeTracksFromSelectedPlaylist(selectedIds);
    if (!mounted) {
      return;
    }
    setState(() {
      _selectionMode = false;
      _selectedTrackIds = <int>{};
    });
  }
}
