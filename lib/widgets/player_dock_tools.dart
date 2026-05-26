// Dock tools keep volume and desktop-lyrics controls grouped together so the
// main player_dock widget can stay focused on shared transport layout.

import 'dart:async';

import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/utils/platform_environment.dart';
import 'package:cloudplayer_flutter/widgets/player_dock_buttons.dart';
import 'package:cloudplayer_flutter/widgets/legacy_dock_icons.dart';
import 'package:cloudplayer_flutter/widgets/player_dock_flyouts.dart';
import 'package:fluent_ui/fluent_ui.dart';

class PlayerDockToolsSection extends StatefulWidget {
  const PlayerDockToolsSection({
    super.key,
    required this.palette,
    required this.controller,
    required this.volume,
    this.compact = false,
  });

  final AppPalette palette;
  final AppController controller;
  final double volume;
  final bool compact;

  @override
  State<PlayerDockToolsSection> createState() => _PlayerDockToolsSectionState();
}

class _PlayerDockToolsSectionState extends State<PlayerDockToolsSection> {
  final FlyoutController _qualityController = FlyoutController();
  String _qualityPreference = '128';

  @override
  void dispose() {
    _qualityController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final desktopControlsEnabled = isDesktopHost && !widget.compact;
    final compact = widget.compact || isMobileHost;
    final desktopOpen = controller.desktopLyricsOpen;
    final desktopLocked = controller.settings?.desktopLyricsLocked ?? true;
    final quickThemeMode = controller.settings?.appThemeMode == 'light'
        ? 'light'
        : 'dark';
    final lyricsLockTooltip = !desktopOpen
        ? '先打开桌面歌词'
        : desktopLocked
        ? '解锁桌面歌词'
        : '锁定桌面歌词';
    if (compact) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          DockChipButton(
            palette: widget.palette,
            iconOnly: true,
            tooltip: _quickThemeTooltip(quickThemeMode),
            onPressed: controller.settings == null
                ? null
                : () => unawaited(_toggleQuickThemeMode(controller)),
            child: Icon(
              _quickThemeIcon(quickThemeMode),
              size: 14,
              color: controller.settings == null
                  ? widget.palette.strongForeground.withValues(alpha: 0.42)
                  : widget.palette.strongForeground,
            ),
          ),
          const SizedBox(width: 8),
          DockIconButton(
            palette: widget.palette,
            active: controller.isEffectivelyMuted,
            tooltip: '静音',
            onPressed: controller.settings == null
                ? null
                : () => unawaited(controller.toggleMute()),
            child: LegacyDockIcon(
              glyph: controller.isEffectivelyMuted
                  ? LegacyDockGlyph.volumeMute
                  : LegacyDockGlyph.volumeSmall,
              size: 15,
              color: controller.settings == null
                  ? widget.palette.mutedForeground.withValues(alpha: 0.42)
                  : controller.isEffectivelyMuted
                  ? widget.palette.accent.normal
                  : widget.palette.mutedForeground,
            ),
          ),
        ],
      );
    }
    return Padding(
      padding: const EdgeInsets.only(left: 18),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          DockIconButton(
            palette: widget.palette,
            active: controller.miniModeOpen,
            emphasizeActive: true,
            tooltip: desktopControlsEnabled ? '进入 Mini 模式' : '仅桌面端可用',
            onPressed: desktopControlsEnabled
                ? () => unawaited(controller.toggleMiniMode())
                : null,
            child: LegacyDockIcon(
              glyph: LegacyDockGlyph.enterMini,
              size: 15,
              color: _toolColor(
                active: controller.miniModeOpen,
                enabled: desktopControlsEnabled,
              ),
            ),
          ),
          const SizedBox(width: 10),
          DockChipButton(
            palette: widget.palette,
            iconOnly: true,
            tooltip: _quickThemeTooltip(quickThemeMode),
            onPressed: controller.settings == null
                ? null
                : () => unawaited(_toggleQuickThemeMode(controller)),
            child: Icon(
              _quickThemeIcon(quickThemeMode),
              size: 14,
              color: controller.settings == null
                  ? widget.palette.strongForeground.withValues(alpha: 0.42)
                  : widget.palette.strongForeground,
            ),
          ),
          const SizedBox(width: 10),
          FlyoutTarget(
            controller: _qualityController,
            child: DockChipButton(
              palette: widget.palette,
              tooltip: '音质偏好（展示；下载以菜单为准）',
              onPressed: _showQualityMenu,
              child: Text(
                _qualityLabel(_qualityPreference),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: widget.palette.strongForeground,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          DockIconButton(
            palette: widget.palette,
            active: desktopOpen,
            emphasizeActive: true,
            tooltip: desktopControlsEnabled ? '桌面歌词（独立窗口）' : '仅桌面端可用',
            onPressed: controller.settings == null || !desktopControlsEnabled
                ? null
                : () => unawaited(controller.toggleDesktopLyrics()),
            child: const Text(
              '词',
              style: TextStyle(
                fontSize: 13,
                height: 1,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 4),
          DockIconButton(
            palette: widget.palette,
            active: desktopOpen && desktopLocked,
            emphasizeActive: true,
            tooltip: lyricsLockTooltip,
            onPressed:
                controller.settings == null ||
                    !desktopOpen ||
                    !desktopControlsEnabled
                ? null
                : () => unawaited(controller.toggleDesktopLyricsLocked()),
            child: LegacyDockIcon(
              glyph: desktopLocked
                  ? LegacyDockGlyph.lock
                  : LegacyDockGlyph.unlock,
              size: 14,
              color: _toolColor(
                active: desktopOpen && desktopLocked,
                enabled: controller.settings != null && desktopOpen,
              ),
            ),
          ),
          const SizedBox(width: 10),
          _DockVolumeControl(
            palette: widget.palette,
            settingsReady: controller.settings != null,
            volume: widget.volume,
            muted: controller.isEffectivelyMuted,
            compact: false,
            onToggleMute: () => unawaited(controller.toggleMute()),
            onChanged: (value) => controller.setVolume(value / 100),
          ),
        ],
      ),
    );
  }

  Future<void> _showQualityMenu() async {
    if (_qualityController.isOpen) {
      return;
    }
    await _qualityController.showFlyout<void>(
      barrierColor: Colors.transparent,
      dismissOnPointerMoveAway: true,
      autoModeConfiguration: FlyoutAutoConfiguration(
        preferredMode: FlyoutPlacementMode.topRight,
      ),
      builder: (menuContext) => FlyoutContent(
        useAcrylic: false,
        elevation: 10,
        padding: const EdgeInsets.all(6),
        constraints: const BoxConstraints(minWidth: 140, maxWidth: 140),
        color: widget.palette.cardBackground,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: widget.palette.borderColor),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            DockFlyoutActionButton(
              palette: widget.palette,
              label: '无损',
              onPressed: () => _setQualityPreference(menuContext, 'flac'),
            ),
            DockFlyoutActionButton(
              palette: widget.palette,
              label: 'HQ',
              onPressed: () => _setQualityPreference(menuContext, '320'),
            ),
            DockFlyoutActionButton(
              palette: widget.palette,
              label: '标准',
              onPressed: () => _setQualityPreference(menuContext, '128'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _setQualityPreference(
    BuildContext menuContext,
    String value,
  ) async {
    Navigator.of(menuContext).pop();
    await Future<void>.delayed(Duration.zero);
    if (!mounted) {
      return;
    }
    setState(() {
      _qualityPreference = value;
    });
  }

  Future<void> _toggleQuickThemeMode(AppController controller) async {
    final current = controller.settings;
    if (current == null) return;
    final nextMode = current.appThemeMode == 'light' ? 'dark' : 'light';
    await controller.saveThemeModeQuietly(nextMode);
  }

  String _qualityLabel(String value) {
    return switch (value) {
      'flac' => '无损',
      '320' => 'HQ',
      _ => '标准',
    };
  }

  IconData _quickThemeIcon(String mode) {
    return switch (mode) {
      'light' => FluentIcons.sunny,
      _ => FluentIcons.clear_night,
    };
  }

  String _quickThemeTooltip(String mode) {
    final label = switch (mode) {
      'light' => '浅色',
      _ => '暗色',
    };
    return '界面模式：$label（点击切换）';
  }

  Color _toolColor({required bool active, required bool enabled}) {
    final base = active
        ? widget.palette.accent.normal
        : widget.palette.mutedForeground;
    return enabled ? base : base.withValues(alpha: 0.42);
  }
}

class _DockVolumeControl extends StatelessWidget {
  const _DockVolumeControl({
    required this.palette,
    required this.settingsReady,
    required this.volume,
    required this.muted,
    required this.compact,
    required this.onToggleMute,
    required this.onChanged,
  });

  final AppPalette palette;
  final bool settingsReady;
  final double volume;
  final bool muted;
  final bool compact;
  final VoidCallback onToggleMute;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final glyph = muted
        ? LegacyDockGlyph.volumeMute
        : volume < 45
        ? LegacyDockGlyph.volumeSmall
        : LegacyDockGlyph.volumeLoud;
    final iconColor = !settingsReady
        ? palette.mutedForeground.withValues(alpha: 0.42)
        : muted
        ? palette.accent.normal
        : palette.mutedForeground;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        DockIconButton(
          palette: palette,
          active: muted,
          tooltip: '音量',
          onPressed: settingsReady ? onToggleMute : null,
          child: LegacyDockIcon(glyph: glyph, size: 16, color: iconColor),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: compact ? 84 : 112,
          child: Slider(
            value: volume,
            max: 100,
            onChanged: settingsReady ? onChanged : null,
          ),
        ),
      ],
    );
  }
}
