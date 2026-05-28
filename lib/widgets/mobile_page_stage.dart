// Mobile page stage hosts the mobile-only floating islands and listens for
// vertical scroll direction to collapse or expand them.

import 'package:flutter/rendering.dart';
import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/app_status_toast.dart';
import 'package:cloudplayer_flutter/widgets/mobile_floating_nav.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

class MobilePageStage extends StatefulWidget {
  const MobilePageStage({
    super.key,
    required this.palette,
    required this.pageKey,
    required this.page,
  });

  final AppPalette palette;
  final AppPage pageKey;
  final Widget page;

  @override
  State<MobilePageStage> createState() => _MobilePageStageState();
}

class _MobilePageStageState extends State<MobilePageStage> {
  bool _dockCollapsed = false;
  static const double _contentBottomSpacing =
      MobileFloatingNav.bottomOffset + MobileFloatingNav.mainNavHeight + 18;
  static const double _collapseDeltaThreshold = 18;
  static const double _autoExpandTopThreshold = 2;

  double _downwardDelta = 0;
  late int _pageOrder = _pageRank(widget.pageKey);
  bool _slideForward = true;

  @override
  void didUpdateWidget(covariant MobilePageStage oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextOrder = _pageRank(widget.pageKey);
    if (nextOrder != _pageOrder) {
      _slideForward = nextOrder >= _pageOrder;
      _pageOrder = nextOrder;
    }
  }

  bool _handleScroll(ScrollNotification notification) {
    if (notification.metrics.axis != Axis.vertical) {
      return false;
    }
    if (notification.metrics.extentBefore <= 4 &&
        notification.metrics.extentAfter <= 4) {
      return false;
    }
    if (notification is UserScrollNotification) {
      if (notification.direction == ScrollDirection.idle) {
        _resetScrollAccumulation();
      }
    } else if (notification is ScrollUpdateNotification) {
      final delta = notification.scrollDelta ?? 0;
      if (delta > 0) {
        _downwardDelta += delta;
        if (!_dockCollapsed &&
            notification.metrics.pixels > _autoExpandTopThreshold &&
            _downwardDelta >= _collapseDeltaThreshold) {
          _setDockCollapsed(true);
          _resetScrollAccumulation();
        }
      } else if (delta < 0) {
        _downwardDelta = 0;
        if (_dockCollapsed &&
            notification.metrics.pixels <= _autoExpandTopThreshold) {
          _setDockCollapsed(false);
          _resetScrollAccumulation();
        }
      }
    } else if (notification is ScrollEndNotification) {
      _resetScrollAccumulation();
    }
    return false;
  }

  void _setDockCollapsed(bool collapsed) {
    if (_dockCollapsed == collapsed) {
      return;
    }
    setState(() {
      _dockCollapsed = collapsed;
    });
  }

  void _resetScrollAccumulation() {
    _downwardDelta = 0;
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final topInset = MediaQuery.paddingOf(context).top;
    return NotificationListener<ScrollNotification>(
      onNotification: _handleScroll,
      child: Container(
        color: widget.palette.windowBackground,
        padding: EdgeInsets.fromLTRB(16, topInset + 10, 16, 18),
        child: Stack(
          clipBehavior: Clip.none,
          children: <Widget>[
            Positioned.fill(
              child: Padding(
                padding: const EdgeInsets.only(bottom: _contentBottomSpacing),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 240),
                  switchInCurve: Curves.easeOutCubic,
                  switchOutCurve: Curves.easeInCubic,
                  layoutBuilder: (currentChild, previousChildren) {
                    return Stack(
                      children: <Widget>[
                        ...previousChildren,
                        if (currentChild != null) ...<Widget>[currentChild],
                      ],
                    );
                  },
                  transitionBuilder: (child, animation) {
                    final offsetAnimation = Tween<Offset>(
                      begin: Offset(_slideForward ? 0.08 : -0.08, 0),
                      end: Offset.zero,
                    ).animate(animation);
                    return FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: offsetAnimation,
                        child: child,
                      ),
                    );
                  },
                  child: KeyedSubtree(
                    key: ValueKey<AppPage>(widget.pageKey),
                    child: widget.page,
                  ),
                ),
              ),
            ),
            AppStatusToast(
              palette: widget.palette,
              message: controller.statusMessage,
              onDismiss: controller.clearStatus,
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: MobileFloatingNav.bottomOffset,
              child: SafeArea(
                top: false,
                minimum: const EdgeInsets.symmetric(horizontal: 8),
                child: MobileFloatingNav(
                  palette: widget.palette,
                  collapsed: _dockCollapsed,
                  onExpand: () => _setDockCollapsed(false),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  int _pageRank(AppPage page) {
    return switch (page) {
      AppPage.home => 0,
      AppPage.search => 1,
      AppPage.daily => 2,
      AppPage.recent => 3,
      AppPage.playlist => 4,
      AppPage.download => 5,
      AppPage.import => 6,
      AppPage.settings => 7,
    };
  }
}
