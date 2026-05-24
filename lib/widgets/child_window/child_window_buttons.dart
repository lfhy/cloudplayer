// Shared child-window buttons keep the compact legacy sizing and tones consistent across close-confirm and message-style flows.

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';

class ChildDialogChoiceButton extends StatelessWidget {
  const ChildDialogChoiceButton({
    super.key,
    required this.palette,
    required this.label,
    required this.onPressed,
    this.danger = false,
  });

  final AppPalette palette;
  final String label;
  final VoidCallback onPressed;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final borderColor = danger ? const Color(0x2ECF2323) : palette.borderColor;
    final backgroundColor = danger
        ? const Color(0x14C62F2F)
        : palette.cardBackground;
    final foregroundColor = danger
        ? const Color(0xFFC62F2F)
        : palette.strongForeground;
    return SizedBox(
      height: 36,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(
            const EdgeInsets.symmetric(horizontal: 12),
          ),
          backgroundColor: WidgetStateProperty.resolveWith(
            (state) => state.isHovered
                ? danger
                    ? const Color(0x1FC62F2F)
                    : palette.accent.normal.withValues(alpha: 0.08)
                : backgroundColor,
          ),
          foregroundColor: WidgetStatePropertyAll<Color>(foregroundColor),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: BorderSide(color: borderColor),
            ),
          ),
        ),
        child: Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class ChildDialogSecondaryButton extends StatelessWidget {
  const ChildDialogSecondaryButton({
    super.key,
    required this.palette,
    required this.label,
    required this.onPressed,
    this.compact = false,
  });

  final AppPalette palette;
  final String label;
  final VoidCallback onPressed;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: compact ? 30 : 32,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(
            EdgeInsets.symmetric(horizontal: compact ? 10 : 12),
          ),
          backgroundColor: WidgetStatePropertyAll<Color>(palette.cardBackground),
          foregroundColor: WidgetStatePropertyAll<Color>(palette.strongForeground),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(compact ? 14 : 10),
              side: BorderSide(color: palette.borderColor),
            ),
          ),
        ),
        child: Text(label, style: TextStyle(fontSize: compact ? 11 : 12)),
      ),
    );
  }
}

class ChildDialogPrimaryButton extends StatelessWidget {
  const ChildDialogPrimaryButton({
    super.key,
    required this.palette,
    required this.label,
    required this.onPressed,
    this.minWidth = 88,
  });

  final AppPalette palette;
  final String label;
  final VoidCallback onPressed;
  final double minWidth;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(minWidth: minWidth),
      child: SizedBox(
        height: 32,
        child: FilledButton(
          onPressed: onPressed,
          style: ButtonStyle(
            shape: WidgetStateProperty.all(
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          child: Text(label, style: const TextStyle(fontSize: 12)),
        ),
      ),
    );
  }
}
