// Home page keeps the legacy flat header and list-row layout instead of card-heavy dashboard blocks.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/track_artwork.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key, required this.palette});

  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final greeting = _greetingForHour(DateTime.now().hour);
    final dateLine = _homeDateLine(controller.recentTracks.length);
    final dailyRows =
        controller.dailyRecommendation?.rows.take(6).toList() ??
        const <TrackRow>[];
    final recentRows = controller.recentTracks.take(6).toList();
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 760;
        return SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _Header(
                palette: palette,
                greeting: greeting,
                dateLine: dateLine,
                playlistCount: controller.playlists.length,
                recentCount: controller.recentTracks.length,
                downloadCount: controller.downloadQueue.length,
                compact: compact,
              ),
              const SizedBox(height: 18),
              if (compact) ...<Widget>[
                _PreviewColumn(
                  palette: palette,
                  eyebrow: '每日推荐',
                  title: '今天听这些',
                  rows: dailyRows,
                  emptyText: '需要一些播放记录后才会生成每日推荐。',
                  onOpen: () => controller.setPage(AppPage.daily),
                  onPlay: (track, index) => controller.playTrack(
                    track,
                    queue: controller.dailyRecommendation?.rows ?? dailyRows,
                    index: index,
                  ),
                ),
                const SizedBox(height: 16),
                _PreviewColumn(
                  palette: palette,
                  eyebrow: '继续收听',
                  title: '最近播放',
                  rows: recentRows,
                  emptyText: '还没有最近播放，去搜索或导入歌单开始吧。',
                  onOpen: () => controller.setPage(AppPage.recent),
                  onPlay: (track, index) => controller.playTrack(
                    track,
                    queue: controller.recentTracks,
                    index: index,
                  ),
                ),
              ] else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Expanded(
                      child: _PreviewColumn(
                        palette: palette,
                        eyebrow: '每日推荐',
                        title: '今天听这些',
                        rows: dailyRows,
                        emptyText: '需要一些播放记录后才会生成每日推荐。',
                        onOpen: () => controller.setPage(AppPage.daily),
                        onPlay: (track, index) => controller.playTrack(
                          track,
                          queue:
                              controller.dailyRecommendation?.rows ?? dailyRows,
                          index: index,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: _PreviewColumn(
                        palette: palette,
                        eyebrow: '继续收听',
                        title: '最近播放',
                        rows: recentRows,
                        emptyText: '还没有最近播放，去搜索或导入歌单开始吧。',
                        onOpen: () => controller.setPage(AppPage.recent),
                        onPlay: (track, index) => controller.playTrack(
                          track,
                          queue: controller.recentTracks,
                          index: index,
                        ),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.palette,
    required this.greeting,
    required this.dateLine,
    required this.playlistCount,
    required this.recentCount,
    required this.downloadCount,
    required this.compact,
  });

  final AppPalette palette;
  final String greeting;
  final String dateLine;
  final int playlistCount;
  final int recentCount;
  final int downloadCount;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final headline = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          'CloudPlayer',
          style: TextStyle(
            color: palette.accent.normal,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          greeting,
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w700,
            color: palette.strongForeground,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          dateLine,
          style: TextStyle(color: palette.mutedForeground, fontSize: 13),
        ),
      ],
    );
    final stats = Wrap(
      spacing: 6,
      runSpacing: 6,
      alignment: compact ? WrapAlignment.start : WrapAlignment.end,
      children: <Widget>[
        _StatPill(label: '歌单', value: playlistCount, palette: palette),
        _StatPill(label: '播放记录', value: recentCount, palette: palette),
        _StatPill(label: '下载中', value: downloadCount, palette: palette),
      ],
    );
    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[headline, const SizedBox(height: 12), stats],
      );
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: <Widget>[
        Expanded(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: headline,
          ),
        ),
        const SizedBox(width: 24),
        Flexible(
          child: Align(
            alignment: Alignment.centerRight,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 320),
              child: stats,
            ),
          ),
        ),
      ],
    );
  }
}

class _StatPill extends StatelessWidget {
  const _StatPill({
    required this.label,
    required this.value,
    required this.palette,
  });

  final String label;
  final int value;
  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: palette.subtleBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: palette.borderColor.withValues(alpha: 0.3)),
      ),
      child: Text(
        '$label  $value',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: palette.mutedForeground,
        ),
      ),
    );
  }
}

class _PreviewColumn extends StatelessWidget {
  const _PreviewColumn({
    required this.palette,
    required this.eyebrow,
    required this.title,
    required this.rows,
    required this.emptyText,
    required this.onOpen,
    required this.onPlay,
  });

  final AppPalette palette;
  final String eyebrow;
  final String title;
  final List<TrackRow> rows;
  final String emptyText;
  final VoidCallback onOpen;
  final Future<void> Function(TrackRow track, int index) onPlay;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        HoverButton(
          onPressed: onOpen,
          builder: (context, states) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  eyebrow,
                  style: TextStyle(
                    color: palette.accent.normal,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: states.isHovered
                        ? palette.accent.normal
                        : palette.strongForeground,
                  ),
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 10),
        if (rows.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
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
          )
        else
          Column(
            children: List<Widget>.generate(rows.length, (index) {
              final track = rows[index];
              return Padding(
                padding: EdgeInsets.only(
                  bottom: index == rows.length - 1 ? 0 : 6,
                ),
                child: _HomeRow(
                  palette: palette,
                  track: track,
                  index: index,
                  onPressed: () => onPlay(track, index),
                ),
              );
            }),
          ),
      ],
    );
  }
}

class _HomeRow extends StatelessWidget {
  const _HomeRow({
    required this.palette,
    required this.track,
    required this.index,
    required this.onPressed,
  });

  final AppPalette palette;
  final TrackRow track;
  final int index;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return HoverButton(
      onPressed: onPressed,
      builder: (context, states) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: states.isHovered
                ? palette.subtleBackground
                : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: <Widget>[
              SizedBox(
                width: 24,
                child: Text(
                  '${index + 1}'.padLeft(2, '0'),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: palette.mutedForeground,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              TrackArtwork(
                track: track,
                palette: palette,
                size: 44,
                radius: 10,
                iconSize: 16,
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
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      track.artist.isEmpty ? '未知歌手' : track.artist,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: palette.mutedForeground,
                        fontSize: 12,
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

String _greetingForHour(int hour) {
  if (hour < 11) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

String _homeDateLine(int recentCount) {
  const weekdays = <String>['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const months = <String>[
    '一月',
    '二月',
    '三月',
    '四月',
    '五月',
    '六月',
    '七月',
    '八月',
    '九月',
    '十月',
    '十一月',
    '十二月',
  ];
  final now = DateTime.now();
  final weekday = weekdays[now.weekday - 1];
  final month = months[now.month - 1];
  final suffix = recentCount > 0 ? '共 $recentCount 首播放记录' : '先开始听几首歌吧';
  return '$weekday · $month ${now.day} 日 · $suffix';
}
