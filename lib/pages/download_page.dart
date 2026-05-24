// Download page mirrors the old toolbar copy while showing the locally mirrored queue state.

import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/track_list.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

class DownloadPage extends StatelessWidget {
  const DownloadPage({super.key, required this.palette});

  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final settings = controller.settings;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    '下载管理',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                  ),
                  SizedBox(height: 6),
                  Text('在搜索结果、歌单和推荐页里把歌曲加入下载后，会统一出现在这里。'),
                ],
              ),
            ),
            Button(
              onPressed: controller.pickDownloadFolder,
              child: const Text('下载保存目录…'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          settings?.downloadFolder.isNotEmpty == true
              ? settings!.downloadFolder
              : '尚未设置下载保存目录',
          style: TextStyle(color: palette.mutedForeground),
        ),
        const SizedBox(height: 14),
        Expanded(
          child: TrackListView(
            tracks: controller.downloadQueue,
            palette: palette,
            favoriteIds: controller.favoriteIds,
            onPlay: (track, index) => controller.playTrack(
              track,
              queue: controller.downloadQueue,
              index: index,
            ),
            onToggleFavorite: controller.toggleFavorite,
            onDownload: controller.enqueueDownload,
            currentTrack: controller.currentTrack,
            currentTrackPlaying: controller.isPlaying,
            showFavoriteAction: false,
            showDownloadAction: false,
            onArtistSearch: (keyword) => controller.triggerTrackSearch(keyword),
            onAlbumSearch: (keyword) => controller.triggerTrackSearch(keyword),
            emptyText: '在搜索结果、歌单和推荐页里把歌曲加入下载后，会统一出现在这里。',
          ),
        ),
      ],
    );
  }
}
