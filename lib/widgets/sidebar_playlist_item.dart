// Sidebar playlist item owns the right-click flyout so playlist row actions can
// stay out of the larger app shell file.

import 'dart:async';

import 'package:flutter/gestures.dart' show kSecondaryMouseButton;
import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/child_window_dialog.dart';
import 'package:cloudplayer_flutter/widgets/sidebar_color_icon.dart';
import 'package:fluent_ui/fluent_ui.dart';

class SidebarPlaylistItem extends StatefulWidget {
  const SidebarPlaylistItem({
    super.key,
    required this.palette,
    required this.controller,
    required this.playlist,
    required this.active,
  });

  final AppPalette palette;
  final AppController controller;
  final PlaylistRow playlist;
  final bool active;

  @override
  State<SidebarPlaylistItem> createState() => _SidebarPlaylistItemState();
}

class _SidebarPlaylistItemState extends State<SidebarPlaylistItem> {
  final FlyoutController _flyoutController = FlyoutController();
  bool _hovered = false;

  @override
  void dispose() {
    _flyoutController.dispose();
    super.dispose();
  }

  Future<void> _showMenu() async {
    if (_flyoutController.isOpen) {
      return;
    }
    await _flyoutController.showFlyout<void>(
      barrierColor: Colors.transparent,
      dismissOnPointerMoveAway: true,
      autoModeConfiguration: FlyoutAutoConfiguration(
        preferredMode: FlyoutPlacementMode.rightTop,
      ),
      builder: (menuContext) => FlyoutContent(
        useAcrylic: false,
        elevation: 10,
        padding: const EdgeInsets.all(6),
        constraints: const BoxConstraints(minWidth: 164, maxWidth: 164),
        color: widget.palette.cardBackground,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: widget.palette.borderColor),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            _SidebarPlaylistMenuButton(
              palette: widget.palette,
              icon: FluentIcons.open_file,
              label: '打开歌单',
              onPressed: () => _runMenuAction(
                menuContext,
                () => widget.controller.selectPlaylist(widget.playlist),
              ),
            ),
            _SidebarPlaylistMenuButton(
              palette: widget.palette,
              icon: FluentIcons.rename,
              label: '重命名歌单',
              onPressed: () => _runMenuAction(
                menuContext,
                () => _renamePlaylist(widget.controller, widget.playlist),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _runMenuAction(
    BuildContext menuContext,
    FutureOr<void> Function() action,
  ) async {
    Navigator.of(menuContext).pop();
    await Future<void>.delayed(Duration.zero);
    await action();
  }

  Future<void> _renamePlaylist(
    AppController controller,
    PlaylistRow playlist,
  ) async {
    final name = await showChildTextPromptDialog(
      context: context,
      palette: widget.palette,
      title: '重命名歌单',
      confirmText: '保存',
      placeholder: '歌单名称',
      initialValue: playlist.name,
      emptyErrorText: '歌单名称不能为空。',
    );
    if (name == null || !mounted) {
      return;
    }
    await controller.renamePlaylistRow(playlist, name);
  }

  @override
  Widget build(BuildContext context) {
    final playlist = widget.playlist;
    return FlyoutTarget(
      controller: _flyoutController,
      child: MouseRegion(
        onEnter: (_) => setState(() => _hovered = true),
        onExit: (_) => setState(() => _hovered = false),
        child: Listener(
          onPointerDown: (event) {
            if (event.buttons == kSecondaryMouseButton) {
              unawaited(_showMenu());
            }
          },
          child: SizedBox(
            width: double.infinity,
            child: Button(
              onPressed: () => widget.controller.selectPlaylist(playlist),
              style: _sidebarPlaylistItemStyle(
                widget.palette,
                active: widget.active,
                hovered: _hovered,
              ),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                alignment: Alignment.centerLeft,
                child: Row(
                  mainAxisSize: MainAxisSize.max,
                  children: <Widget>[
                    SidebarColorIcon(
                      icon: playlist.isFavorites
                          ? FluentIcons.heart_fill
                          : playlist.isCloud
                          ? FluentIcons.cloud
                          : FluentIcons.library,
                      tint: widget.palette.accent.normal,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        playlist.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.left,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: widget.active
                              ? FontWeight.w600
                              : FontWeight.w400,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SidebarPlaylistMenuButton extends StatelessWidget {
  const _SidebarPlaylistMenuButton({
    required this.palette,
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final AppPalette palette;
  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(
            const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          ),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.isHovered) {
              return palette.subtleBackground;
            }
            return Colors.transparent;
          }),
          foregroundColor: WidgetStatePropertyAll<Color>(
            palette.strongForeground,
          ),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        child: Row(
          children: <Widget>[
            Icon(icon, size: 14, color: palette.accent.normal),
            const SizedBox(width: 8),
            Expanded(child: Text(label, style: const TextStyle(fontSize: 12))),
          ],
        ),
      ),
    );
  }
}

ButtonStyle _sidebarPlaylistItemStyle(
  AppPalette palette, {
  required bool active,
  required bool hovered,
}) {
  return ButtonStyle(
    padding: WidgetStateProperty.all(EdgeInsets.zero),
    backgroundColor: WidgetStateProperty.resolveWith(
      (states) =>
          active || hovered || states.isHovered
              ? _playlistSidebarHoverBackground(palette)
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

Color _playlistSidebarHoverBackground(AppPalette palette) {
  return palette.brightness == Brightness.light
      ? const Color(0x0F000000)
      : const Color(0x14FFFFFF);
}
