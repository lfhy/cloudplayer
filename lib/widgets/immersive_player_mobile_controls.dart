// Mobile immersive controls keep playback mode and system-volume actions in a
// compact bottom row without competing with the seek bar.

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/immersive_player_chrome.dart';
import 'package:cloudplayer_flutter/widgets/player_dock_utils.dart';
import 'package:fluent_ui/fluent_ui.dart';

class ImmersiveMobileControls extends StatefulWidget {
  const ImmersiveMobileControls({
    super.key,
    required this.palette,
    required this.dense,
    required this.playMode,
    required this.volume,
    required this.onPlayModePressed,
    required this.onPrevious,
    required this.onPlayPause,
    required this.onNext,
    required this.onVolumeChanged,
    required this.onToggleMute,
    required this.isPlaying,
  });

  final AppPalette palette;
  final bool dense;
  final String playMode;
  final double volume;
  final Future<void> Function()? onPlayModePressed;
  final Future<void> Function()? onPrevious;
  final Future<void> Function()? onPlayPause;
  final Future<void> Function()? onNext;
  final ValueChanged<double>? onVolumeChanged;
  final Future<void> Function()? onToggleMute;
  final bool isPlaying;

  @override
  State<ImmersiveMobileControls> createState() =>
      _ImmersiveMobileControlsState();
}

class _ImmersiveMobileControlsState extends State<ImmersiveMobileControls> {
  bool _volumeOpen = false;
  final LayerLink _volumeLink = LayerLink();
  final OverlayPortalController _volumePortalController =
      OverlayPortalController(debugLabel: 'immersive-volume');

  @override
  void dispose() {
    super.dispose();
  }

  void _toggleVolumeFlyout() {
    setState(() {
      _volumeOpen = !_volumeOpen;
    });
    if (_volumeOpen) {
      _volumePortalController.show();
    } else {
      _volumePortalController.hide();
    }
  }

  @override
  Widget build(BuildContext context) {
    final sideButtonSize = widget.dense ? 36.0 : 40.0;
    return Row(
      children: <Widget>[
        SizedBox(
          width: sideButtonSize,
          height: sideButtonSize,
          child: ImmersiveModeButtonChrome(
            icon: dockPlayModeIcon(widget.playMode),
            tooltip: dockPlayModeTip(widget.playMode),
            onPressed: widget.onPlayModePressed == null
                ? null
                : () => widget.onPlayModePressed!.call(),
          ),
        ),
        Expanded(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              ImmersiveTransportButtonChrome(
                icon: FluentIcons.previous,
                onPressed: widget.onPrevious == null
                    ? null
                    : () => widget.onPrevious!.call(),
              ),
              SizedBox(width: widget.dense ? 18 : 24),
              ImmersiveTransportButtonChrome(
                icon: widget.isPlaying ? FluentIcons.pause : FluentIcons.play,
                onPressed: widget.onPlayPause == null
                    ? null
                    : () => widget.onPlayPause!.call(),
                main: true,
              ),
              SizedBox(width: widget.dense ? 18 : 24),
              ImmersiveTransportButtonChrome(
                icon: FluentIcons.next,
                onPressed: widget.onNext == null
                    ? null
                    : () => widget.onNext!.call(),
              ),
            ],
          ),
        ),
        SizedBox(
          width: sideButtonSize,
          height: sideButtonSize,
          child: OverlayPortal(
            controller: _volumePortalController,
            overlayChildBuilder: (context) => _volumeOpen
                ? Stack(
                    children: <Widget>[
                      Positioned.fill(
                        child: GestureDetector(
                          behavior: HitTestBehavior.translucent,
                          onTap: _toggleVolumeFlyout,
                        ),
                      ),
                      CompositedTransformFollower(
                        link: _volumeLink,
                        showWhenUnlinked: false,
                        targetAnchor: Alignment.topCenter,
                        followerAnchor: Alignment.bottomCenter,
                        offset: const Offset(0, -32),
                        child: _ImmersiveVolumeFlyout(
                          volume: widget.volume,
                          dense: widget.dense,
                          onChanged: widget.onVolumeChanged,
                        ),
                      ),
                    ],
                  )
                : const SizedBox.shrink(),
            child: CompositedTransformTarget(
              link: _volumeLink,
              child: ImmersiveModeButtonChrome(
                icon: _volumeIcon(widget.volume),
                tooltip: '音量',
                onPressed: widget.onVolumeChanged == null
                    ? null
                    : _toggleVolumeFlyout,
              ),
            ),
          ),
        ),
      ],
    );
  }

  IconData _volumeIcon(double value) {
    if (value <= 0.001) return FluentIcons.volume0;
    if (value < 0.45) return FluentIcons.volume1;
    return FluentIcons.volume3;
  }
}

class _ImmersiveVolumeFlyout extends StatelessWidget {
  const _ImmersiveVolumeFlyout({
    required this.volume,
    required this.dense,
    required this.onChanged,
  });

  final double volume;
  final bool dense;
  final ValueChanged<double>? onChanged;

  @override
  Widget build(BuildContext context) {
    final railHeight = dense ? 108.0 : 124.0;
    final trackWidth = dense ? 8.0 : 9.0;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: onChanged == null
              ? null
              : (details) =>
                    _updateFromDy(details.localPosition.dy - 8, railHeight),
          onVerticalDragUpdate: onChanged == null
              ? null
              : (details) =>
                    _updateFromDy(details.localPosition.dy - 8, railHeight),
          child: SizedBox(
            width: trackWidth,
            height: railHeight,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.09),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Align(
                alignment: Alignment.bottomCenter,
                child: FractionallySizedBox(
                  widthFactor: 1,
                  heightFactor: volume.clamp(0.0, 1.0),
                  alignment: Alignment.bottomCenter,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.88),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _updateFromDy(double dy, double railHeight) {
    final next = (1 - (dy / railHeight)).clamp(0.0, 1.0);
    onChanged?.call(next);
  }
}
