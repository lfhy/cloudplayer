// Mobile floating nav recreates the Apple Music-style island behavior where
// the expanded nav and player collapse into a single bottom capsule.

import 'dart:async';
import 'dart:ui' as ui;

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/playback_presence.dart';
import 'package:cloudplayer_flutter/widgets/player_dock_buttons.dart';
import 'package:cloudplayer_flutter/widgets/track_artwork.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

part 'mobile_floating_nav_sections.dart';

class MobileFloatingNav extends StatelessWidget {
  const MobileFloatingNav({
    super.key,
    required this.palette,
    required this.collapsed,
    required this.onExpand,
  });

  final AppPalette palette;
  final bool collapsed;
  final VoidCallback onExpand;

  static const double topPlayerHeight = 62;
  static const double mainNavHeight = 60;
  static const double searchIslandSize = 54;
  static const double stackGap = 10;
  static const double bottomOffset = 10;
  static const double expandedStackHeight =
      topPlayerHeight + stackGap + mainNavHeight;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 440),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          ClipRect(
            child: AnimatedAlign(
              duration: const Duration(milliseconds: 260),
              curve: Curves.easeOutCubic,
              alignment: Alignment.topCenter,
              heightFactor: collapsed ? 0 : 1,
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                opacity: collapsed ? 0 : 1,
                child: Padding(
                  padding: const EdgeInsets.only(
                    bottom: MobileFloatingNav.stackGap,
                  ),
                  child: _ExpandedPlayerPill(palette: palette),
                ),
              ),
            ),
          ),
          Row(
            children: <Widget>[
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 240),
                  switchInCurve: Curves.easeOutCubic,
                  switchOutCurve: Curves.easeInCubic,
                  transitionBuilder: _pillTransition,
                  child: collapsed
                      ? _CollapsedMainPill(
                          key: const ValueKey<String>('collapsed-pill'),
                          palette: palette,
                          onExpand: onExpand,
                        )
                      : _ExpandedMainPill(
                          key: const ValueKey<String>('expanded-pill'),
                          palette: palette,
                        ),
                ),
              ),
              const SizedBox(width: 10),
              _SearchIsland(palette: palette),
            ],
          ),
        ],
      ),
    );
  }

  Widget _pillTransition(Widget child, Animation<double> animation) {
    final offset = Tween<Offset>(
      begin: const Offset(0, 0.14),
      end: Offset.zero,
    ).animate(animation);
    return FadeTransition(
      opacity: animation,
      child: SlideTransition(position: offset, child: child),
    );
  }
}
