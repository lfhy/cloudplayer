// Shared playback-presence motion keeps paused and playing states visually
// aligned across dock, mini mode, and immersive mode without duplicating the
// same fade/scale transition in each widget tree.

import 'package:fluent_ui/fluent_ui.dart';

class PlaybackPresence extends StatelessWidget {
  const PlaybackPresence({
    super.key,
    required this.playing,
    required this.child,
    this.playingOpacity = 1,
    this.pausedOpacity = 0.76,
    this.playingScale = 1,
    this.pausedScale = 0.985,
    this.playingOffset = Offset.zero,
    this.pausedOffset = const Offset(0, 0.02),
    this.duration = const Duration(milliseconds: 240),
    this.curve = Curves.easeOutCubic,
  });

  final bool playing;
  final Widget child;
  final double playingOpacity;
  final double pausedOpacity;
  final double playingScale;
  final double pausedScale;
  final Offset playingOffset;
  final Offset pausedOffset;
  final Duration duration;
  final Curve curve;

  @override
  Widget build(BuildContext context) {
    final opacity = playing ? playingOpacity : pausedOpacity;
    final scale = playing ? playingScale : pausedScale;
    final offset = playing ? playingOffset : pausedOffset;
    return AnimatedSlide(
      offset: offset,
      duration: duration,
      curve: curve,
      child: AnimatedScale(
        scale: scale,
        duration: duration,
        curve: curve,
        child: AnimatedOpacity(
          opacity: opacity,
          duration: duration,
          curve: curve,
          child: child,
        ),
      ),
    );
  }
}
