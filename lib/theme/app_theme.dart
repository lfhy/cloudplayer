// Theme helpers translate legacy CloudPlayer theme settings into Fluent UI colors and surfaces.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:fluent_ui/fluent_ui.dart';

class AppPalette {
  const AppPalette({
    required this.brightness,
    required this.accent,
    required this.windowBackground,
    required this.windowChromeBlend,
    required this.panelBackground,
    required this.cardBackground,
    required this.borderColor,
    required this.mutedForeground,
    required this.subtleBackground,
    required this.strongForeground,
  });

  final Brightness brightness;
  final AccentColor accent;
  final Color windowBackground;
  final Color windowChromeBlend;
  final Color panelBackground;
  final Color cardBackground;
  final Color borderColor;
  final Color mutedForeground;
  final Color subtleBackground;
  final Color strongForeground;
}

AppPalette paletteForSettings(AppSettings? settings) {
  final mode = settings?.appThemeMode == 'light' ? 'light' : 'dark';
  final accentHex = _accentHexForTheme(
    settings?.appTheme ?? 'coral',
    settings?.appThemeCustomAccent ?? '#c62f2f',
  );
  final accent = _accentFromHex(accentHex);
  if (mode == 'light') {
    return AppPalette(
      brightness: Brightness.light,
      accent: accent,
      windowBackground: const Color(0xFFF7F7F7),
      windowChromeBlend: const Color(0xFFECEFF3),
      panelBackground: Colors.white,
      cardBackground: Colors.white,
      borderColor: const Color(0xFFE5E5E5),
      mutedForeground: const Color(0xFF888888),
      subtleBackground: const Color(0xFFF3F4F6),
      strongForeground: const Color(0xFF333333),
    );
  }
  return AppPalette(
    brightness: Brightness.dark,
    accent: accent,
    windowBackground: const Color(0xFF16181C),
    windowChromeBlend: const Color(0xFF1E232A),
    panelBackground: const Color(0xFF22252B),
    cardBackground: const Color(0xFF22252B),
    borderColor: const Color(0x1AFFFFFF),
    mutedForeground: const Color(0xFFA4ACB8),
    subtleBackground: const Color(0x14FFFFFF),
    strongForeground: const Color(0xFFF2F3F5),
  );
}

FluentThemeData buildThemeData(AppSettings? settings) {
  final palette = paletteForSettings(settings);
  return FluentThemeData(
    brightness: palette.brightness,
    accentColor: palette.accent,
    fontFamily: 'PingFang SC',
    visualDensity: VisualDensity.standard,
    scaffoldBackgroundColor: palette.windowBackground,
    cardColor: palette.cardBackground,
    inactiveBackgroundColor: palette.panelBackground,
    micaBackgroundColor: palette.windowBackground,
  );
}

String _accentHexForTheme(String theme, String customAccent) {
  switch (theme) {
    case 'ocean':
      return '#1f6aa5';
    case 'forest':
      return '#2f7d4b';
    case 'netease':
      return '#d43c33';
    case 'kugou':
      return '#1977ff';
    case 'qqmusic':
      return '#31c27c';
    case 'custom':
      return customAccent;
    default:
      return '#c62f2f';
  }
}

AccentColor _accentFromHex(String value) {
  final base = _colorFromHex(value);
  return AccentColor.swatch(<String, Color>{
    'darkest': _mix(base, Colors.black, 0.45),
    'darker': _mix(base, Colors.black, 0.30),
    'dark': _mix(base, Colors.black, 0.15),
    'normal': base,
    'light': _mix(base, Colors.white, 0.12),
    'lighter': _mix(base, Colors.white, 0.25),
    'lightest': _mix(base, Colors.white, 0.38),
  });
}

Color _mix(Color a, Color b, double t) {
  return Color.lerp(a, b, t) ?? a;
}

Color _colorFromHex(String value) {
  final normalized = value.replaceFirst('#', '');
  final buffer = StringBuffer();
  if (normalized.length == 6) {
    buffer.write('ff');
  }
  buffer.write(normalized);
  return Color(int.parse(buffer.toString(), radix: 16));
}
