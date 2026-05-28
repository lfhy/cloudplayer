part of '../settings_page.dart';

// Settings panels keep each tab body isolated so the page shell stays small and within repo limits.

class _AppearancePanel extends StatelessWidget {
  const _AppearancePanel({required this.palette, required this.settings});

  final AppPalette palette;
  final AppSettings settings;

  @override
  Widget build(BuildContext context) {
    final controller = context.read<AppController>();
    return _SettingsPanel(
      palette: palette,
      children: <Widget>[
        const _FieldLabel('界面模式'),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: <Widget>[
            _ModeCard(
              title: '浅色',
              desc: '明亮干净的主界面',
              preview: const Color(0xFFFFFFFF),
              previewAccent: const Color(0xFFECEEF2),
              active: settings.appThemeMode == 'light',
              palette: palette,
              onPressed: () => controller.updateSettings(
                settings.copyWith(appThemeMode: 'light'),
              ),
            ),
            _ModeCard(
              title: '暗色',
              desc: '纯黑背景的夜间界面',
              preview: const Color(0xFF0B0B0B),
              previewAccent: const Color(0xFF23262D),
              active: settings.appThemeMode != 'light',
              palette: palette,
              onPressed: () => controller.updateSettings(
                settings.copyWith(appThemeMode: 'dark'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        const _FieldLabel('应用主题'),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: <Widget>[
            for (final theme in _themeItems)
              _ThemeCard(
                title: theme.title,
                desc: theme.desc,
                color: theme.color,
                custom: theme.key == 'custom',
                active: settings.appTheme == theme.key,
                palette: palette,
                onPressed: () => controller.updateSettings(
                  settings.copyWith(appTheme: theme.key),
                ),
              ),
          ],
        ),
        if (settings.appTheme == 'custom') ...<Widget>[
          const SizedBox(height: 14),
          _LabeledTextBox(
            label: '主题强调色',
            controller: TextEditingController(
              text: settings.appThemeCustomAccent,
            ),
            onSubmitted: (value) => controller.updateSettings(
              settings.copyWith(appThemeCustomAccent: value),
            ),
          ),
        ],
      ],
    );
  }
}

class _NetworkPanel extends StatelessWidget {
  const _NetworkPanel({required this.palette, required this.settings});

  final AppPalette palette;
  final AppSettings settings;

  @override
  Widget build(BuildContext context) {
    final controller = context.read<AppController>();
    return _SettingsPanel(
      palette: palette,
      children: <Widget>[
        const _FieldLabel('网络代理'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            for (final item in const <(String, String)>[
              ('direct', '不使用代理'),
              ('system', '使用系统代理'),
              ('custom', '使用自定义代理'),
            ])
              _ChoiceChip(
                label: item.$2,
                active: settings.networkProxyMode == item.$1,
                palette: palette,
                onPressed: () => controller.updateSettings(
                  settings.copyWith(networkProxyMode: item.$1),
                ),
              ),
          ],
        ),
        if (settings.networkProxyMode == 'custom') ...<Widget>[
          const SizedBox(height: 14),
          _LabeledTextBox(
            label: '自定义代理地址',
            controller: TextEditingController(text: settings.networkProxyUrl),
            placeholder: 'http://127.0.0.1:7890 或 socks5://127.0.0.1:7891',
            onSubmitted: (value) => controller.updateSettings(
              settings.copyWith(networkProxyUrl: value),
            ),
          ),
        ],
        _HintText(
          '支持 http://、https://、socks5://、socks5h://。选「系统代理」时会跟随 macOS 当前代理配置。',
        ),
      ],
    );
  }
}

class _SourcePanel extends StatelessWidget {
  const _SourcePanel({required this.palette, required this.settings});

  final AppPalette palette;
  final AppSettings settings;

  List<String> get _fallbackProviders =>
      normalizedPlaybackFallbackProviders(settings.playbackFallbackChain);

  void _updateFallbackProviders(
    AppController controller,
    List<String> providers,
  ) {
    controller.updateSettings(
      settings.copyWith(
        playbackFallbackChain: normalizedPlaybackFallbackChain(
          providers.join(','),
        ),
      ),
    );
  }

  void _moveFallbackProvider(
    AppController controller,
    int index,
    int direction,
  ) {
    final providers = List<String>.from(_fallbackProviders);
    final targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= providers.length) return;
    final item = providers.removeAt(index);
    providers.insert(targetIndex, item);
    _updateFallbackProviders(controller, providers);
  }

  Future<void> _changeCollectionMode(
    BuildContext context,
    AppController controller,
    String nextMode,
  ) async {
    if (nextMode == settings.musicCollectionMode) return;
    if (nextMode == 'online') {
      final accepted = await showOnlineModeConfirmDialog(
        context: context,
        palette: palette,
      );
      if (!accepted || !context.mounted) return;
    }
    await controller.changeMusicCollectionMode(nextMode);
  }

  Future<void> _repairDatabase(
    BuildContext context,
    AppController controller,
  ) async {
    await showDatabaseRepairDialog(
      context: context,
      palette: palette,
      onRepair: controller.repairDatabase,
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.read<AppController>();
    final fallbackProviders = _fallbackProviders;
    return _SettingsPanel(
      palette: palette,
      children: <Widget>[
        const _FieldLabel('在线曲库渠道'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            for (final providerKey in musicSourceProviderChoiceOrder)
              _ChoiceChip(
                label: musicSourceProviderLabel(providerKey),
                active: settings.musicSourceProvider == providerKey,
                palette: palette,
                onPressed: () => controller.updateSettings(
                  settings.copyWith(musicSourceProvider: providerKey),
                ),
              ),
          ],
        ),
        _HintText('当前默认搜索、试听、播放与下载都会跟随这里选择的曲库渠道。'),
        const SizedBox(height: 18),
        const _FieldLabel('歌单模式'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            for (final item in const <(String, String)>[
              ('offline', '离线模式'),
              ('online', '在线模式'),
              ('hybrid', '混合模式'),
            ])
              _ChoiceChip(
                label: item.$2,
                active: settings.musicCollectionMode == item.$1,
                palette: palette,
                onPressed: () =>
                    _changeCollectionMode(context, controller, item.$1),
              ),
          ],
        ),
        _HintText('离线模式使用本地歌单；在线模式直接操作酷狗云端；混合模式会 fork 到本地并尽量回写。'),
        const SizedBox(height: 18),
        ToggleSwitch(
          checked: settings.autoCacheOnPlay,
          content: const Text('边听边存'),
          onChanged: (value) => controller.updateSettings(
            settings.copyWith(autoCacheOnPlay: value),
          ),
        ),
        _HintText('开启后，播放在线歌曲时会自动加入下载缓存队列，可在“下载管理”查看。'),
        const SizedBox(height: 18),
        Row(
          children: <Widget>[
            const Expanded(child: _FieldLabel('播放故障转移顺序')),
            Button(
              onPressed: () => _updateFallbackProviders(
                controller,
                List<String>.from(playbackFallbackProviderDefaultOrder),
              ),
              child: const Text('恢复默认'),
            ),
          ],
        ),
        const SizedBox(height: 10),
        for (
          var index = 0;
          index < fallbackProviders.length;
          index++
        ) ...<Widget>[
          _FallbackProviderRow(
            palette: palette,
            index: index,
            total: fallbackProviders.length,
            title: musicSourceProviderLabel(fallbackProviders[index]),
            active: fallbackProviders[index] == settings.musicSourceProvider,
            onMoveUp: index == 0
                ? null
                : () => _moveFallbackProvider(controller, index, -1),
            onMoveDown: index == fallbackProviders.length - 1
                ? null
                : () => _moveFallbackProvider(controller, index, 1),
          ),
          if (index != fallbackProviders.length - 1) const SizedBox(height: 8),
        ],
        _HintText('主音源播放失败后会按这里的顺序依次切换。旧配置和后续新接入的音源都会自动补到链尾，不需要手填逗号字符串。'),
        const SizedBox(height: 18),
        Row(
          children: <Widget>[
            Expanded(
              child: _LabeledTextBox(
                label: '搜索缓存时长',
                controller: TextEditingController(
                  text: settings.searchCacheTtlHours.toString(),
                ),
                onSubmitted: (value) {
                  final hours =
                      int.tryParse(value) ?? settings.searchCacheTtlHours;
                  controller.updateSettings(
                    settings.copyWith(searchCacheTtlHours: hours),
                  );
                },
              ),
            ),
            const SizedBox(width: 10),
            Button(
              onPressed: controller.clearSearchCache,
              child: const Text('清理缓存'),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: <Widget>[
            FilledButton(
              onPressed: () => _repairDatabase(context, controller),
              child: const Text('修复数据库'),
            ),
            Button(
              onPressed: () => controller.setPage(AppPage.import),
              child: const Text('前往导入歌单'),
            ),
          ],
        ),
      ],
    );
  }
}

class _ControlsPanel extends StatelessWidget {
  const _ControlsPanel({required this.palette, required this.settings});

  final AppPalette palette;
  final AppSettings settings;

  @override
  Widget build(BuildContext context) {
    final controller = context.read<AppController>();
    final closeBehaviorEnabled = isDesktopHost;
    return _SettingsPanel(
      palette: palette,
      children: <Widget>[
        _LabeledCombo<String>(
          label: '关闭主窗口时',
          value: settings.mainWindowCloseAction,
          items: const <ComboBoxItem<String>>[
            ComboBoxItem(value: 'ask', child: Text('每次询问')),
            ComboBoxItem(value: 'tray', child: Text('最小化到系统托盘')),
            ComboBoxItem(value: 'quit', child: Text('退出应用')),
          ],
          onChanged: closeBehaviorEnabled
              ? (value) {
                  if (value == null) return;
                  controller.updateSettings(
                    settings.copyWith(mainWindowCloseAction: value),
                  );
                }
              : null,
        ),
        const SizedBox(height: 18),
        _HintText(
          closeBehaviorEnabled
              ? '后台也能响应；默认使用 Ctrl+Alt+ 组合以避免中文输入法占用 Ctrl+Space。'
              : '移动端不涉及主窗口关闭到托盘的桌面行为。',
        ),
      ],
    );
  }
}
