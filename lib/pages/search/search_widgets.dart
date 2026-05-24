// Search widgets keep the page file small while matching the legacy hero, scope chips, and local-playlist cards.

import 'package:cloudplayer_flutter/models/app_models.dart';
import 'package:cloudplayer_flutter/pages/search/search_quick_cards.dart';
import 'package:cloudplayer_flutter/state/app_controller.dart';
import 'package:cloudplayer_flutter/theme/app_theme.dart';
import 'package:cloudplayer_flutter/widgets/track_artwork.dart';
import 'package:fluent_ui/fluent_ui.dart';
import 'package:provider/provider.dart';

class SearchInputBar extends StatelessWidget {
  const SearchInputBar({
    super.key,
    required this.controller,
    required this.palette,
    required this.onSubmit,
    this.placeholder = '搜索歌曲、歌手、专辑，或搜索你的本地歌单…',
  });

  final TextEditingController controller;
  final AppPalette palette;
  final VoidCallback onSubmit;
  final String placeholder;

  @override
  Widget build(BuildContext context) {
    final edgeColors = palette.brightness == Brightness.light
        ? const <Color>[
            Color(0x9C5CE6F0),
            Color(0x9CF05CD2),
            Color(0x9CFFD764),
          ]
        : const <Color>[
            Color(0xCC5CE6F0),
            Color(0xCCF05CD2),
            Color(0xCCFFD764),
          ];
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        gradient: LinearGradient(colors: edgeColors),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: palette.brightness == Brightness.light
                ? const Color(0x125CE6F0)
                : const Color(0x305CE6F0),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: TextBox(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(14, 8, 6, 8),
        placeholder: placeholder,
        unfocusedColor: Colors.transparent,
        decoration: WidgetStatePropertyAll<BoxDecoration>(
          BoxDecoration(
            color: palette.brightness == Brightness.light
                ? Colors.white.withValues(alpha: 0.94)
                : const Color(0xFF16181D).withValues(alpha: 0.94),
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        onSubmitted: (_) => onSubmit(),
        suffix: SizedBox(
          width: 34,
          height: 34,
          child: Button(
            onPressed: onSubmit,
            style: ButtonStyle(
              padding: WidgetStateProperty.all(EdgeInsets.zero),
              backgroundColor: WidgetStateProperty.resolveWith(
                (states) => states.isHovered
                    ? palette.subtleBackground
                    : Colors.transparent,
              ),
              foregroundColor: WidgetStatePropertyAll<Color>(
                palette.mutedForeground,
              ),
              shape: WidgetStateProperty.all(
                RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            child: const Icon(FluentIcons.search, size: 14),
          ),
        ),
      ),
    );
  }
}

class SearchScopeSwitch extends StatelessWidget {
  const SearchScopeSwitch({
    super.key,
    required this.palette,
    required this.scope,
    required this.onChanged,
  });

  final AppPalette palette;
  final SearchScope scope;
  final ValueChanged<SearchScope> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: palette.subtleBackground,
        borderRadius: BorderRadius.circular(999),
        boxShadow: palette.brightness == Brightness.light
            ? <BoxShadow>[
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          _SearchScopeChip(
            palette: palette,
            label: '音乐资源',
            active: scope == SearchScope.catalog,
            onPressed: () => onChanged(SearchScope.catalog),
          ),
          _SearchScopeChip(
            palette: palette,
            label: '本地歌单',
            active: scope == SearchScope.playlists,
            onPressed: () => onChanged(SearchScope.playlists),
          ),
        ],
      ),
    );
  }
}

class SearchQuickGrid extends StatelessWidget {
  const SearchQuickGrid({
    super.key,
    required this.palette,
    required this.cards,
    required this.shuffleSeed,
    required this.onSearchSeed,
  });

  final AppPalette palette;
  final List<SearchQuickCard> cards;
  final String shuffleSeed;
  final ValueChanged<String> onSearchSeed;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 220,
        mainAxisExtent: 148,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
      ),
      itemCount: cards.length + 1,
      itemBuilder: (context, index) {
        if (index < cards.length) {
          final card = cards[index];
          return _QuickCardButton(
            palette: palette,
            kicker: card.kicker,
            title: card.title,
            text: card.text,
            onPressed: () => onSearchSeed(card.seed),
          );
        }
        return _QuickCardButton(
          palette: palette,
          kicker: 'Shuffle',
          title: '随便听听',
          text: '本次随机关键词：$shuffleSeed',
          onPressed: () => onSearchSeed(shuffleSeed),
        );
      },
    );
  }
}

class PlaylistSearchResults extends StatelessWidget {
  const PlaylistSearchResults({
    super.key,
    required this.palette,
    required this.playlists,
  });

  final AppPalette palette;
  final List<PlaylistSearchResult> playlists;

  @override
  Widget build(BuildContext context) {
    final controller = context.read<AppController>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            const Text(
              '本地歌单',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            const Spacer(),
            Text(
              '找到 ${playlists.length} 张相关歌单',
              style: TextStyle(color: palette.mutedForeground),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (playlists.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Text(
              '没有找到匹配的本地歌单或导入曲目。',
              style: TextStyle(color: palette.mutedForeground),
            ),
          )
        else
          Expanded(
            child: ListView.separated(
              itemCount: playlists.length,
              separatorBuilder: (_, index) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final result = playlists[index];
                return HoverButton(
                  onPressed: () => controller.selectPlaylist(result.playlist),
                  builder: (context, states) {
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: states.isHovered
                            ? palette.subtleBackground
                            : palette.brightness == Brightness.light
                            ? Colors.white.withValues(alpha: 0.78)
                            : const Color(0xE01C1E24),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: states.isHovered
                              ? palette.accent.normal.withValues(alpha: 0.24)
                              : palette.borderColor,
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          SizedBox(
                            width: 64,
                            height: 64,
                            child: TrackArtwork(
                              track: result.coverTrack,
                              palette: palette,
                              size: 64,
                              radius: 14,
                              iconSize: 20,
                              placeholderIcon: result.playlist.isFavorites
                                  ? FluentIcons.heart_fill
                                  : result.playlist.isCloud
                                  ? FluentIcons.cloud
                                  : FluentIcons.music_note,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(
                                  result.playlist.name,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${result.trackCount} 首歌曲${result.matchedTracks.isEmpty ? '' : ' · 命中 ${result.matchedTracks.length} 首'}',
                                  style: TextStyle(color: palette.mutedForeground),
                                ),
                                const SizedBox(height: 6),
                                if (result.matchedTracks.isEmpty)
                                  Text(
                                    '歌单名称命中',
                                    style: TextStyle(
                                      color: palette.mutedForeground,
                                      fontStyle: FontStyle.italic,
                                    ),
                                  )
                                else
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: result.matchedTracks
                                        .take(3)
                                        .map(
                                          (track) => Padding(
                                            padding: const EdgeInsets.only(top: 2),
                                            child: Text(
                                              '• ${track.title}${track.artist.trim().isEmpty ? '' : ' · ${track.artist}'}',
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: palette.mutedForeground,
                                              ),
                                            ),
                                          ),
                                        )
                                        .toList(growable: false),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
      ],
    );
  }
}

class _SearchScopeChip extends StatelessWidget {
  const _SearchScopeChip({
    required this.palette,
    required this.label,
    required this.active,
    required this.onPressed,
  });

  final AppPalette palette;
  final String label;
  final bool active;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Button(
      onPressed: onPressed,
      style: ButtonStyle(
        padding: WidgetStateProperty.all(
          const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        ),
        backgroundColor: WidgetStateProperty.resolveWith(
          (_) => active ? palette.cardBackground : Colors.transparent,
        ),
        foregroundColor: WidgetStateProperty.resolveWith(
          (_) => active ? palette.accent.normal : palette.mutedForeground,
        ),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
      ),
      child: Text(label),
    );
  }
}

class _QuickCardButton extends StatelessWidget {
  const _QuickCardButton({
    required this.palette,
    required this.kicker,
    required this.title,
    required this.text,
    required this.onPressed,
  });

  final AppPalette palette;
  final String kicker;
  final String title;
  final String text;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return HoverButton(
      onPressed: onPressed,
      builder: (context, states) {
        return Container(
          constraints: const BoxConstraints(minHeight: 148),
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: states.isHovered
                  ? palette.accent.normal.withValues(alpha: 0.28)
                  : palette.borderColor,
            ),
            gradient: RadialGradient(
              center: const Alignment(0.92, -0.92),
              radius: 1.2,
              colors: <Color>[
                palette.accent.normal.withValues(alpha: 0.14),
                Colors.transparent,
              ],
            ),
            color: palette.brightness == Brightness.light
                ? const Color(0xFFF7F7F7)
                : const Color(0xF01F2228),
            boxShadow: states.isHovered
                ? <BoxShadow>[
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 24,
                      offset: const Offset(0, 12),
                    ),
                  ]
                : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                kicker,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: palette.accent.normal,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                title,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: Text(
                  text,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
