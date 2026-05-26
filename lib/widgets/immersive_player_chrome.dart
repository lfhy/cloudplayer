// Immersive chrome keeps shared buttons and decorative orbs out of the main immersive layout file.

import 'package:fluent_ui/fluent_ui.dart';

class ImmersiveCloseButtonChrome extends StatelessWidget {
  const ImmersiveCloseButtonChrome({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 48,
      height: 48,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(EdgeInsets.zero),
          backgroundColor: WidgetStatePropertyAll<Color>(
            Colors.white.withValues(alpha: 0.10),
          ),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(999),
              side: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
            ),
          ),
        ),
        child: const Icon(FluentIcons.chrome_close, color: Colors.white),
      ),
    );
  }
}

class ImmersiveBackButtonChrome extends StatelessWidget {
  const ImmersiveBackButtonChrome({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Button(
      onPressed: onPressed,
      style: ButtonStyle(
        padding: WidgetStateProperty.all(
          const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        ),
        backgroundColor: WidgetStatePropertyAll<Color>(
          Colors.white.withValues(alpha: 0.08),
        ),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
            side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
          ),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: const <Widget>[
          Icon(FluentIcons.chevron_left, size: 12, color: Colors.white),
          SizedBox(width: 4),
          Text('返回', style: TextStyle(color: Colors.white, fontSize: 12)),
        ],
      ),
    );
  }
}

class ImmersiveTransportButtonChrome extends StatelessWidget {
  const ImmersiveTransportButtonChrome({
    super.key,
    required this.icon,
    required this.onPressed,
    this.main = false,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final bool main;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: main ? 56 : 44,
      height: main ? 56 : 44,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(EdgeInsets.zero),
          backgroundColor: WidgetStateProperty.resolveWith((state) {
            if (main) {
              return const Color(0xFFC62F2F);
            }
            return Colors.white.withValues(
              alpha: state.isHovered ? 0.12 : 0.06,
            );
          }),
          foregroundColor: const WidgetStatePropertyAll<Color>(Colors.white),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(999),
              side: BorderSide(
                color: main
                    ? const Color(0x66C62F2F)
                    : Colors.white.withValues(alpha: 0.08),
              ),
            ),
          ),
        ),
        child: Icon(icon, size: main ? 22 : 18),
      ),
    );
  }
}

class ImmersiveModeButtonChrome extends StatelessWidget {
  const ImmersiveModeButtonChrome({
    super.key,
    required this.icon,
    required this.onPressed,
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final button = SizedBox(
      width: 40,
      height: 40,
      child: Button(
        onPressed: onPressed,
        style: ButtonStyle(
          padding: WidgetStateProperty.all(EdgeInsets.zero),
          backgroundColor: WidgetStateProperty.resolveWith((state) {
            return Colors.white.withValues(
              alpha: state.isHovered ? 0.12 : 0.06,
            );
          }),
          foregroundColor: const WidgetStatePropertyAll<Color>(Colors.white),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(999),
              side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
            ),
          ),
        ),
        child: Icon(icon, size: 17),
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}

class ImmersiveGlowOrb extends StatelessWidget {
  const ImmersiveGlowOrb({super.key, required this.color, required this.size});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: <Color>[color, Colors.transparent]),
        ),
      ),
    );
  }
}
