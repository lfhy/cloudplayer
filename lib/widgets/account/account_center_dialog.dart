// The account-center dialog owns the Kugou auth state and sidebar popup flow while delegating visual sections to smaller widgets.

import 'dart:async';
import 'dart:convert';

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/account/account_center_widgets.dart';
import 'package:cloudplayer_flutter/widgets/child_window_dialog.dart';
import 'package:flutter/services.dart';
import 'package:fluent_ui/fluent_ui.dart';

Future<void> showAccountCenterDialog({
  required BuildContext context,
  required AppPalette palette,
  required AppController controller,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _AccountCenterDialog(
      palette: palette,
      controller: controller,
    ),
  );
}

class _AccountCenterDialog extends StatefulWidget {
  const _AccountCenterDialog({
    required this.palette,
    required this.controller,
  });

  final AppPalette palette;
  final AppController controller;

  @override
  State<_AccountCenterDialog> createState() => _AccountCenterDialogState();
}

class _AccountCenterDialogState extends State<_AccountCenterDialog> {
  late final TextEditingController _mobileController;
  late final TextEditingController _codeController;
  Timer? _pollTimer;
  String _mode = 'sms';
  String _statusText = '正在同步登录状态…';
  KugouLoginStatus? _status;
  KugouLoginQRCode? _qrCode;
  bool _busy = false;

  bool get _loggedIn => _status?.loggedIn ?? false;
  String get _currentMode =>
      widget.controller.settings?.musicCollectionMode ?? 'offline';

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
    return ChildWindowDialog(
      palette: widget.palette,
      title: '登录账号',
      width: 584,
      body: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          AccountProviderTabs(palette: widget.palette),
          const SizedBox(height: 14),
          AccountCenterPanel(
            palette: widget.palette,
            statusText: _statusText,
            loggedIn: _loggedIn,
            status: _status,
            mode: _mode,
            busy: _busy,
            mobileController: _mobileController,
            codeController: _codeController,
            qrBytes: _decodeQrBytes(_qrCode?.base64 ?? ''),
            canCopyQrUrl: _qrCode?.url.isEmpty == false,
            currentMode: _currentMode,
            onSelectMode: _selectMode,
            onSendCaptcha: () => _runGuarded(_sendCaptcha),
            onLoginBySms: () => _runGuarded(_loginBySms),
            onCreateQrCode: () => _runGuarded(_createQrCode),
            onCopyQrUrl: _copyQrUrl,
            onChangeCollectionMode: (mode) {
              unawaited(_changeCollectionMode(context, mode));
            },
            onOpenImport: () => _openImportPage(context),
            onLogout: () => _runGuarded(_logout),
          ),
        ],
      ),
      footer: <Widget>[
        ChildDialogSecondaryButton(
          palette: widget.palette,
          label: '关闭',
          onPressed: () => Navigator.pop(context),
        ),
      ],
    );
  }

  void _selectMode(String nextMode) {
    setState(() => _mode = nextMode);
    if (nextMode == 'qr' && _qrCode == null) {
      unawaited(_runGuarded(_createQrCode));
    }
  }

  Future<void> _refreshLoginStatus() async {
    final status = await widget.controller.api.getKugouLoginStatus();
    if (!mounted) return;
    setState(() {
      _status = status;
      _statusText = _statusMessage(status);
    });
  }

  Future<void> _createQrCode() async {
    _setBusy(true);
    final qrCode = await widget.controller.api.createKugouLoginQrCode();
    if (!mounted) return;
    setState(() {
      _qrCode = qrCode;
      _statusText = '等待扫码登录…';
      _mode = 'qr';
    });
    _setBusy(false);
    _schedulePoll(qrCode.key);
  }

  Future<void> _sendCaptcha() async {
    _setBusy(true);
    final result = await widget.controller.api.sendKugouLoginCaptcha(
      _mobileController.text.trim(),
    );
    if (!mounted) return;
    setState(() {
      _statusText = result.message.isEmpty ? '验证码已发送。' : result.message;
    });
    _setBusy(false);
  }

  Future<void> _loginBySms() async {
    _setBusy(true);
    final status = await widget.controller.api.loginKugouByCellphone(
      _mobileController.text.trim(),
      _codeController.text.trim(),
    );
    if (!mounted) return;
    setState(() {
      _status = status;
      _statusText = _statusMessage(status);
    });
    _setBusy(false);
  }

  Future<void> _logout() async {
    _pollTimer?.cancel();
    _setBusy(true);
    await widget.controller.api.logoutKugou();
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
      _qrCode = null;
      _mode = 'sms';
    });
    _setBusy(false);
  }

  void _schedulePoll(String key) {
    _pollTimer?.cancel();
    _pollTimer = Timer(const Duration(milliseconds: 1800), () async {
      try {
        final status = await widget.controller.api.pollKugouLoginQrCode(key);
        if (!mounted) return;
        setState(() {
          _status = status;
          _statusText = _statusMessage(status);
        });
        if (status.loggedIn) {
          _pollTimer?.cancel();
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
    await Clipboard.setData(ClipboardData(text: _qrCode?.url ?? ''));
    if (!mounted) return;
    setState(() => _statusText = '已复制酷狗概念版登录链接。');
  }

  Future<void> _changeCollectionMode(
    BuildContext context,
    String nextMode,
  ) async {
    if (nextMode == _currentMode) return;
    if (nextMode == 'online') {
      final accepted = await showOnlineModeConfirmDialog(
        context: context,
        palette: widget.palette,
      );
      if (!accepted || !mounted) return;
    }
    _setBusy(true);
    try {
      await widget.controller.changeMusicCollectionMode(nextMode);
      if (!mounted) return;
      setState(() {
        _statusText = switch (nextMode) {
          'online' => '在线模式已开启，可直接同步酷狗云歌单。',
          'hybrid' => '混合模式已开启，会尽量回写酷狗云歌单。',
          _ => '已切回离线模式，只使用本地歌单。',
        };
      });
    } finally {
      _setBusy(false);
    }
  }

  Future<void> _openImportPage(BuildContext context) async {
    Navigator.pop(context);
    widget.controller.setImportMethod('kugou');
    await widget.controller.setPage(AppPage.import);
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
      return nickname.isEmpty
          ? '账号已连接，可直接同步云歌单。'
          : '已登录 $nickname，可直接同步云歌单。';
    }
    if (status.status == 'scanned') {
      return '已扫码，等待确认…';
    }
    if (status.status == 'waiting') {
      return '等待扫码登录…';
    }
    return '登录后可同步账号状态与云歌单。';
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
