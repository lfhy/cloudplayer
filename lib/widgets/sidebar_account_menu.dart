// Sidebar account menu restores the legacy bottom hover flyout that owns download, import, settings, and quick theme actions.

import 'dart:async';

import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/advanced_menu_flyout.dart';
import 'package:cloudplayer_flutter/widgets/cloudplayer_logo_mark.dart';
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
      builder: (menuContext) => AdvancedMenuFlyout(
        palette: widget.palette,
        controller: controller,
        hostContext: context,
        menuContext: menuContext,
      ),
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

Color _sidebarHoverBackground(AppPalette palette) {
  return palette.brightness == Brightness.light
      ? const Color(0x0F000000)
      : const Color(0x14FFFFFF);
}
