// Legacy list toolbar buttons match the old Wails text-button rhythm across playlist and search pages.

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/legacy_track_icons.dart';
import 'package:fluent_ui/fluent_ui.dart';

class LegacyActionButton extends StatelessWidget {
  const LegacyActionButton({
    super.key,
    required this.palette,
    required this.label,
    required this.onPressed,
    this.accent = false,
    this.minHeight = 34,
    this.showPlayGlyph = false,
  });

  final AppPalette palette;
  final String label;
  final VoidCallback? onPressed;
  final bool accent;
  final double minHeight;
  final bool showPlayGlyph;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(
            const EdgeInsets.symmetric(horizontal: 12),
          ),
          backgroundColor: WidgetStateProperty.resolveWith(
            (states) => _backgroundColor(states),
          ),
          foregroundColor: WidgetStateProperty.all(
            accent ? Colors.white : palette.strongForeground,
          ),
          shape: WidgetStateProperty.resolveWith(
            (states) => RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: _borderColor(states)),
            ),
          ),
          textStyle: WidgetStateProperty.all(
            const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
          ),
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: minHeight),
          child: Align(
            widthFactor: 1,
            alignment: Alignment.center,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                if (showPlayGlyph) ...<Widget>[
                  LegacyPlayIcon(
                    color: accent ? Colors.white : palette.strongForeground,
                  ),
                  const SizedBox(width: 6),
                ],
                Text(label, softWrap: false),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Color _backgroundColor(Set<WidgetState> states) {
    if (accent) {
      if (states.isPressed) {
        return _mix(palette.accent.normal, Colors.black, 0.14);
      }
      if (states.isHovered) {
        return _mix(palette.accent.normal, Colors.black, 0.08);
      }
      return palette.accent.normal;
    }
    if (states.isPressed) {
      return _mix(
        palette.cardBackground,
        palette.accent.normal,
        palette.brightness == Brightness.light ? 0.10 : 0.18,
      );
    }
    if (states.isHovered) {
      return _mix(
        palette.cardBackground,
        palette.accent.normal,
        palette.brightness == Brightness.light ? 0.06 : 0.12,
      );
    }
    return palette.cardBackground;
  }

  Color _borderColor(Set<WidgetState> states) {
    if (accent) {
      return _mix(
        palette.accent.normal,
        palette.brightness == Brightness.light ? Colors.black : Colors.white,
        palette.brightness == Brightness.light ? 0.12 : 0.08,
      );
    }
    if (states.isHovered || states.isPressed) {
      return _mix(palette.borderColor, palette.accent.normal, 0.36);
    }
    return palette.borderColor;
  }
}

Color _mix(Color base, Color target, double amount) {
  return Color.lerp(base, target, amount) ?? base;
}
