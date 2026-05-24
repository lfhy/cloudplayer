// Search page restores the legacy home/results split, while keeping search actions wired to the shared controller.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/pages/search/search_quick_cards.dart';
import 'package:cloudplayer_flutter/pages/search/search_widgets.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
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
  Widget build(BuildContext context) {
    final app = context.watch<AppController>();
    if (_controller.text.isEmpty && app.searchKeyword.isNotEmpty) {
      _controller.text = app.searchKeyword;
    }
    final query = app.searchKeyword.trim();
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
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
          child: app.busy
              ? const Center(child: ProgressRing())
              : app.searchScope == SearchScope.playlists
              ? PlaylistSearchResults(
                  palette: widget.palette,
                  playlists: playlistMatches,
                )
              : Column(
                  children: <Widget>[
                    Expanded(
                      child: TrackListView(
                        tracks: results,
                        palette: widget.palette,
                        favoriteIds: app.favoriteIds,
                        onPlay: (track, index) =>
                            app.playTrack(track, queue: results, index: index),
                        onToggleFavorite: app.toggleFavorite,
                        onDownload: app.enqueueDownload,
                        currentTrack: app.currentTrack,
                        currentTrackPlaying: app.isPlaying,
                        showIndex: true,
                        showFavoriteAction: false,
                        showDownloadAction: false,
                        onArtistSearch: (keyword) => app.triggerTrackSearch(keyword),
                        onAlbumSearch: (keyword) => app.triggerTrackSearch(keyword),
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
      ],
    );
  }

  Future<void> _submitSearch(AppController app, String keyword) async {
    _controller.text = keyword.trim();
    await app.performSearch(keyword);
    if (!mounted) return;
    setState(() {
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

  String _catalogStatusText(SearchCatalogResponse? response) {
    if (response == null) return '';
    return '共 ${response.results.length} 条';
  }
}
