package musicsource

import (
	"strconv"
	"strings"
)

// Netease mapping helpers normalize source payloads into the shared SearchResult shape.
func neteaseSongToSearchResult(song neteaseSearchSong) (SearchResult, bool) {
	if song.ID <= 0 {
		return SearchResult{}, false
	}
	title := strings.TrimSpace(song.Name)
	if title == "" {
		return SearchResult{}, false
	}
	artist := neteaseJoinArtists(song)
	album, cover := neteaseAlbumAndCover(song)
	return SearchResult{
		SourceID:   EncodeSourceID(ProviderNetease, strconv.FormatInt(song.ID, 10)),
		Title:      title,
		Artist:     artist,
		Album:      album,
		DurationMS: maxInt64(song.DT, 0),
		CoverURL:   cover,
	}, true
}

func neteaseJoinArtists(song neteaseSearchSong) string {
	names := make([]string, 0, 4)
	for _, artist := range song.Ar {
		name := strings.TrimSpace(artist.Name)
		if name != "" {
			names = append(names, name)
		}
	}
	if len(names) == 0 {
		for _, artist := range song.Artists {
			name := strings.TrimSpace(artist.Name)
			if name != "" {
				names = append(names, name)
			}
		}
	}
	return strings.Join(names, " / ")
}

func neteaseAlbumAndCover(song neteaseSearchSong) (string, *string) {
	album := strings.TrimSpace(song.AL.Name)
	cover := strings.TrimSpace(song.AL.PicURL)
	if album == "" {
		album = strings.TrimSpace(song.Album.Name)
	}
	if cover == "" {
		cover = strings.TrimSpace(song.Album.PicURL)
	}
	if cover == "" {
		return album, nil
	}
	return album, &cover
}

func parseNeteaseRawID(rawID string) (int64, bool) {
	id, err := strconv.ParseInt(strings.TrimSpace(rawID), 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

func maxInt64(value, minValue int64) int64 {
	if value < minValue {
		return minValue
	}
	return value
}
