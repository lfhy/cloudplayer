// Advanced menu flyout centralizes the shared quick actions and theme toggles
// used by desktop sidebar and mobile bottom islands.

import 'dart:async';

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/account_center_dialog.dart';
import 'package:cloudplayer_flutter/widgets/sidebar_color_icon.dart';
import 'package:fluent_ui/fluent_ui.dart';

class AdvancedMenuFlyout extends StatelessWidget {
  const AdvancedMenuFlyout({
    super.key,
    required this.palette,
    required this.controller,
    required this.hostContext,
    required this.menuContext,
  });

  final AppPalette palette;
  final AppController controller;
  final BuildContext hostContext;
  final BuildContext menuContext;

  @override
  Widget build(BuildContext context) {
    return FlyoutContent(
      useAcrylic: false,
      elevation: 10,
      padding: const EdgeInsets.all(6),
      constraints: const BoxConstraints(minWidth: 188, maxWidth: 188),
      color: palette.cardBackground,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: palette.brightness == Brightness.light
              ? const Color(0x140F172A)
              : palette.borderColor,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _AdvancedMenuButton(
            palette: palette,
            icon: FluentIcons.contact,
            label: '登录账号',
            onPressed: () => _runMenuAction(() => _openAccountDialog()),
          ),
          _AdvancedMenuButton(
            palette: palette,
            icon: FluentIcons.download,
            label: '下载管理',
            selected: controller.currentPage == AppPage.download,
            onPressed: () =>
                _runMenuAction(() => controller.setPage(AppPage.download)),
          ),
          _AdvancedMenuButton(
            palette: palette,
            icon: FluentIcons.library,
            label: '导入歌单',
            selected: controller.currentPage == AppPage.import,
            onPressed: () =>
                _runMenuAction(() => controller.setPage(AppPage.import)),
          ),
          _AdvancedMenuButton(
            palette: palette,
            icon: FluentIcons.settings,
            label: '偏好设置',
            selected: controller.currentPage == AppPage.settings,
            onPressed: () =>
                _runMenuAction(() => controller.setPage(AppPage.settings)),
          ),
          Container(
            height: 1,
            margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            color: palette.borderColor,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 4),
            child: Text(
              '外观模式',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: palette.mutedForeground,
              ),
            ),
          ),
          _themeButton('浅色', 'light'),
          _themeButton('暗色', 'dark'),
        ],
      ),
    );
  }

  Widget _themeButton(String label, String mode) {
    final currentMode = controller.settings?.appThemeMode ?? 'dark';
    final selected = mode == 'dark'
        ? currentMode != 'light'
        : currentMode == mode;
    return _AdvancedMenuButton(
      palette: palette,
      icon: selected ? FluentIcons.check_mark : null,
      label: label,
      selected: selected,
      onPressed: controller.settings == null
          ? null
          : () => _runMenuAction(() {
              return controller.updateSettings(
                controller.settings!.copyWith(appThemeMode: mode),
              );
            }),
    );
  }

  Future<void> _runMenuAction(FutureOr<void> Function() action) async {
    Navigator.of(menuContext).pop();
    await Future<void>.delayed(Duration.zero);
    await action();
  }

  Future<void> _openAccountDialog() async {
    await Future<void>.delayed(Duration.zero);
    if (!hostContext.mounted) return;
    await showAccountCenterDialog(
      context: hostContext,
      palette: palette,
      controller: controller,
    );
  }
}

class _AdvancedMenuButton extends StatelessWidget {
  const _AdvancedMenuButton({
    required this.palette,
    required this.label,
    required this.onPressed,
    this.icon,
    this.selected = false,
  });

  final AppPalette palette;
  final IconData? icon;
  final String label;
  final VoidCallback? onPressed;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Button(
      onPressed: onPressed,
      style: ButtonStyle(
        padding: WidgetStateProperty.all(EdgeInsets.zero),
        backgroundColor: WidgetStateProperty.resolveWith(
          (state) => selected || state.isHovered
              ? palette.accent.normal.withValues(alpha: 0.08)
              : Colors.transparent,
        ),
        foregroundColor: WidgetStateProperty.resolveWith(
          (_) => selected ? palette.accent.normal : palette.strongForeground,
        ),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        alignment: Alignment.centerLeft,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            SizedBox(
              width: 22,
              height: 22,
              child: icon == null
                  ? null
                  : SidebarColorIcon(
                      icon: icon!,
                      size: 13,
                      boxSize: 22,
                      tint: palette.accent.normal,
                    ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                textAlign: TextAlign.left,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
