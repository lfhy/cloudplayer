part of 'mobile_floating_nav.dart';

class _ExpandedPlayerPill extends StatelessWidget {
  const _ExpandedPlayerPill({required this.palette});

  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final track = controller.currentTrack;
    return _GlassIsland(
      palette: palette,
      radius: 24,
      height: MobileFloatingNav.topPlayerHeight,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        child: Row(
          children: <Widget>[
            SizedBox(
              width: 42,
              height: 42,
              child: Button(
                onPressed: controller.currentTrack == null
                    ? null
                    : () => unawaited(controller.openImmersive()),
                style: ButtonStyle(
                  padding: WidgetStateProperty.all(EdgeInsets.zero),
                  backgroundColor: const WidgetStatePropertyAll<Color>(
                    Colors.transparent,
                  ),
                  shape: WidgetStateProperty.all(
                    RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(11),
                    ),
                  ),
                ),
                child: TrackArtwork(
                  track: track,
                  palette: palette,
                  size: 42,
                  radius: 11,
                  iconSize: 20,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: PlaybackPresence(
                playing: controller.isPlaying,
                pausedOpacity: 0.82,
                pausedScale: 0.992,
                pausedOffset: const Offset(0, 0.012),
                child: Text(
                  track?.title ?? '未播放',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            DockTransportButton(
              palette: palette,
              tooltip: '上一首',
              onPressed: controller.canNavigateQueue
                  ? () => unawaited(controller.playPrevious())
                  : null,
              child: const Icon(FluentIcons.previous, size: 15),
            ),
            const SizedBox(width: 6),
            DockTransportButton(
              palette: palette,
              main: true,
              tooltip: controller.isPlaying ? '暂停' : '播放',
              onPressed: controller.currentTrack == null
                  ? null
                  : () => unawaited(controller.togglePlayPause()),
              child: Icon(
                controller.isPlaying ? FluentIcons.pause : FluentIcons.play,
                size: 16,
              ),
            ),
            const SizedBox(width: 6),
            DockTransportButton(
              palette: palette,
              tooltip: '下一首',
              onPressed: controller.canNavigateQueue
                  ? () => unawaited(controller.playNext())
                  : null,
              child: const Icon(FluentIcons.next, size: 15),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExpandedMainPill extends StatelessWidget {
  const _ExpandedMainPill({
    super.key,
    required this.palette,
  });

  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final currentPage = controller.currentPage;
    return _GlassIsland(
      palette: palette,
      radius: 28,
      height: MobileFloatingNav.mainNavHeight,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          children: <Widget>[
            if (!_isPrimaryPage(currentPage) && currentPage != AppPage.search)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: _AuxiliaryPageChip(
                  palette: palette,
                  page: currentPage,
                ),
              ),
            Expanded(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: <Widget>[
                  for (final item in _primaryNavItems)
                    _ExpandedNavItem(
                      palette: palette,
                      page: item.page,
                      label: item.label,
                      icon: item.icon,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CollapsedMainPill extends StatelessWidget {
  const _CollapsedMainPill({
    super.key,
    required this.palette,
    required this.onExpand,
  });

  final AppPalette palette;
  final VoidCallback onExpand;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final pageMeta = _pageMeta(controller.currentPage);
    final trackTitle = controller.currentTrack?.title ?? '未播放';
    return _GlassIsland(
      palette: palette,
      radius: 28,
      height: MobileFloatingNav.mainNavHeight,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
        child: Row(
          children: <Widget>[
            Button(
              onPressed: onExpand,
              style: ButtonStyle(
                padding: WidgetStateProperty.all(EdgeInsets.zero),
                backgroundColor: WidgetStateProperty.resolveWith(
                  (state) => state.isHovered
                      ? palette.accent.normal.withValues(alpha: 0.12)
                      : Colors.transparent,
                ),
                shape: WidgetStateProperty.all(
                  RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                ),
              ),
              child: SizedBox(
                width: 40,
                height: 40,
                child: Icon(
                  pageMeta.icon,
                  size: 18,
                  color: palette.accent.normal,
                ),
              ),
            ),
            Container(
              width: 1,
              height: 28,
              margin: const EdgeInsets.symmetric(horizontal: 10),
              color: _dividerColor(palette),
            ),
            Expanded(
              child: PlaybackPresence(
                playing: controller.isPlaying,
                pausedOpacity: 0.84,
                pausedScale: 0.994,
                pausedOffset: const Offset(0, 0.01),
                child: Text(
                  trackTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: palette.strongForeground,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            DockTransportButton(
              palette: palette,
              main: true,
              tooltip: controller.isPlaying ? '暂停' : '播放',
              onPressed: controller.currentTrack == null
                  ? null
                  : () => unawaited(controller.togglePlayPause()),
              child: Icon(
                controller.isPlaying ? FluentIcons.pause : FluentIcons.play,
                size: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExpandedNavItem extends StatelessWidget {
  const _ExpandedNavItem({
    required this.palette,
    required this.page,
    required this.label,
    required this.icon,
  });

  final AppPalette palette;
  final AppPage page;
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final active = controller.currentPage == page;
    return Button(
      onPressed: () => controller.setPage(page),
      style: ButtonStyle(
        padding: WidgetStateProperty.all(EdgeInsets.zero),
        backgroundColor: const WidgetStatePropertyAll<Color>(Colors.transparent),
        foregroundColor: WidgetStatePropertyAll<Color>(
          active ? palette.accent.normal : palette.mutedForeground,
        ),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      child: SizedBox(
        width: 62,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: 16),
            const SizedBox(height: 5),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.fade,
              softWrap: false,
              style: TextStyle(
                fontSize: 10,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: active ? palette.accent.normal : palette.mutedForeground,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AuxiliaryPageChip extends StatelessWidget {
  const _AuxiliaryPageChip({
    required this.palette,
    required this.page,
  });

  final AppPalette palette;
  final AppPage page;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final meta = _pageMeta(page);
    return Button(
      onPressed: () => controller.setPage(page),
      style: ButtonStyle(
        padding: WidgetStateProperty.all(
          const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        ),
        backgroundColor: WidgetStatePropertyAll<Color>(
          palette.accent.normal.withValues(alpha: 0.10),
        ),
        foregroundColor: WidgetStatePropertyAll<Color>(palette.accent.normal),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(meta.icon, size: 14),
          const SizedBox(width: 6),
          Text(
            meta.label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
          ),
        ],
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

const List<_PrimaryNavItem> _primaryNavItems = <_PrimaryNavItem>[
  _PrimaryNavItem(AppPage.home, '音乐主页', FluentIcons.home),
  _PrimaryNavItem(AppPage.daily, '每日推荐', FluentIcons.favorite_star_fill),
  _PrimaryNavItem(AppPage.recent, '最近播放', FluentIcons.history),
  _PrimaryNavItem(AppPage.playlist, '我的歌单', FluentIcons.library),
];

class _PrimaryNavItem {
  const _PrimaryNavItem(this.page, this.label, this.icon);

  final AppPage page;
  final String label;
  final IconData icon;
}

({String label, IconData icon}) _pageMeta(AppPage page) {
  return switch (page) {
    AppPage.home => (label: '音乐主页', icon: FluentIcons.home),
    AppPage.search => (label: '音乐搜索', icon: FluentIcons.search),
    AppPage.daily => (label: '每日推荐', icon: FluentIcons.favorite_star_fill),
    AppPage.recent => (label: '最近播放', icon: FluentIcons.history),
    AppPage.playlist => (label: '我的歌单', icon: FluentIcons.library),
    AppPage.download => (label: '下载队列', icon: FluentIcons.download),
    AppPage.import => (label: '导入', icon: FluentIcons.upload),
    AppPage.settings => (label: '设置', icon: FluentIcons.settings),
  };
}

bool _isPrimaryPage(AppPage page) {
  return _primaryNavItems.any((item) => item.page == page);
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
