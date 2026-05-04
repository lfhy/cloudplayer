package lyrics

// Source-id helpers keep provider-specific fast paths out of the main provider chain.

import (
	"strings"

	"cloudplayer/backend/core/cloudplayer/musicsource"
)

func parseKugouLyricHit(sourceID *string, req FetchRequest) (kugouSearchHit, bool) {
	if sourceID == nil || strings.TrimSpace(*sourceID) == "" {
		return kugouSearchHit{}, false
	}
	ref, err := musicsource.ParseSourceID(strings.TrimSpace(*sourceID))
	if err != nil || ref.ProviderKey != musicsource.ProviderKugou {
		return kugouSearchHit{}, false
	}
	parts := strings.Split(strings.TrimSpace(ref.RawID), "|")
	hash := ""
	if len(parts) > 0 {
		hash = strings.ToLower(strings.TrimSpace(parts[0]))
	}
	albumAudioID := ""
	if len(parts) > 1 {
		albumAudioID = strings.TrimSpace(parts[1])
	}
	durationMS := int64(0)
	if req.DurationSeconds != nil && *req.DurationSeconds > 0 {
		durationMS = int64(*req.DurationSeconds * 1000)
	}
	return kugouSearchHit{
		AlbumAudioID: albumAudioID,
		FileHash:     hash,
		Title:        strings.TrimSpace(req.Title),
		Artist:       strings.TrimSpace(req.Artist),
		Album:        strings.TrimSpace(req.Album),
		DurationMS:   durationMS,
	}, hash != "" || albumAudioID != ""
}
