// Kugou import panel restores the legacy QR/SMS login flow and multi-playlist import inside the Flutter import page.

import 'dart:async';
import 'dart:convert';

import 'package:cloudplayer_flutter/bridge/cloudplayer_api.dart';
import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/pages/import/import_kugou_widgets.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/child_window_dialog.dart';
import 'package:flutter/services.dart';
import 'package:fluent_ui/fluent_ui.dart';

class ImportKugouPanel extends StatefulWidget {
  const ImportKugouPanel({
    super.key,
    required this.palette,
    required this.api,
    required this.onImportRequested,
  });

  final AppPalette palette;
  final CloudPlayerApi api;
  final Future<void> Function(List<int> listIds) onImportRequested;

  @override
  State<ImportKugouPanel> createState() => _ImportKugouPanelState();
}

class _ImportKugouPanelState extends State<ImportKugouPanel> {
  late final TextEditingController _mobileController;
  late final TextEditingController _codeController;
  Timer? _pollTimer;
  String _mode = 'qr';
  String _statusText = '正在检查酷狗概念版登录状态…';
  KugouLoginStatus? _status;
  KugouLoginQRCode? _qrCode;
  List<KugouPlaylistRow> _playlists = <KugouPlaylistRow>[];
  Set<int> _selectedIds = <int>{};
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _mobileController = TextEditingController();
    _codeController = TextEditingController();
    unawaited(_refreshLoginStatus());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _mobileController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final loggedIn = _status?.loggedIn ?? false;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    '导入酷狗歌单',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                  ),
                  SizedBox(height: 6),
                  Text('登录酷狗概念版后勾选要同步的歌单，导入结果会统一进入保存步骤。'),
                ],
              ),
            ),
            if (loggedIn)
              Button(
                onPressed: _busy ? null : () => _runGuarded(_logout),
                child: const Text('退出登录'),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Text(_statusText, style: TextStyle(color: widget.palette.mutedForeground)),
        const SizedBox(height: 16),
        if (!loggedIn) ...<Widget>[
          Row(
            children: <Widget>[
              KugouModeButton(
                label: '二维码登录',
                active: _mode == 'qr',
                onPressed: () => setState(() => _mode = 'qr'),
              ),
              const SizedBox(width: 8),
              KugouModeButton(
                label: '手机验证码',
                active: _mode == 'sms',
                onPressed: () => setState(() => _mode = 'sms'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_mode == 'qr') _buildQrPanel() else _buildSmsPanel(),
          const SizedBox(height: 18),
        ],
        KugouPlaylistSection(
          palette: widget.palette,
          loggedIn: loggedIn,
          busy: _busy,
          playlists: _playlists,
          selectedIds: _selectedIds,
          onRefresh: () => _runGuarded(_refreshPlaylists),
          onSelectAll: () => setState(
            () => _selectedIds = _playlists.map((item) => item.id).toSet(),
          ),
          onClear: () => setState(() => _selectedIds.clear()),
          onToggleSelection: (id) {
            setState(() {
              if (_selectedIds.contains(id)) {
                _selectedIds.remove(id);
              } else {
                _selectedIds.add(id);
              }
            });
          },
          onImport: () => _runGuarded(_importSelected),
        ),
      ],
    );
  }

  Widget _buildQrPanel() {
    final qrBytes = _decodeQrBytes(_qrCode?.base64 ?? '');
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: widget.palette.panelBackground,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: widget.palette.borderColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 168,
            height: 168,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: qrBytes == null
                ? const Text('二维码')
                : ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.memory(qrBytes, fit: BoxFit.cover),
                  ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('使用酷狗概念版 App 扫码确认后，会自动同步登录状态。', style: TextStyle(color: widget.palette.mutedForeground)),
                const SizedBox(height: 14),
                Row(
                  children: <Widget>[
                    FilledButton(
                      onPressed: _busy ? null : () => _runGuarded(_createQrCode),
                      child: const Text('生成二维码'),
                    ),
                    const SizedBox(width: 8),
                    Button(
                      onPressed: _qrCode?.url.isEmpty != false ? null : () => _copyQrUrl(),
                      child: const Text('复制登录链接'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSmsPanel() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: widget.palette.panelBackground,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: widget.palette.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          TextBox(
            controller: _mobileController,
            placeholder: '例如：13800138000',
          ),
          const SizedBox(height: 12),
          Row(
            children: <Widget>[
              Expanded(
                child: TextBox(
                  controller: _codeController,
                  placeholder: '输入收到的短信验证码',
                ),
              ),
              const SizedBox(width: 10),
              Button(
                onPressed: _busy ? null : () => _runGuarded(_sendCaptcha),
                child: const Text('发送验证码'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _busy ? null : () => _runGuarded(_loginBySms),
            child: const Text('登录酷狗概念版'),
          ),
        ],
      ),
    );
  }

  Future<void> _refreshLoginStatus() async {
    final status = await widget.api.getKugouLoginStatus();
    setState(() {
      _status = status;
      _statusText = _statusMessage(status);
    });
    if (status.loggedIn) {
      await _refreshPlaylists();
    } else {
      setState(() {
        _playlists = <KugouPlaylistRow>[];
        _selectedIds.clear();
      });
    }
  }

  Future<void> _refreshPlaylists() async {
    final playlists = await widget.api.listKugouPlaylists();
    setState(() {
      _playlists = playlists;
      _selectedIds = _selectedIds
          .where((id) => playlists.any((item) => item.id == id))
          .toSet();
    });
  }

  Future<void> _createQrCode() async {
    _setBusy(true);
    final qrCode = await widget.api.createKugouLoginQrCode();
    if (!mounted) return;
    setState(() {
      _qrCode = qrCode;
      _statusText = '等待扫码登录…';
    });
    _setBusy(false);
    _schedulePoll(qrCode.key);
  }

  Future<void> _sendCaptcha() async {
    _setBusy(true);
    final result = await widget.api.sendKugouLoginCaptcha(_mobileController.text.trim());
    if (!mounted) return;
    setState(() => _statusText = result.message.isEmpty ? '验证码已发送。' : result.message);
    _setBusy(false);
  }

  Future<void> _loginBySms() async {
    _setBusy(true);
    final status = await widget.api.loginKugouByCellphone(
      _mobileController.text.trim(),
      _codeController.text.trim(),
    );
    if (!mounted) return;
    setState(() {
      _status = status;
      _statusText = _statusMessage(status);
    });
    _setBusy(false);
    await _refreshPlaylists();
  }

  Future<void> _logout() async {
    _pollTimer?.cancel();
    _setBusy(true);
    await widget.api.logoutKugou();
    if (!mounted) return;
    setState(() {
      _status = KugouLoginStatus(
        status: 'logged_out',
        loggedIn: false,
        userId: '',
        nickname: '',
        avatarUrl: '',
      );
      _statusText = '未登录酷狗概念版。';
      _playlists = <KugouPlaylistRow>[];
      _selectedIds.clear();
      _qrCode = null;
    });
    _setBusy(false);
  }

  Future<void> _importSelected() async {
    if (_selectedIds.isEmpty) {
      throw StateError('请先选择至少一个酷狗歌单。');
    }
    await widget.onImportRequested(_selectedIds.toList()..sort());
  }

  void _schedulePoll(String key) {
    _pollTimer?.cancel();
    _pollTimer = Timer(const Duration(milliseconds: 1800), () async {
      try {
        final status = await widget.api.pollKugouLoginQrCode(key);
        if (!mounted) return;
        setState(() {
          _status = status;
          _statusText = _statusMessage(status);
        });
        if (status.loggedIn) {
          await _refreshPlaylists();
          return;
        }
        if (status.status == 'waiting' || status.status == 'scanned') {
          _schedulePoll(key);
        }
      } catch (_) {
        if (!mounted) return;
        setState(() => _statusText = '未登录酷狗概念版。');
      }
    });
  }

  Future<void> _copyQrUrl() async {
    final data = ClipboardData(text: _qrCode?.url ?? '');
    await Clipboard.setData(data);
    if (!mounted) return;
    setState(() => _statusText = '已复制酷狗概念版登录链接。');
  }

  Uint8List? _decodeQrBytes(String raw) {
    final normalized = raw.contains(',') ? raw.split(',').last : raw;
    if (normalized.trim().isEmpty) return null;
    try {
      return base64Decode(normalized.trim());
    } catch (_) {
      return null;
    }
  }

  String _statusMessage(KugouLoginStatus status) {
    if (status.loggedIn) {
      final nickname = status.nickname.trim();
      return nickname.isEmpty ? '已登录酷狗概念版。' : '已登录 $nickname。';
    }
    if (status.status == 'scanned') {
      return '已扫码，等待确认…';
    }
    if (status.status == 'waiting') {
      return '等待扫码登录…';
    }
    return '未登录酷狗概念版。';
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
      _setBusy(false);
    }
  }

  void _setBusy(bool value) {
    if (!mounted) return;
    setState(() => _busy = value);
  }
}
