// Daily recommendation page mirrors the legacy page heading and shared track table layout.

import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/child_window/child_window_dialogs.dart';
import 'package:cloudplayer_flutter/widgets/legacy_action_button.dart';
import 'package:cloudplayer_flutter/widgets/track_list.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

class DailyPage extends StatelessWidget {
  const DailyPage({super.key, required this.palette});

  final AppPalette palette;

  Future<void> _saveAsPlaylist(
    BuildContext context,
    AppController controller,
  ) async {
    final rows = controller.dailyRecommendation?.rows ?? const [];
    if (rows.isEmpty) return;
    final suggestedName = '每日推荐 ${controller.dailyRecommendation?.date ?? ''}'
        .trim();
    final playlistName = await showChildTextPromptDialog(
      context: context,
      palette: palette,
      title: '保存为歌单',
      confirmText: '开始保存',
      placeholder: '歌单名称',
      initialValue: suggestedName,
      emptyErrorText: '歌单名称不能为空。',
    );
    if (playlistName == null || !context.mounted) return;
    try {
      await runWithChildLoadingDialog<void>(
        context: context,
        palette: palette,
        title: '正在保存歌单…',
        message: '请稍等，正在写入歌单和歌曲列表。',
        task: () => controller.saveDailyAsPlaylist(playlistName),
      );
    } catch (error) {
      if (!context.mounted) return;
      await showChildMessageDialog(
        context: context,
        palette: palette,
        title: '保存失败',
        message: error.toString(),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final rows = controller.dailyRecommendation?.rows ?? const [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            const Expanded(
              child: Text(
                '每日推荐',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
              ),
            ),
            LegacyActionButton(
              palette: palette,
              accent: true,
              showPlayGlyph: true,
              onPressed: rows.isEmpty ? null : controller.playDailyAll,
              label: '播放全部',
            ),
            const SizedBox(width: 8),
            LegacyActionButton(
              palette: palette,
              onPressed: rows.isEmpty
                  ? null
                  : () => _saveAsPlaylist(context, controller),
              label: '保存为歌单',
            ),
            const SizedBox(width: 8),
            LegacyActionButton(
              palette: palette,
              onPressed: () => controller.refreshDaily(force: true),
              label: '重新生成',
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
            emptyText: '最近播放还不够，先听几首歌再回来生成每日推荐。',
          ),
        ),
      ],
    );
  }
}
