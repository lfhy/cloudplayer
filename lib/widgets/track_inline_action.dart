// Inline track actions keep clickable artist and album text consistent across
// all list views without bloating the shared row renderer.

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';

class TrackInlineAction extends StatelessWidget {
  const TrackInlineAction({
    super.key,
    required this.label,
    required this.value,
    required this.onPressed,
    required this.palette,
  });

  final String label;
  final String value;
  final ValueChanged<String>? onPressed;
  final AppPalette palette;

  @override
  Widget build(BuildContext context) {
    final normalized = value.trim();
    final clickable = onPressed != null && normalized.isNotEmpty;
    const fontSize = 12.0;
    if (!clickable) {
      return Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(fontSize: fontSize, color: palette.mutedForeground),
      );
    }
    return HoverButton(
      onPressed: () => onPressed?.call(normalized),
      builder: (context, states) {
        final textColor = states.isHovered
            ? palette.accent.normal
            : palette.mutedForeground;
        return Container(
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(vertical: 1),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: fontSize, color: textColor),
          ),
        );
      },
    );
  }
}
