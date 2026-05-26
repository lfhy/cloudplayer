part of '../settings_page.dart';

// Lyrics settings stay split from the rest of the settings panels because they
// also own the desktop-lyrics window toggles and preview behavior.

class _LyricsPanel extends StatelessWidget {
  const _LyricsPanel({required this.palette, required this.settings});

  final AppPalette palette;
  final AppSettings settings;

  @override
  Widget build(BuildContext context) {
    final controller = context.read<AppController>();
    final desktopLyricsSupported = isDesktopHost;
    final providers = settings.lyricsProviderOrder
        .split(',')
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toList();
    return _SettingsPanel(
      palette: palette,
      children: <Widget>[
        const _FieldLabel('自动歌词来源'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            for (final item in const <(String, String)>[
              ('qq', 'QQ'),
              ('kugou', '酷狗官方'),
              ('netease', '网易云'),
              ('lrclib', 'LRCLib'),
            ])
              _ChoiceChip(
                label: item.$2,
                active: providers.contains(item.$1),
                palette: palette,
                onPressed: () => controller.updateSettings(
                  settings.copyWith(
                    lyricsProviderOrder: _toggleProvider(providers, item.$1),
                  ),
                ),
              ),
          ],
        ),
        _HintText('按当前顺序依次尝试：${providers.join(' → ')}'),
        const SizedBox(height: 18),
        _LabeledTextBox(
          label: '网易云歌词 API 根地址（可选）',
          controller: TextEditingController(
            text: settings.lyricsNeteaseApiBase,
          ),
          placeholder: 'https://example.com',
          onSubmitted: (value) => controller.updateSettings(
            settings.copyWith(lyricsNeteaseApiBase: value),
          ),
        ),
        const SizedBox(height: 18),
        const _FieldLabel('桌面歌词'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            _ChoiceChip(
              label: settings.desktopLyricsVisible ? '隐藏桌面歌词' : '显示桌面歌词',
              active: settings.desktopLyricsVisible,
              palette: palette,
              onPressed: desktopLyricsSupported
                  ? () => controller.toggleDesktopLyrics()
                  : null,
            ),
            _ChoiceChip(
              label: settings.desktopLyricsLocked ? '已锁定' : '未锁定',
              active: settings.desktopLyricsLocked,
              palette: palette,
              onPressed: desktopLyricsSupported && settings.desktopLyricsVisible
                  ? () => controller.toggleDesktopLyricsLocked()
                  : null,
            ),
            _DesktopLyricsActionButton(
              palette: palette,
              onPressed: desktopLyricsSupported && settings.desktopLyricsVisible
                  ? () => controller.resetDesktopLyricsBounds()
                  : null,
              label: '重置歌词位置',
            ),
          ],
        ),
        _HintText(
          !desktopLyricsSupported
              ? '移动端不提供独立桌面歌词窗口，但会继续使用同一套歌词来源和样式配置。'
              : settings.desktopLyricsVisible
              ? '锁定后桌面歌词会变为点穿窗口。'
              : '打开后会在 macOS 桌面显示独立歌词窗口。',
        ),
        const SizedBox(height: 18),
        Row(
          children: <Widget>[
            Expanded(
              child: _LyricsColorField(
                label: '未唱字色',
                value: settings.desktopLyricsColorBase,
                fallbackValue: '#ffffff',
                previewLabel: '选择',
                palette: palette,
                onChanged: (value) => controller.updateSettings(
                  settings.copyWith(desktopLyricsColorBase: value),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _LyricsColorField(
                label: '已唱字色',
                value: settings.desktopLyricsColorHighlight,
                fallbackValue: '#ffb7d4',
                previewLabel: '选择',
                palette: palette,
                onChanged: (value) => controller.updateSettings(
                  settings.copyWith(desktopLyricsColorHighlight: value),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        _LabeledTextBox(
          label: '无播放默认文案 1',
          controller: TextEditingController(
            text: settings.desktopLyricsIdleLine1,
          ),
          onSubmitted: (value) => controller.updateSettings(
            settings.copyWith(desktopLyricsIdleLine1: value),
          ),
        ),
        const SizedBox(height: 14),
        _LabeledTextBox(
          label: '无播放默认文案 2',
          controller: TextEditingController(
            text: settings.desktopLyricsIdleLine2,
          ),
          onSubmitted: (value) => controller.updateSettings(
            settings.copyWith(desktopLyricsIdleLine2: value),
          ),
        ),
        const SizedBox(height: 18),
        const _FieldLabel('效果预览'),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: palette.subtleBackground,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: palette.borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                settings.desktopLyricsIdleLine1,
                style: TextStyle(
                  fontSize: 18 * settings.desktopLyricsScale,
                  fontWeight: FontWeight.w600,
                  color: Color(_colorFromHex(settings.desktopLyricsColorBase)),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                settings.desktopLyricsIdleLine2,
                style: TextStyle(
                  fontSize: 18 * settings.desktopLyricsScale,
                  fontWeight: FontWeight.w700,
                  color: Color(
                    _colorFromHex(settings.desktopLyricsColorHighlight),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DesktopLyricsActionButton extends StatelessWidget {
  const _DesktopLyricsActionButton({
    required this.palette,
    required this.onPressed,
    required this.label,
  });

  final AppPalette palette;
  final VoidCallback? onPressed;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Button(
      onPressed: onPressed,
      style: ButtonStyle(
        padding: WidgetStateProperty.all(
          const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        ),
        backgroundColor: WidgetStateProperty.resolveWith(
          (state) => state.isHovered
              ? palette.subtleBackground
              : palette.cardBackground,
        ),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(13),
            side: BorderSide(color: palette.borderColor),
          ),
        ),
      ),
      child: Text(label, style: const TextStyle(fontSize: 12)),
    );
  }
}
