// Sidebar account menu restores the legacy bottom hover flyout that owns download, import, settings, and quick theme actions.

import 'dart:async';

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/account_center_dialog.dart';
import 'package:cloudplayer_flutter/widgets/cloudplayer_logo_mark.dart';
import 'package:cloudplayer_flutter/widgets/sidebar_color_icon.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

class SidebarAccountMenu extends StatefulWidget {
  const SidebarAccountMenu({super.key, required this.palette});

  final AppPalette palette;

  @override
  State<SidebarAccountMenu> createState() => _SidebarAccountMenuState();
}

class _SidebarAccountMenuState extends State<SidebarAccountMenu> {
  final FlyoutController _flyoutController = FlyoutController();

  @override
  void dispose() {
    _flyoutController.dispose();
    super.dispose();
  }

  Future<void> _showMenu(AppController controller) async {
    if (_flyoutController.isOpen) return;
    await _flyoutController.showFlyout<void>(
      barrierColor: Colors.transparent,
      dismissOnPointerMoveAway: true,
      autoModeConfiguration: FlyoutAutoConfiguration(
        preferredMode: FlyoutPlacementMode.topCenter,
      ),
      builder: (menuContext) => FlyoutContent(
        useAcrylic: false,
        elevation: 10,
        padding: const EdgeInsets.all(6),
        constraints: const BoxConstraints(minWidth: 188, maxWidth: 188),
        color: widget.palette.cardBackground,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: widget.palette.brightness == Brightness.light
                ? const Color(0x140F172A)
                : widget.palette.borderColor,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            _SidebarMenuButton(
              palette: widget.palette,
              icon: FluentIcons.contact,
              label: '登录账号',
              onPressed: () => _runMenuAction(
                menuContext,
                () => _openAccountDialog(controller),
              ),
            ),
            _SidebarMenuButton(
              palette: widget.palette,
              icon: FluentIcons.download,
              label: '下载管理',
              onPressed: () => _runMenuAction(
                menuContext,
                () => controller.setPage(AppPage.download),
              ),
            ),
            _SidebarMenuButton(
              palette: widget.palette,
              icon: FluentIcons.library,
              label: '导入歌单',
              onPressed: () => _runMenuAction(
                menuContext,
                () => controller.setPage(AppPage.import),
              ),
            ),
            _SidebarMenuButton(
              palette: widget.palette,
              icon: FluentIcons.settings,
              label: '偏好设置',
              onPressed: () => _runMenuAction(
                menuContext,
                () => controller.setPage(AppPage.settings),
              ),
            ),
            Container(
              height: 1,
              margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              color: widget.palette.borderColor,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 4),
              child: Text(
                '外观模式',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: widget.palette.mutedForeground,
                ),
              ),
            ),
            _themeButton(menuContext, controller, '浅色', 'light'),
            _themeButton(menuContext, controller, '暗色', 'dark'),
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

  Future<void> _openAccountDialog(AppController controller) async {
    await Future<void>.delayed(Duration.zero);
    if (!mounted) return;
    await showAccountCenterDialog(
      context: context,
      palette: widget.palette,
      controller: controller,
    );
  }

  Widget _themeButton(
    BuildContext menuContext,
    AppController controller,
    String label,
    String mode,
  ) {
    final currentMode = controller.settings?.appThemeMode ?? 'dark';
    final selected = mode == 'dark'
        ? currentMode != 'light'
        : currentMode == mode;
    return _SidebarMenuButton(
      palette: widget.palette,
      icon: selected ? FluentIcons.check_mark : null,
      label: label,
      selected: selected,
      onPressed: controller.settings == null
          ? null
          : () => _runMenuAction(menuContext, () {
              return controller.updateSettings(
                controller.settings!.copyWith(appThemeMode: mode),
              );
            }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 8, 6, 2),
      child: FlyoutTarget(
        controller: _flyoutController,
        child: MouseRegion(
          onEnter: (_) => unawaited(_showMenu(controller)),
          child: Button(
            onPressed: () => _showMenu(controller),
            style: ButtonStyle(
              padding: WidgetStateProperty.all(EdgeInsets.zero),
              backgroundColor: WidgetStateProperty.resolveWith(
                (state) => state.isHovered
                    ? _sidebarHoverBackground(widget.palette)
                    : widget.palette.cardBackground,
              ),
              foregroundColor: WidgetStatePropertyAll<Color>(
                widget.palette.strongForeground,
              ),
              shape: WidgetStateProperty.all(
                RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: BorderSide(
                    color: widget.palette.brightness == Brightness.light
                        ? const Color(0x140F172A)
                        : widget.palette.borderColor,
                  ),
                ),
              ),
              shadowColor: WidgetStatePropertyAll<Color>(
                Colors.black.withValues(
                  alpha: widget.palette.brightness == Brightness.light
                      ? 0.08
                      : 0.2,
                ),
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
                    width: 30,
                    height: 30,
                    child: Center(
                      child: CloudPlayerLogoMark(
                        color: widget.palette.accent.normal,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'CloudPlayer',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Icon(
                    FluentIcons.chevron_up_med,
                    size: 12,
                    color: widget.palette.mutedForeground,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SidebarMenuButton extends StatelessWidget {
  const _SidebarMenuButton({
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

Color _sidebarHoverBackground(AppPalette palette) {
  return palette.brightness == Brightness.light
      ? const Color(0x0F000000)
      : const Color(0x14FFFFFF);
}
