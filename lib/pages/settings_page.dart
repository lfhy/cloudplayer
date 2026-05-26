// Settings page restores the legacy horizontal-tab shell while the concrete panels live in part files.

import 'dart:async';

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/utils/platform_environment.dart';
import 'package:cloudplayer_flutter/widgets/child_window_dialog.dart';
import 'package:flutter/services.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

part 'settings/settings_panels.dart';
part 'settings/settings_color_picker.dart';
part 'settings/settings_color_picker_dialog.dart';
part 'settings/settings_lyrics_panel.dart';
part 'settings/settings_widgets.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key, required this.palette});

  final AppPalette palette;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  String selectedTab = 'appearance';

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final settings = controller.settings;
    if (settings == null) return const Center(child: ProgressRing());
    return ListView(
      children: <Widget>[
        const Text(
          '偏好设置',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            _SettingsTab(
              label: '外观',
              desc: '界面模式与主题色',
              active: selectedTab == 'appearance',
              palette: widget.palette,
              onPressed: () => setState(() => selectedTab = 'appearance'),
            ),
            _SettingsTab(
              label: '网络代理',
              desc: '接口访问代理',
              active: selectedTab == 'network',
              palette: widget.palette,
              onPressed: () => setState(() => selectedTab = 'network'),
            ),
            _SettingsTab(
              label: '音乐源',
              desc: '曲库与歌词源',
              active: selectedTab == 'source',
              palette: widget.palette,
              onPressed: () => setState(() => selectedTab = 'source'),
            ),
            _SettingsTab(
              label: '控制',
              desc: '关闭行为与快捷键',
              active: selectedTab == 'controls',
              palette: widget.palette,
              onPressed: () => setState(() => selectedTab = 'controls'),
            ),
            _SettingsTab(
              label: '歌词',
              desc: '桌面歌词颜色',
              active: selectedTab == 'lyrics',
              palette: widget.palette,
              onPressed: () => setState(() => selectedTab = 'lyrics'),
            ),
          ],
        ),
        const SizedBox(height: 20),
        switch (selectedTab) {
          'network' => _NetworkPanel(
            palette: widget.palette,
            settings: settings,
          ),
          'source' => _SourcePanel(palette: widget.palette, settings: settings),
          'controls' => _ControlsPanel(
            palette: widget.palette,
            settings: settings,
          ),
          'lyrics' => _LyricsPanel(palette: widget.palette, settings: settings),
          _ => _AppearancePanel(palette: widget.palette, settings: settings),
        },
      ],
    );
  }
}
