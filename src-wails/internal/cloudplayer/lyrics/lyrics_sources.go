package lyrics

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"cloudplayer/internal/cloudplayer/config"
	"cloudplayer/internal/cloudplayer/pjmp3"
)

// Provider selection stays isolated here so source ordering can evolve without touching payload parsers.
func SearchCandidates(client *http.Client, settings config.Settings, keyword string, durationMS *int64, sources []string) ([]LyricCandidate, error) {
	trimmed := strings.TrimSpace(keyword)
	if trimmed == "" {
		return nil, fmt.Errorf("请输入歌词搜索关键词")
	}

	selected := normalizeSourceList(sources)
	if len(selected) == 0 {
		selected = defaultLyricSources()
	}
	if !settings.LyricsLRCLibEnabled {
		selected = removeSource(selected, "lrclib")
	}

	out := make([]LyricCandidate, 0, 32)
	for _, source := range selected {
		switch source {
		case "qq":
			hits, err := searchQqSongs(client, trimmed, 1)
			if err != nil {
				continue
			}
			for _, hit := range hits {
				mid := hit.SongMid
				dms := hit.DurationMS
				out = append(out, LyricCandidate{
					Source:     "qq",
					ID:         strconv.FormatInt(hit.SongID, 10),
					Title:      hit.Title,
					Artist:     hit.Artist,
					Album:      hit.Album,
					DurationMS: &dms,
					QQMid:      &mid,
				})
			}
		case "kugou":
			hits, err := searchKugouSongs(client, trimmed, 1)
			if err != nil {
				continue
			}
			for _, hit := range hits {
				hash := hit.FileHash
				dms := hit.DurationMS
				out = append(out, LyricCandidate{
					Source:     "kugou",
					ID:         hit.AlbumAudioID,
					Title:      hit.Title,
					Artist:     hit.Artist,
					Album:      hit.Album,
					DurationMS: &dms,
					KugouHash:  &hash,
				})
			}
		case "netease":
			hits, err := neteaseSearchHits(client, trimmed, 20)
			if err != nil {
				continue
			}
			for _, hit := range hits {
				id := hit.ID
				dms := hit.DurationMS
				out = append(out, LyricCandidate{
					Source:     "netease",
					ID:         strconv.FormatInt(hit.ID, 10),
					Title:      hit.Title,
					Artist:     hit.Artist,
					Album:      hit.Album,
					DurationMS: &dms,
					NeteaseID:  &id,
				})
			}
		case "lrclib":
			hits, err := lrclibSearchHits(client, trimmed, durationMS)
			if err != nil {
				continue
			}
			for _, hit := range hits {
				id := hit.ID
				dms := hit.DurationMS
				out = append(out, LyricCandidate{
					Source:     "lrclib",
					ID:         strconv.FormatInt(hit.ID, 10),
					Title:      hit.Title,
					Artist:     hit.Artist,
					Album:      hit.Album,
					DurationMS: &dms,
					LRCLibID:   &id,
				})
			}
		}
	}
	return out, nil
}

func FetchCandidate(client *http.Client, settings config.Settings, candidate LyricCandidate) (LyricsPayload, error) {
	switch strings.ToLower(strings.TrimSpace(candidate.Source)) {
	case "qq":
		id, err := strconv.ParseInt(strings.TrimSpace(candidate.ID), 10, 64)
		if err != nil {
			return LyricsPayload{}, fmt.Errorf("qq: bad id")
		}
		mid := ""
		if candidate.QQMid != nil {
			mid = strings.TrimSpace(*candidate.QQMid)
		}
		return fetchQqLyrics(client, qqSearchHit{
			SongID:     id,
			SongMid:    mid,
			Title:      candidate.Title,
			Artist:     candidate.Artist,
			Album:      candidate.Album,
			DurationMS: derefInt64(candidate.DurationMS),
		})
	case "kugou":
		hash := ""
		if candidate.KugouHash != nil {
			hash = strings.TrimSpace(*candidate.KugouHash)
		}
		return fetchKugouLyrics(client, kugouSearchHit{
			AlbumAudioID: strings.TrimSpace(candidate.ID),
			FileHash:     hash,
			Title:        candidate.Title,
			Artist:       candidate.Artist,
			Album:        candidate.Album,
			DurationMS:   derefInt64(candidate.DurationMS),
		})
	case "netease":
		id, ok := candidateIDInt64(candidate.ID, candidate.NeteaseID)
		if !ok {
			return LyricsPayload{}, fmt.Errorf("netease: bad id")
		}
		payload, err := fetchNeteaseLyricsBySongID(client, settings.LyricsNeteaseAPIBase, id)
		if err != nil {
			return LyricsPayload{}, err
		}
		if payload == nil {
			return LyricsPayload{}, fmt.Errorf("netease: no lyrics")
		}
		return *payload, nil
	case "lrclib":
		if !settings.LyricsLRCLibEnabled {
			return LyricsPayload{}, fmt.Errorf("lrclib disabled in settings")
		}
		id, ok := candidateIDInt64(candidate.ID, candidate.LRCLibID)
		if !ok {
			return LyricsPayload{}, fmt.Errorf("lrclib: bad id")
		}
		payload, err := fetchLRCLibByID(client, id)
		if err != nil {
			return LyricsPayload{}, err
		}
		if payload == nil {
			return LyricsPayload{}, fmt.Errorf("lrclib: no lyrics")
		}
		return *payload, nil
	default:
		return LyricsPayload{}, fmt.Errorf("unknown lyric source %s", candidate.Source)
	}
}

func fetchSongLDDCEnriched(client *http.Client, settings config.Settings, req FetchRequest) (*LyricsPayload, error) {
	// Prefer direct PJMP3 lyric fetch by current track source id to avoid fuzzy search misses.
	if sourceID := parsePJMP3SongID(req.PJMP3SourceID); sourceID != "" {
		if lrcText, err := pjmp3.FetchSongLRCText(client, sourceID); err == nil && lrcText != nil {
			trimmed := strings.TrimSpace(*lrcText)
			if payload := tryParseEmbeddedWordLRC(trimmed); payload != nil {
				return payload, nil
			}
			if looksLikeLRC(trimmed) {
				payload := lineOnlyPayload(trimmed)
				return &payload, nil
			}
		}
	}
	if hit, ok := parseKugouLyricHit(req.PJMP3SourceID, req); ok {
		if payload, err := fetchKugouLyrics(client, hit); err == nil && strings.TrimSpace(payload.LRCText) != "" {
			return &payload, nil
		}
	}

	keyword := strings.TrimSpace(strings.TrimSpace(req.Artist) + " " + strings.TrimSpace(req.Title))
	if keyword == "" {
		return nil, nil
	}

	var durationMS *int64
	if req.DurationSeconds != nil && *req.DurationSeconds > 0 {
		value := int64((*req.DurationSeconds) * 1000)
		durationMS = &value
	}

	chain := parseProviderOrder(settings.LyricsProviderOrder)
	if !settings.LyricsLRCLibEnabled {
		chain = removeSource(chain, "lrclib")
	}
	if len(chain) == 0 {
		chain = defaultLyricSources()
		if !settings.LyricsLRCLibEnabled {
			chain = removeSource(chain, "lrclib")
		}
	}

	var fallback *LyricsPayload
	for _, source := range chain {
		candidates, err := SearchCandidates(client, settings, keyword, durationMS, []string{source})
		if err != nil || len(candidates) == 0 {
			continue
		}
		payload, err := FetchCandidate(client, settings, candidates[0])
		if err != nil {
			continue
		}
		if strings.TrimSpace(payload.LRCText) == "" {
			continue
		}
		if len(payload.WordLines) > 0 {
			return &payload, nil
		}
		if fallback == nil {
			copyPayload := payload
			fallback = &copyPayload
		}
	}
	return fallback, nil
}

func parsePJMP3SongID(value *string) string {
	if value == nil {
		return ""
	}
	raw := strings.TrimSpace(*value)
	if raw == "" {
		return ""
	}
	raw = strings.TrimPrefix(strings.ToLower(raw), "pjmp3:")
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	for _, r := range trimmed {
		if r < '0' || r > '9' {
			return ""
		}
	}
	return trimmed
}
