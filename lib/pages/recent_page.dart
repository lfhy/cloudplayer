// Recent page keeps the legacy heading and clear action above the shared track list.

import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/legacy_action_button.dart';
import 'package:cloudplayer_flutter/widgets/track_list.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

class RecentPage extends StatelessWidget {
  const RecentPage({super.key, required this.palette});

  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final rows = controller.recentTracks;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            const Expanded(
              child: Text(
                '最近播放',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
              ),
            ),
            LegacyActionButton(
              palette: palette,
              onPressed: rows.isEmpty ? null : controller.clearRecentPlays,
              label: '清空',
            ),
          ],
        ),
        const SizedBox(height: 14),
        Expanded(
          child: TrackListView(
            tracks: rows,
            palette: palette,
            favoriteIds: controller.favoriteIds,
            onPlay: (track, index) =>
                controller.playTrack(track, queue: rows, index: index),
            onToggleFavorite: controller.toggleFavorite,
            onDownload: controller.enqueueDownload,
            currentTrack: controller.currentTrack,
            currentTrackPlaying: controller.isPlaying,
            onArtistSearch: (keyword) => controller.triggerTrackSearch(keyword),
            onAlbumSearch: (keyword) => controller.triggerTrackSearch(keyword),
            emptyText: '还没有最近播放，去搜索或导入歌单开始吧。',
          ),
        ),
      ],
    );
  }
}
