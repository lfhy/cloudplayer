// Kugou import subwidgets keep the login switches and playlist list markup separate from API state handling.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';

class KugouModeButton extends StatelessWidget {
  const KugouModeButton({
    super.key,
    required this.label,
    required this.active,
    required this.onPressed,
  });

  final String label;
  final bool active;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Button(
      onPressed: onPressed,
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith(
          (_) => active ? FluentTheme.of(context).accentColor.lightest : null,
        ),
      ),
      child: Text(label),
    );
  }
}

class KugouPlaylistSection extends StatelessWidget {
  const KugouPlaylistSection({
    super.key,
    required this.palette,
    required this.loggedIn,
    required this.busy,
    required this.playlists,
    required this.selectedIds,
    required this.onRefresh,
    required this.onSelectAll,
    required this.onClear,
    required this.onToggleSelection,
    required this.onImport,
  });

  final AppPalette palette;
  final bool loggedIn;
  final bool busy;
  final List<KugouPlaylistRow> playlists;
  final Set<int> selectedIds;
  final VoidCallback onRefresh;
  final VoidCallback onSelectAll;
  final VoidCallback onClear;
  final ValueChanged<int> onToggleSelection;
  final VoidCallback onImport;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            const Expanded(
              child: Text(
                '选择要导入的歌单',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
            Button(
              onPressed: loggedIn && !busy ? onRefresh : null,
              child: const Text('刷新歌单'),
            ),
            const SizedBox(width: 8),
            Button(
              onPressed: loggedIn && playlists.isNotEmpty ? onSelectAll : null,
              child: const Text('全选'),
            ),
            const SizedBox(width: 8),
            Button(
              onPressed: selectedIds.isEmpty ? null : onClear,
              child: const Text('清空'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: palette.panelBackground,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: palette.borderColor),
          ),
          child: playlists.isEmpty
              ? Text(
                  loggedIn ? '还没有选择歌单。' : '登录后可拉取酷狗歌单。',
                  style: TextStyle(color: palette.mutedForeground),
                )
              : Column(
                  children: playlists
                      .map(
                        (playlist) => KugouPlaylistTile(
                          palette: palette,
                          playlist: playlist,
                          selected: selectedIds.contains(playlist.id),
                          onToggle: () => onToggleSelection(playlist.id),
                        ),
                      )
                      .toList(),
                ),
        ),
        const SizedBox(height: 12),
        Row(
          children: <Widget>[
            Expanded(
              child: Text(
                selectedIds.isEmpty
                    ? '还没有选择歌单。'
                    : '已选择 ${selectedIds.length} 个歌单。',
                style: TextStyle(color: palette.mutedForeground),
              ),
            ),
            FilledButton(
              onPressed: selectedIds.isEmpty || busy ? null : onImport,
              child: const Text('导入选中歌单'),
            ),
          ],
        ),
      ],
    );
  }
}

class KugouPlaylistTile extends StatelessWidget {
  const KugouPlaylistTile({
    super.key,
    required this.palette,
    required this.playlist,
    required this.selected,
    required this.onToggle,
  });

  final AppPalette palette;
  final KugouPlaylistRow playlist;
  final bool selected;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Checkbox(
        checked: selected,
        content: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: <Widget>[
              Icon(
                playlist.isFavorites ? FluentIcons.heart_fill : FluentIcons.music_note,
                size: 18,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  playlist.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                '${playlist.trackCount} 首歌曲',
                style: TextStyle(color: palette.mutedForeground),
              ),
            ],
          ),
        ),
        onChanged: (_) => onToggle(),
      ),
    );
  }
}
