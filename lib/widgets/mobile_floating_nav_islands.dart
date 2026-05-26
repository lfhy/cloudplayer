part of 'mobile_floating_nav.dart';

class _AdvancedIsland extends StatefulWidget {
  const _AdvancedIsland({required this.palette});

  final AppPalette palette;

  @override
  State<_AdvancedIsland> createState() => _AdvancedIslandState();
}

class _AdvancedIslandState extends State<_AdvancedIsland> {
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
    final active = switch (controller.currentPage) {
      AppPage.download || AppPage.import || AppPage.settings => true,
      _ => false,
    };
    return _GlassIsland(
      palette: widget.palette,
      radius: 22,
      width: MobileFloatingNav.searchIslandSize,
      height: MobileFloatingNav.searchIslandSize,
      child: FlyoutTarget(
        controller: _flyoutController,
        child: Button(
          onPressed: () => _showMenu(controller),
          style: ButtonStyle(
            padding: WidgetStateProperty.all(EdgeInsets.zero),
            backgroundColor: WidgetStateProperty.resolveWith(
              (state) => active || state.isHovered
                  ? widget.palette.accent.normal.withValues(alpha: 0.12)
                  : Colors.transparent,
            ),
            foregroundColor: WidgetStatePropertyAll<Color>(
              active
                  ? widget.palette.accent.normal
                  : widget.palette.strongForeground,
            ),
            shape: WidgetStateProperty.all(
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
            ),
          ),
          child: Icon(
            FluentIcons.settings,
            size: 18,
            color: active
                ? widget.palette.accent.normal
                : widget.palette.strongForeground,
          ),
        ),
      ),
    );
  }
}

class _SearchIsland extends StatelessWidget {
  const _SearchIsland({required this.palette});

  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final active = controller.currentPage == AppPage.search;
    return _GlassIsland(
      palette: palette,
      radius: 22,
      width: MobileFloatingNav.searchIslandSize,
      height: MobileFloatingNav.searchIslandSize,
      child: Button(
        onPressed: () => controller.setPage(AppPage.search),
        style: ButtonStyle(
          padding: WidgetStateProperty.all(EdgeInsets.zero),
          backgroundColor: WidgetStateProperty.resolveWith(
            (state) => active || state.isHovered
                ? palette.accent.normal.withValues(alpha: 0.12)
                : Colors.transparent,
          ),
          foregroundColor: WidgetStatePropertyAll<Color>(
            active ? palette.accent.normal : palette.strongForeground,
          ),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
          ),
        ),
        child: Icon(
          FluentIcons.search,
          size: 18,
          color: active ? palette.accent.normal : palette.strongForeground,
        ),
      ),
    );
  }
}

class _GlassIsland extends StatelessWidget {
  const _GlassIsland({
    required this.palette,
    required this.radius,
    required this.child,
    this.width,
    this.height,
  });

  final AppPalette palette;
  final double radius;
  final Widget child;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: _fillColor(palette),
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: _borderColor(palette)),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: Colors.black.withValues(
                  alpha: palette.brightness == Brightness.light ? 0.06 : 0.20,
                ),
                blurRadius: 28,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: SizedBox(width: width, height: height, child: child),
        ),
      ),
    );
  }
}

Color _fillColor(AppPalette palette) {
  return palette.brightness == Brightness.light
      ? const Color(0xF7FCFCFC)
      : const Color(0xEA14171B);
}

Color _borderColor(AppPalette palette) {
  return palette.brightness == Brightness.light
      ? const Color(0x14000000)
      : const Color(0x22FFFFFF);
}

Color _dividerColor(AppPalette palette) {
  return palette.brightness == Brightness.light
      ? const Color(0x12000000)
      : const Color(0x26FFFFFF);
}
