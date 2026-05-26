// Search page restores the legacy home/results split, while keeping search actions wired to the shared controller.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/pages/search/search_quick_cards.dart';
import 'package:cloudplayer_flutter/pages/search/search_results_loading.dart';
import 'package:cloudplayer_flutter/pages/search/search_widgets.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/utils/platform_environment.dart';
import 'package:cloudplayer_flutter/widgets/legacy_action_button.dart';
import 'package:cloudplayer_flutter/widgets/track_list.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

class SearchPage extends StatefulWidget {
  const SearchPage({super.key, required this.palette});

  final AppPalette palette;

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  late final TextEditingController _controller;
  late List<SearchQuickCard> _quickCards;
  late String _shuffleSeed;
  bool _didSyncInitialKeyword = false;
  String _pendingQuery = '';

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
    _quickCards = pickSearchQuickCards();
    _shuffleSeed = pickSearchShuffleSeed();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_didSyncInitialKeyword) {
      return;
    }
    final app = context.read<AppController>();
    if (app.searchKeyword.isNotEmpty) {
      _controller.text = app.searchKeyword;
    }
    _didSyncInitialKeyword = true;
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppController>();
    final query = _pendingQuery.isNotEmpty
        ? _pendingQuery
        : app.searchKeyword.trim();
    final results = app.searchResponse?.results ?? const <TrackRow>[];
    final showResults = query.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Expanded(
          child: showResults
              ? _buildResultsView(app, results)
              : _buildHomeView(app),
        ),
      ],
    );
  }

  Widget _buildHomeView(AppController app) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 22),
            decoration: BoxDecoration(
              gradient: widget.palette.brightness == Brightness.light
                  ? const LinearGradient(
                      colors: <Color>[Color(0xFFFFFFFF), Color(0xFFF7F7F7)],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    )
                  : const LinearGradient(
                      colors: <Color>[Color(0xFF24272E), Color(0xFF181A20)],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    ),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: widget.palette.brightness == Brightness.light
                    ? const Color(0xFFF0F0F0)
                    : widget.palette.borderColor,
              ),
              boxShadow: <BoxShadow>[
                BoxShadow(
                  color: Colors.black.withValues(
                    alpha: widget.palette.brightness == Brightness.light
                        ? 0.07
                        : 0.22,
                  ),
                  blurRadius: 40,
                  offset: const Offset(0, 18),
                ),
              ],
            ),
            child: SizedBox(
              width: 520,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  SearchInputBar(
                    controller: _controller,
                    palette: widget.palette,
                    onSubmit: () => _submitSearch(app, _controller.text),
                  ),
                  const SizedBox(height: 12),
                  SearchScopeSwitch(
                    palette: widget.palette,
                    scope: app.searchScope,
                    onChanged: (scope) => _setScope(app, scope),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            '快速搜索',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          SearchQuickGrid(
            palette: widget.palette,
            cards: _quickCards,
            shuffleSeed: _shuffleSeed,
            onSearchSeed: (seed) => _submitSearch(app, seed),
          ),
        ],
      ),
    );
  }

  Widget _buildResultsView(AppController app, List<TrackRow> results) {
    final playlistMatches = app.playlistSearchResults;
    final loading =
        app.busy ||
        (_pendingQuery.isNotEmpty && app.searchKeyword.trim() != _pendingQuery);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        if (isMobileHost) ...<Widget>[
          SizedBox(
            height: 40,
            child: Row(
              children: <Widget>[
                Button(
                  onPressed: () => _clearSearch(app),
                  style: ButtonStyle(
                    padding: WidgetStateProperty.all(
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    ),
                    backgroundColor: WidgetStateProperty.resolveWith((states) {
                      if (states.isHovered || states.isPressed) {
                        return widget.palette.subtleBackground;
                      }
                      return Colors.transparent;
                    }),
                    shape: WidgetStateProperty.all(
                      RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const <Widget>[
                      Icon(FluentIcons.chevron_left, size: 12),
                      SizedBox(width: 4),
                      Text(
                        '返回',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  SearchInputBar(
                    controller: _controller,
                    palette: widget.palette,
                    placeholder: '继续搜索歌曲、歌手、专辑，或搜索你的本地歌单…',
                    onSubmit: () => _submitSearch(app, _controller.text),
                  ),
                  const SizedBox(height: 12),
                  SearchScopeSwitch(
                    palette: widget.palette,
                    scope: app.searchScope,
                    onChanged: (scope) => _setScope(app, scope),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 18),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: <Widget>[
                    LegacyActionButton(
                      palette: widget.palette,
                      accent: true,
                      showPlayGlyph: true,
                      onPressed: results.isEmpty
                          ? null
                          : () => app.playTrack(
                              results.first,
                              queue: results,
                              index: 0,
                            ),
                      label: '播放全部',
                    ),
                    LegacyActionButton(
                      palette: widget.palette,
                      onPressed: null,
                      label: '批量操作',
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 16),
        Expanded(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            switchInCurve: const Cubic(0.22, 1, 0.36, 1),
            switchOutCurve: Curves.easeOut,
            transitionBuilder: (child, animation) {
              return FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0, 0.04),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              );
            },
            child: loading
                ? SearchResultsLoadingPanel(
                    key: ValueKey<String>('loading-${app.searchScope.name}'),
                    palette: widget.palette,
                    showTableHeader: app.searchScope == SearchScope.catalog,
                  )
                : app.searchScope == SearchScope.playlists
                ? PlaylistSearchResults(
                    key: const ValueKey<String>('playlist-results'),
                    palette: widget.palette,
                    playlists: playlistMatches,
                  )
                : Column(
                    key: const ValueKey<String>('catalog-results'),
                    children: <Widget>[
                      Expanded(
                        child: TrackListView(
                          tracks: results,
                          palette: widget.palette,
                          favoriteIds: app.favoriteIds,
                          onPlay: (track, index) => app.playTrack(
                            track,
                            queue: results,
                            index: index,
                          ),
                          onToggleFavorite: app.toggleFavorite,
                          onDownload: app.enqueueDownload,
                          currentTrack: app.currentTrack,
                          currentTrackPlaying: app.isPlaying,
                          showIndex: true,
                          showFavoriteAction: false,
                          showDownloadAction: false,
                          onArtistSearch: (keyword) =>
                              app.triggerTrackSearch(keyword),
                          onAlbumSearch: (keyword) =>
                              app.triggerTrackSearch(keyword),
                          emptyText: '输入关键词后开始搜索。',
                        ),
                      ),
                      if (results.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: Align(
                            alignment: Alignment.centerRight,
                            child: Text(
                              _catalogStatusText(app.searchResponse),
                              style: TextStyle(
                                fontSize: 12,
                                color: widget.palette.mutedForeground,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  Future<void> _submitSearch(AppController app, String keyword) async {
    final trimmed = keyword.trim();
    _controller.text = trimmed;
    if (trimmed.isEmpty) {
      setState(() {
        _pendingQuery = '';
      });
      await app.performSearch('');
      return;
    }
    setState(() {
      _pendingQuery = trimmed;
    });
    await Future<void>.delayed(Duration.zero);
    await WidgetsBinding.instance.endOfFrame;
    await app.performSearch(trimmed);
    if (!mounted) return;
    setState(() {
      _pendingQuery = '';
      _quickCards = pickSearchQuickCards();
      _shuffleSeed = pickSearchShuffleSeed();
    });
  }

  Future<void> _setScope(AppController app, SearchScope scope) async {
    app.setSearchScope(scope);
    final keyword = _controller.text.trim().isNotEmpty
        ? _controller.text.trim()
        : app.searchKeyword;
    if (keyword.isNotEmpty) {
      await app.performSearch(keyword);
    } else {
      setState(() {});
    }
  }

  Future<void> _clearSearch(AppController app) async {
    _controller.clear();
    setState(() {
      _pendingQuery = '';
    });
    await app.performSearch('');
  }

  String _catalogStatusText(SearchCatalogResponse? response) {
    if (response == null) return '';
    return '共 ${response.results.length} 条';
  }
}
