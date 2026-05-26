// Import page restores the legacy three-step flow while routing all actions through the existing bridge-backed controller.

import 'dart:io';

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/pages/import/import_export.dart';
import 'package:cloudplayer_flutter/pages/import/import_kugou_panel.dart';
import 'package:cloudplayer_flutter/pages/import/import_page_widgets.dart';
import 'package:cloudplayer_flutter/pages/import/import_result_table.dart';
import 'package:cloudplayer_flutter/services/platform_file_service.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/child_window_dialog.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

enum _ImportStage { choose, config, result }

class ImportPage extends StatefulWidget {
  const ImportPage({super.key, required this.palette});

  final AppPalette palette;

  @override
  State<ImportPage> createState() => _ImportPageState();
}

class _ImportPageState extends State<ImportPage> {
  late final TextEditingController _shareController;
  late final TextEditingController _textController;
  late final TextEditingController _playlistNameController;
  late final TextEditingController _shareCookieController;
  _ImportStage _stage = _ImportStage.choose;
  String _textFormat = 'auto';
  String _lastSuggestedName = '';
  bool _shareSettingsLoaded = false;
  bool _shareCookieEnabled = false;
  int? _mergePlaylistId;

  @override
  void initState() {
    super.initState();
    _shareController = TextEditingController();
    _textController = TextEditingController();
    _playlistNameController = TextEditingController();
    _shareCookieController = TextEditingController();
  }

  @override
  void dispose() {
    _shareController.dispose();
    _textController.dispose();
    _playlistNameController.dispose();
    _shareCookieController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<AppController>();
    final settings = controller.settings;
    _syncDraftControllers(controller, settings);
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Text(
            '导入歌单',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          const Text('先选择导入方式，再填写对应参数。完成后可以先保存歌单，避免列表丢失。'),
          const SizedBox(height: 18),
          ImportProgress(activeIndex: _stage.index + 1),
          const SizedBox(height: 18),
          switch (_stage) {
            _ImportStage.choose => _buildChooseStage(controller),
            _ImportStage.config => _buildConfigStage(controller, settings),
            _ImportStage.result => _buildResultStage(controller),
          },
        ],
      ),
    );
  }

  void _syncDraftControllers(AppController controller, AppSettings? settings) {
    final suggestedName = controller.importSuggestedName.trim();
    final shouldReplaceName =
        suggestedName.isNotEmpty &&
        (_playlistNameController.text.trim().isEmpty ||
            _playlistNameController.text.trim() == _lastSuggestedName);
    if (shouldReplaceName) {
      _playlistNameController.text = suggestedName;
      _lastSuggestedName = suggestedName;
    }
    if (!_shareSettingsLoaded && settings != null) {
      _shareCookieController.text = settings.shareNeteaseCookie;
      _shareCookieEnabled = settings.shareNeteaseCookieEnabled;
      _shareSettingsLoaded = true;
    }
  }

  Widget _buildChooseStage(AppController controller) {
    return ImportCard(
      palette: widget.palette,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Text('步骤 1', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          const Text(
            '选择导入方式',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          const Text('你可以从本地目录扫描、解析分享链接、同步酷狗歌单，或者直接粘贴文本列表。'),
          const SizedBox(height: 18),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: <Widget>[
              ImportMethodCard(
                palette: widget.palette,
                title: '导入本地目录',
                desc: '扫描一个音乐文件夹，把结果带入歌单草稿。',
                onPressed: () => _selectMethod(controller, 'local'),
              ),
              ImportMethodCard(
                palette: widget.palette,
                title: '分享链接导入',
                desc: '支持网易云和 QQ 音乐歌单分享链接。',
                onPressed: () => _selectMethod(controller, 'share'),
              ),
              ImportMethodCard(
                palette: widget.palette,
                title: '导入酷狗歌单',
                desc: '登录酷狗概念版后，可勾选一个或多个歌单直接导入。',
                onPressed: () => _selectMethod(controller, 'kugou'),
              ),
              ImportMethodCard(
                palette: widget.palette,
                title: '粘贴文本导入',
                desc: '适合从聊天记录、TXT、CSV 或 JSON 中整理歌单。',
                onPressed: () => _selectMethod(controller, 'text'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildConfigStage(AppController controller, AppSettings? settings) {
    final (title, description) = switch (controller.selectedImportMethod) {
      'local' => ('配置导入参数', '扫描本地目录并把识别到的歌曲带入保存步骤。'),
      'share' => ('配置导入参数', '填写分享链接，解析完成后会进入保存步骤。'),
      'kugou' => ('导入酷狗歌单', '登录酷狗概念版后勾选要同步的歌单，导入结果会统一进入保存步骤。'),
      _ => ('配置导入参数', '填写文本内容并解析，解析完成后会进入保存步骤。'),
    };
    return ImportCard(
      palette: widget.palette,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: ConfigHeader(title: title, description: description),
              ),
              Button(
                onPressed: () => setState(() => _stage = _ImportStage.choose),
                child: const Text('上一步'),
              ),
            ],
          ),
          const SizedBox(height: 18),
          switch (controller.selectedImportMethod) {
            'local' => _buildLocalConfig(controller),
            'share' => _buildShareConfig(controller, settings),
            'kugou' => ImportKugouPanel(
              palette: widget.palette,
              api: controller.api,
              onImportRequested: (listIds) async {
                await controller.importKugouPlaylists(listIds);
                if (!mounted) return;
                setState(() => _stage = _ImportStage.result);
              },
            ),
            _ => _buildTextConfig(controller),
          },
        ],
      ),
    );
  }

  Widget _buildLocalConfig(AppController controller) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const Text(
          '选择本地音乐目录',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        const Text('扫描完成后会把歌曲标题、歌手和文件路径整理到导入草稿。'),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: () => _runGuarded(() async {
            await controller.importFromFolder();
            if (controller.importTracks.isNotEmpty && mounted) {
              setState(() => _stage = _ImportStage.result);
            }
          }),
          child: const Text('选择文件夹并扫描'),
        ),
      ],
    );
  }

  Widget _buildShareConfig(AppController controller, AppSettings? settings) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const Text(
          '粘贴歌单分享链接',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        Row(
          children: <Widget>[
            Expanded(
              child: TextBox(
                controller: _shareController,
                placeholder: 'music.163.com / y.qq.com / c6.y.qq.com …',
              ),
            ),
            const SizedBox(width: 10),
            FilledButton(
              onPressed: () => _runGuarded(() async {
                await _saveShareSettings(controller, settings);
                await controller.importFromShareUrl(_shareController.text);
                if (!mounted) return;
                setState(() => _stage = _ImportStage.result);
              }),
              child: const Text('解析链接'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ToggleSwitch(
          checked: _shareCookieEnabled,
          content: const Text('网易云 Cookie 登录态请求（可选）'),
          onChanged: (value) => setState(() => _shareCookieEnabled = value),
        ),
        const SizedBox(height: 8),
        TextBox(
          controller: _shareCookieController,
          placeholder: 'MUSIC_U=...; __csrf=...（仅本机保存到 settings.json）',
        ),
      ],
    );
  }

  Widget _buildTextConfig(AppController controller) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const Text(
          '粘贴文本列表',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        Row(
          children: <Widget>[
            const Text('格式'),
            const SizedBox(width: 10),
            ComboBox<String>(
              value: _textFormat,
              items: const <ComboBoxItem<String>>[
                ComboBoxItem(value: 'auto', child: Text('自动检测')),
                ComboBoxItem(value: 'text', child: Text('纯文本')),
                ComboBoxItem(value: 'csv', child: Text('CSV')),
                ComboBoxItem(value: 'json', child: Text('JSON')),
              ],
              onChanged: (value) {
                if (value == null) return;
                setState(() => _textFormat = value);
              },
            ),
            const SizedBox(width: 10),
            FilledButton(
              onPressed: () => _runGuarded(() async {
                await controller.parseImportText(
                  _textController.text,
                  _textFormat,
                );
                if (!mounted) return;
                setState(() => _stage = _ImportStage.result);
              }),
              child: const Text('解析文本'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        TextBox(
          controller: _textController,
          maxLines: 10,
          placeholder: '示例：\n晴天 - 周杰伦\n七里香 - 周杰伦',
        ),
      ],
    );
  }

  Widget _buildResultStage(AppController controller) {
    final playlistItems = controller.playlists
        .map(
          (playlist) =>
              ComboBoxItem<int>(value: playlist.id, child: Text(playlist.name)),
        )
        .toList();
    final canMerge =
        _mergePlaylistId != null && controller.importTracks.isNotEmpty;
    return ImportCard(
      palette: widget.palette,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              const Expanded(child: ResultHeader()),
              Button(
                onPressed: () => setState(() => _stage = _ImportStage.config),
                child: const Text('上一步'),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: <Widget>[
              Expanded(
                child: TextBox(
                  controller: _playlistNameController,
                  placeholder: '例如：深夜循环 / 通勤歌单',
                ),
              ),
              const SizedBox(width: 10),
              Button(
                onPressed: controller.importTracks.isEmpty
                    ? null
                    : () => _runGuarded(
                        () =>
                            _exportImportTracks(controller.importTracks, 'txt'),
                      ),
                child: const Text('导出为 TXT'),
              ),
              const SizedBox(width: 8),
              Button(
                onPressed: controller.importTracks.isEmpty
                    ? null
                    : () => _runGuarded(
                        () =>
                            _exportImportTracks(controller.importTracks, 'csv'),
                      ),
                child: const Text('导出为 CSV'),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: controller.importTracks.isEmpty
                    ? null
                    : () => _runGuarded(
                        () => controller.saveImportAsNewPlaylist(
                          _playlistNameController.text,
                        ),
                      ),
                child: const Text('保存新歌单'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: <Widget>[
              const Text('合并到已有歌单'),
              const SizedBox(width: 10),
              Expanded(
                child: ComboBox<int>(
                  value: _mergePlaylistId,
                  isExpanded: true,
                  placeholder: const Text('选择歌单'),
                  items: playlistItems,
                  onChanged: (value) =>
                      setState(() => _mergePlaylistId = value),
                ),
              ),
              const SizedBox(width: 10),
              Button(
                onPressed: canMerge
                    ? () => _runGuarded(
                        () => controller.mergeImportIntoPlaylist(
                          _mergePlaylistId!,
                        ),
                      )
                    : null,
                child: const Text('合并'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '导入完成后会自动打开歌单详情页，你可以继续对歌单重命名。',
            style: TextStyle(color: widget.palette.mutedForeground),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 420,
            child: ImportResultTable(
              tracks: controller.importTracks,
              palette: widget.palette,
              onPlay: (track, index) => controller.playTrack(
                track,
                queue: controller.importTracks,
                index: index,
              ),
              emptyText: '导入完成后会自动打开歌单详情页，你可以继续对歌单重命名。',
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _saveShareSettings(
    AppController controller,
    AppSettings? settings,
  ) async {
    if (settings == null) return;
    final next = settings.copyWith(
      shareNeteaseCookieEnabled: _shareCookieEnabled,
      shareNeteaseCookie: _shareCookieController.text.trim(),
    );
    if (next.shareNeteaseCookieEnabled == settings.shareNeteaseCookieEnabled &&
        next.shareNeteaseCookie == settings.shareNeteaseCookie) {
      return;
    }
    await controller.updateSettings(next);
    controller.clearStatus();
  }

  Future<void> _exportImportTracks(List<TrackRow> tracks, String format) async {
    final baseName = _playlistNameController.text.trim().isEmpty
        ? '导入歌单'
        : _playlistNameController.text.trim();
    final exportTarget = await selectExportPath(
      suggestedName: '$baseName.$format',
    );
    if (exportTarget == null) {
      return;
    }
    final content = switch (format) {
      'csv' => buildImportCsvExport(tracks),
      _ => buildImportTextExport(tracks),
    };
    await File(exportTarget.path).writeAsString(content);
    if (!mounted || !exportTarget.usedFallbackPath) {
      return;
    }
    await showChildMessageDialog(
      context: context,
      palette: widget.palette,
      title: '导出完成',
      message: 'Android 暂不支持系统另存为，文件已导出到：\n${exportTarget.path}',
    );
  }

  void _selectMethod(AppController controller, String method) {
    controller.setImportMethod(method);
    setState(() => _stage = _ImportStage.config);
  }

  Future<void> _runGuarded(Future<void> Function() action) async {
    try {
      await action();
    } catch (error) {
      if (!mounted) return;
      await showChildMessageDialog(
        context: context,
        palette: widget.palette,
        title: '操作失败',
        message: error.toString(),
      );
    }
  }
}
