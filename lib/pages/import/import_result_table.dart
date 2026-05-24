// Import result table mirrors the legacy four-column layout instead of the shared playback-oriented track list.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';

class ImportResultTable extends StatelessWidget {
  const ImportResultTable({
    super.key,
    required this.tracks,
    required this.palette,
    required this.onPlay,
    this.emptyText = '导入完成后会自动打开歌单详情页，你可以继续对歌单重命名。',
  });

  final List<TrackRow> tracks;
  final AppPalette palette;
  final Future<void> Function(TrackRow track, int index) onPlay;
  final String emptyText;

  @override
  Widget build(BuildContext context) {
    if (tracks.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: palette.cardBackground,
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
    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: palette.borderColor),
      ),
      child: Column(
        children: <Widget>[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: palette.subtleBackground,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
            ),
            child: Row(
              children: <Widget>[
                SizedBox(width: 40, child: _HeaderText('#', palette)),
                Expanded(flex: 4, child: _HeaderText('歌名', palette)),
                Expanded(flex: 3, child: _HeaderText('歌手', palette)),
                Expanded(flex: 3, child: _HeaderText('专辑', palette)),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: tracks.length,
              itemBuilder: (context, index) {
                final track = tracks[index];
                return HoverButton(
                  onPressed: () => onPlay(track, index),
                  builder: (context, states) {
                    return Container(
                      constraints: const BoxConstraints(minHeight: 48),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: states.isHovered
                            ? palette.accent.normal.withValues(alpha: 0.06)
                            : Colors.transparent,
                        border: Border(
                          top: BorderSide(color: palette.borderColor.withValues(alpha: 0.65)),
                        ),
                      ),
                      child: Row(
                        children: <Widget>[
                          SizedBox(
                            width: 40,
                            child: Text(
                              '${index + 1}',
                              style: TextStyle(
                                fontSize: 12,
                                color: palette.mutedForeground,
                              ),
                            ),
                          ),
                          Expanded(
                            flex: 4,
                            child: Text(
                              track.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: palette.strongForeground,
                              ),
                            ),
                          ),
                          Expanded(
                            flex: 3,
                            child: Padding(
                              padding: const EdgeInsets.only(left: 12),
                              child: Text(
                                track.artist.trim().isEmpty ? '未知歌手' : track.artist,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: palette.mutedForeground,
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            flex: 3,
                            child: Padding(
                              padding: const EdgeInsets.only(left: 12),
                              child: Text(
                                track.album.trim().isEmpty ? '未补全播放信息' : track.album,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: palette.mutedForeground,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderText extends StatelessWidget {
  const _HeaderText(this.label, this.palette);

  final String label;
  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: palette.mutedForeground,
      ),
    );
  }
}
