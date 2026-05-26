// Shared dock button widgets keep the footer styling close to the Wails layout
// without inflating the main player_dock.dart file beyond repository limits.

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';

class DockIconButton extends StatelessWidget {
  const DockIconButton({
    super.key,
    required this.palette,
    required this.child,
    required this.onPressed,
    this.active = false,
    this.emphasizeActive = false,
    this.tooltip,
  });

  final AppPalette palette;
  final Widget child;
  final VoidCallback? onPressed;
  final bool active;
  final bool emphasizeActive;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final foreground = active ? palette.accent.normal : palette.mutedForeground;
    final button = SizedBox(
      width: 28,
      height: 28,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(EdgeInsets.zero),
          backgroundColor: WidgetStateProperty.resolveWith((state) {
            if (active && emphasizeActive) {
              return palette.accent.normal.withValues(
                alpha: state.isHovered ? 0.16 : 0.1,
              );
            }
            return state.isHovered
                ? palette.subtleBackground
                : Colors.transparent;
          }),
          foregroundColor: WidgetStateProperty.resolveWith((state) {
            if (state.isDisabled) {
              return foreground.withValues(alpha: 0.42);
            }
            return foreground;
          }),
          shadowColor: WidgetStateProperty.all(Colors.transparent),
          textStyle: WidgetStatePropertyAll<TextStyle>(
            const TextStyle(fontSize: 12),
          ),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
          ),
        ),
        child: child,
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}

class DockChipButton extends StatelessWidget {
  const DockChipButton({
    super.key,
    required this.palette,
    required this.child,
    required this.onPressed,
    this.active = false,
    this.iconOnly = false,
    this.tooltip,
  });

  final AppPalette palette;
  final Widget child;
  final VoidCallback? onPressed;
  final bool active;
  final bool iconOnly;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final borderColor = iconOnly
        ? Colors.transparent
        : palette.borderColor.withValues(alpha: 0.82);
    final foreground = active
        ? palette.accent.normal
        : palette.strongForeground;
    final button = SizedBox(
      width: iconOnly ? 30 : null,
      height: 30,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(
            iconOnly
                ? EdgeInsets.zero
                : const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          ),
          backgroundColor: WidgetStateProperty.resolveWith((state) {
            if (active) {
              return palette.accent.normal.withValues(
                alpha: state.isHovered ? 0.16 : 0.1,
              );
            }
            if (state.isHovered) {
              return palette.subtleBackground;
            }
            return iconOnly && palette.brightness == Brightness.dark
                ? Colors.transparent
                : palette.cardBackground;
          }),
          foregroundColor: WidgetStateProperty.resolveWith((state) {
            if (state.isDisabled) {
              return foreground.withValues(alpha: 0.42);
            }
            return foreground;
          }),
          shadowColor: WidgetStateProperty.all(Colors.transparent),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
              side: BorderSide(color: borderColor),
            ),
          ),
        ),
        child: child,
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}

class DockTransportButton extends StatelessWidget {
  const DockTransportButton({
    super.key,
    required this.palette,
    required this.child,
    required this.onPressed,
    this.main = false,
    this.tooltip,
  });

  final AppPalette palette;
  final Widget child;
  final VoidCallback? onPressed;
  final bool main;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final button = SizedBox(
      width: main ? 44 : 38,
      height: main ? 44 : 38,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(EdgeInsets.zero),
          backgroundColor: WidgetStateProperty.resolveWith((state) {
            if (main) {
              return palette.accent.normal;
            }
            return state.isHovered
                ? palette.subtleBackground
                : palette.cardBackground;
          }),
          foregroundColor: WidgetStatePropertyAll<Color>(
            main ? Colors.white : palette.strongForeground,
          ),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        ),
        child: child,
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}

class DockModeButton extends StatelessWidget {
  const DockModeButton({
    super.key,
    required this.palette,
    required this.child,
    required this.onPressed,
    this.tooltip,
    this.transport = false,
  });

  final AppPalette palette;
  final Widget child;
  final VoidCallback? onPressed;
  final String? tooltip;
  final bool transport;

  @override
  Widget build(BuildContext context) {
    final button = SizedBox(
      width: transport ? 38 : 34,
      height: transport ? 38 : 34,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(EdgeInsets.zero),
          backgroundColor: WidgetStateProperty.resolveWith(
            (state) => state.isHovered
                ? palette.subtleBackground
                : palette.cardBackground,
          ),
          foregroundColor: WidgetStatePropertyAll<Color>(palette.accent.normal),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),
        child: child,
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}
