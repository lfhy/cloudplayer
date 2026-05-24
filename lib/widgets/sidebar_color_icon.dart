// Sidebar color icons keep the original glyph shapes while letting callers
// promote them to the active theme color instead of default black.

import 'package:fluent_ui/fluent_ui.dart';

class SidebarColorIcon extends StatelessWidget {
  const SidebarColorIcon({
    super.key,
    required this.icon,
    required this.tint,
    this.size = 18,
    this.boxSize = 24,
  });

  final IconData icon;
  final Color tint;
  final double size;
  final double boxSize;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: boxSize,
      height: boxSize,
      child: Center(
        child: Icon(icon, size: size, color: tint),
      ),
    );
  }
}
