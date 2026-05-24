// The app shell owns sidebar navigation, top-level page switching, and the shared player dock.

import 'package:flutter/foundation.dart';
import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/pages/daily_page.dart';
import 'package:cloudplayer_flutter/pages/download_page.dart';
import 'package:cloudplayer_flutter/pages/home_page.dart';
import 'package:cloudplayer_flutter/pages/import_page.dart';
import 'package:cloudplayer_flutter/pages/playlist_page.dart';
import 'package:cloudplayer_flutter/pages/recent_page.dart';
import 'package:cloudplayer_flutter/pages/search_page.dart';
import 'package:cloudplayer_flutter/pages/settings_page.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/immersive_player.dart';
import 'package:cloudplayer_flutter/widgets/mini_player.dart';
import 'package:cloudplayer_flutter/widgets/app_status_toast.dart';
import 'package:cloudplayer_flutter/widgets/child_window_dialog.dart';
import 'package:cloudplayer_flutter/widgets/player_dock.dart';
import 'package:cloudplayer_flutter/widgets/sidebar_color_icon.dart';
import 'package:cloudplayer_flutter/widgets/sidebar_account_menu.dart';
import 'package:cloudplayer_flutter/widgets/sidebar_playlist_item.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.palette});

  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    if (controller.booting) {
      return const NavigationView(content: Center(child: ProgressRing()));
    }
    if (controller.bootError.isNotEmpty) {
      return NavigationView(content: Center(child: Text(controller.bootError)));
    }
    return NavigationView(
      content: Container(
        color: palette.windowBackground,
        child: Stack(
          children: <Widget>[
            if (!controller.miniModeOpen)
              Row(
                children: <Widget>[
                  SizedBox(width: 216, child: _Sidebar(palette: palette)),
                  Expanded(
                    child: Column(
                      children: <Widget>[
                        Expanded(
                          child: Container(
                            color: palette.windowBackground,
                            padding: const EdgeInsets.fromLTRB(24, 24, 24, 18),
                            child: Stack(
                              children: <Widget>[
                                Positioned.fill(
                                  child: _pageFor(controller.currentPage),
                                ),
                                AppStatusToast(
                                  palette: palette,
                                  message: controller.statusMessage,
                                  onDismiss: controller.clearStatus,
                                ),
                              ],
                            ),
                          ),
                        ),
                        PlayerDock(palette: palette),
                      ],
                    ),
                  ),
                ],
              ),
            Positioned.fill(
              child: IgnorePointer(
                ignoring: !controller.miniModeOpen,
                child: MiniPlayer(palette: palette),
              ),
            ),
            Positioned.fill(child: ImmersivePlayer(palette: palette)),
          ],
        ),
      ),
    );
  }

  Widget _pageFor(AppPage page) {
    return switch (page) {
      AppPage.search => SearchPage(palette: palette),
      AppPage.daily => DailyPage(palette: palette),
      AppPage.recent => RecentPage(palette: palette),
      AppPage.playlist => PlaylistPage(palette: palette),
      AppPage.download => DownloadPage(palette: palette),
      AppPage.import => ImportPage(palette: palette),
      AppPage.settings => SettingsPage(palette: palette),
      _ => HomePage(palette: palette),
    };
  }
}

class _Sidebar extends StatelessWidget {
  const _Sidebar({required this.palette});

  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final topGradient = palette.brightness == Brightness.light
        ? const LinearGradient(
            colors: <Color>[
              Color(0xFFE8EAEE),
              Color(0xFFEFF0F3),
              Color(0xFFF7F7F7),
            ],
            stops: <double>[0, 0.2, 0.52],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          )
        : null;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.windowBackground,
        border: Border(right: BorderSide(color: palette.borderColor)),
        gradient: topGradient,
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(8, _sidebarTopGap(), 8, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const _NavButton(
              page: AppPage.home,
              label: '音乐首页',
              icon: FluentIcons.home,
            ),
            const _NavButton(
              page: AppPage.search,
              label: '音乐搜索',
              icon: FluentIcons.search,
            ),
            const _NavButton(
              page: AppPage.daily,
              label: '每日推荐',
              icon: FluentIcons.favorite_star_fill,
            ),
            const _NavButton(
              page: AppPage.recent,
              label: '最近播放',
              icon: FluentIcons.history,
            ),
            const SizedBox(height: 8),
            const Divider(size: 1),
            const SizedBox(height: 8),
            Row(
              children: <Widget>[
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text(
                      '我的歌单',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                        color: palette.mutedForeground,
                      ),
                    ),
                  ),
                ),
                SizedBox(
                  width: 28,
                  height: 28,
                  child: Button(
                    onPressed: controller.refreshPlaylists,
                    style: _sidebarUtilityButtonStyle(palette),
                    child: SidebarColorIcon(
                      icon: FluentIcons.refresh,
                      size: 14,
                      boxSize: 20,
                      tint: palette.accent.normal,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                SizedBox(
                  width: 28,
                  height: 28,
                  child: Button(
                    onPressed: () =>
                        _showCreatePlaylistDialog(context, controller),
                    style: _sidebarUtilityButtonStyle(palette),
                    child: SidebarColorIcon(
                      icon: FluentIcons.add,
                      size: 14,
                      boxSize: 20,
                      tint: palette.accent.normal,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Expanded(
              child: ListView.separated(
                itemCount: controller.playlists.length,
                separatorBuilder: (_, index) => const SizedBox(height: 2),
                itemBuilder: (context, index) {
                  final playlist = controller.playlists[index];
                  final active =
                      controller.selectedPlaylist?.id == playlist.id &&
                      controller.currentPage == AppPage.playlist;
                  return SidebarPlaylistItem(
                    key: ValueKey<int>(playlist.id),
                    palette: palette,
                    controller: controller,
                    playlist: playlist,
                    active: active,
                  );
                },
              ),
            ),
            if (controller.playlists.isEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 6, 8, 12),
                child: Text(
                  '暂无歌单 · 与 Py 版共用 ~/.cloudplayer/library.db · 在此页「保存为新歌单」即可出现',
                  style: TextStyle(
                    fontSize: 11,
                    color: palette.mutedForeground,
                    height: 1.4,
                  ),
                ),
              ),
            SidebarAccountMenu(palette: palette),
          ],
        ),
      ),
    );
  }

  Future<void> _showCreatePlaylistDialog(
    BuildContext context,
    AppController controller,
  ) async {
    final name = await showChildTextPromptDialog(
      context: context,
      palette: palette,
      title: '新建歌单',
      confirmText: '创建',
      placeholder: '歌单名称',
      initialValue: '新歌单',
      emptyErrorText: '歌单名称不能为空。',
    );
    if (name == null || !context.mounted) return;
    final playlistId = await controller.api.createPlaylist(name);
    await controller.refreshPlaylists();
    final created = controller.playlists
        .where((item) => item.id == playlistId)
        .firstOrNull;
    if (created != null && context.mounted) {
      await controller.selectPlaylist(created);
    }
  }

  double _sidebarTopGap() {
    // Legacy Wails kept the macOS sidebar inset stable across light/dark modes.
    return defaultTargetPlatform == TargetPlatform.macOS ? 46 : 12;
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.page,
    required this.label,
    required this.icon,
  });

  final AppPage page;
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final active = controller.currentPage == page;
    final palette = paletteForSettings(controller.settings);
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: SizedBox(
        width: double.infinity,
        child: Button(
          onPressed: () => controller.setPage(page),
          style: _sidebarItemStyle(palette, active: active),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            alignment: Alignment.centerLeft,
            child: Row(
              mainAxisSize: MainAxisSize.max,
              children: <Widget>[
                SidebarColorIcon(icon: icon, tint: palette.accent.normal),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    textAlign: TextAlign.left,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

ButtonStyle _sidebarItemStyle(AppPalette palette, {required bool active}) {
  return ButtonStyle(
    padding: WidgetStateProperty.all(EdgeInsets.zero),
    backgroundColor: WidgetStateProperty.resolveWith(
      (state) => active || state.isHovered
          ? _sidebarHoverBackground(palette)
          : Colors.transparent,
    ),
    foregroundColor: WidgetStateProperty.resolveWith(
      (_) => active ? palette.accent.normal : palette.strongForeground,
    ),
    shape: WidgetStateProperty.all(
      RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ),
  );
}

ButtonStyle _sidebarUtilityButtonStyle(AppPalette palette) {
  return ButtonStyle(
    padding: WidgetStateProperty.all(EdgeInsets.zero),
    backgroundColor: WidgetStateProperty.resolveWith(
      (state) => state.isHovered
          ? _sidebarHoverBackground(palette)
          : palette.cardBackground,
    ),
    foregroundColor: WidgetStateProperty.resolveWith(
      (state) =>
          state.isHovered ? palette.accent.normal : palette.strongForeground,
    ),
    shape: WidgetStateProperty.all(
      RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: palette.borderColor),
      ),
    ),
  );
}

Color _sidebarHoverBackground(AppPalette palette) {
  return palette.brightness == Brightness.light
      ? const Color(0x0F000000)
      : const Color(0x14FFFFFF);
}

extension on Iterable<PlaylistRow> {
  PlaylistRow? get firstOrNull => isEmpty ? null : first;
}
