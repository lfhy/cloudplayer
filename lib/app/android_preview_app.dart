// Android preview app gives mobile builds a stable shell while the desktop Go
// bridge and native window integrations are still being migrated.

import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:fluent_ui/fluent_ui.dart';

class AndroidPreviewApp extends StatelessWidget {
  const AndroidPreviewApp({super.key});

  @override
  Widget build(BuildContext context) {
    final accent = _previewAccent();
    final palette = AppPalette(
      brightness: Brightness.dark,
      accent: accent,
      windowBackground: Color(0xFF10141C),
      panelBackground: Color(0xFF171D27),
      cardBackground: Color(0xFF1D2430),
      borderColor: Color(0x1FFFFFFF),
      mutedForeground: Color(0xFFA7B0BF),
      subtleBackground: Color(0x14FFFFFF),
      strongForeground: Color(0xFFF5F7FA),
    );
    return FluentApp(
      title: 'CloudPlayer',
      debugShowCheckedModeBanner: false,
      theme: FluentThemeData(
        brightness: palette.brightness,
        accentColor: palette.accent,
        scaffoldBackgroundColor: palette.windowBackground,
        cardColor: palette.cardBackground,
        inactiveBackgroundColor: palette.panelBackground,
      ),
      home: NavigationView(
        content: ScaffoldPage.scrollable(
          children: <Widget>[
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: palette.cardBackground,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: palette.borderColor),
                      boxShadow: <BoxShadow>[
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.18),
                          blurRadius: 28,
                          offset: const Offset(0, 18),
                        ),
                      ],
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(18),
                              gradient: LinearGradient(
                                colors: <Color>[
                                  palette.accent.darkest,
                                  palette.accent.normal,
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                            child: const Icon(
                              FluentIcons.cell_phone,
                              color: Colors.white,
                              size: 24,
                            ),
                          ),
                          const SizedBox(height: 18),
                          Text(
                            'CloudPlayer Android 适配中',
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w700,
                              color: palette.strongForeground,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            '当前仓库的完整能力仍依赖桌面 Go FFI bridge、桌面歌词浮层、托盘与窗口控制。'
                            '本次适配先补齐 Android 工程和移动端安全启动路径，避免应用在启动阶段误走桌面逻辑。',
                            style: TextStyle(
                              height: 1.5,
                              fontSize: 14,
                              color: palette.mutedForeground,
                            ),
                          ),
                          const SizedBox(height: 18),
                          _CapabilityRow(
                            palette: palette,
                            icon: FluentIcons.check_mark,
                            text:
                                'Android 平台工程已加入仓库，可直接参与 `flutter run -d android`。',
                          ),
                          const SizedBox(height: 10),
                          _CapabilityRow(
                            palette: palette,
                            icon: FluentIcons.check_mark,
                            text: '移动端现在会进入独立预览壳层，不再初始化桌面窗口、托盘或桌面歌词。',
                          ),
                          const SizedBox(height: 10),
                          _CapabilityRow(
                            palette: palette,
                            icon: FluentIcons.info,
                            text:
                                '要让 Android 获得完整播放 / 搜索 / 歌单能力，下一步需要补 Android `.so` 打包与 bridge 装载链路。',
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

AccentColor _previewAccent() {
  return AccentColor.swatch(<String, Color>{
    'darkest': const Color(0xFF6D1414),
    'darker': const Color(0xFF8A1A1A),
    'dark': const Color(0xFFA92525),
    'normal': const Color(0xFFC62F2F),
    'light': const Color(0xFFD85A5A),
    'lighter': const Color(0xFFE88383),
    'lightest': const Color(0xFFF2AEAE),
  });
}

class _CapabilityRow extends StatelessWidget {
  const _CapabilityRow({
    required this.palette,
    required this.icon,
    required this.text,
  });

  final AppPalette palette;
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(icon, size: 14, color: palette.accent.normal),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              height: 1.45,
              fontSize: 13,
              color: palette.strongForeground,
            ),
          ),
        ),
      ],
    );
  }
}
