package cloudplayer

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"cloudplayer/backend/config"
	"cloudplayer/backend/musicsource"
	kg "github.com/lfhy/kugou-music-api"
)

// Kugou playback helpers avoid treating one-minute preview URLs as valid full-track playback.
func (s *CloudPlayerService) resolveKugouOnlinePlay(ref musicsource.SourceRef, title, artist string) (ResolveOnlinePlayOut, error) {
	s.maybeSyncKugouBenefits(context.Background())
	if resolvedURL, err := resolveKugouFullPlayURL(ref.RawID); err == nil {
		return ResolveOnlinePlayOut{Kind: "url", URL: resolvedURL, Via: "kugou_direct_full"}, nil
	}
	return s.resolvePjmp3Fallback(strings.TrimSpace(title), strings.TrimSpace(artist))
}

func resolveKugouFullPlayURL(rawID string) (string, error) {
	session := config.LoadKugouSession()
	if !hasKugouLoginCookie(session) {
		return "", fmt.Errorf("kugou login required")
	}
	hash, albumAudioID, err := parseKugouPlaybackRawID(rawID)
	if err != nil {
		return "", err
	}
	client, err := kg.New(kg.WithLite(true), kg.WithCookie(session.Cookie))
	if err != nil {
		return "", err
	}
	result, err := client.ResolveSongPlayURL(context.Background(), kg.SongPlayURLRequest{
		Hash:         hash,
		AlbumAudioID: albumAudioID,
		FreePart:     false,
		Cookie:       session.Cookie,
	}, kg.WithSongURLAll(true))
	if err != nil {
		return "", err
	}
	if resolved := pickKugouAudioURL(result); resolved != "" {
		return resolved, nil
	}
	return "", fmt.Errorf("kugou full url unavailable")
}

func (s *CloudPlayerService) resolvePjmp3Fallback(title, artist string) (ResolveOnlinePlayOut, error) {
	ref, err := s.findBestPjmp3Fallback(title, artist)
	if err != nil {
		return ResolveOnlinePlayOut{}, err
	}
	if path := ref.Provider.PreviewCachePathIfExists(ref.RawID); path != "" {
		return ResolveOnlinePlayOut{
			Kind:             "file",
			Path:             path,
			Via:              "pjmp3_fallback_cache",
			ResolvedSourceID: ref.EncodedID,
		}, nil
	}
	previewPath, previewErr := ref.Provider.CachePreviewAudioFile(s.state.HTTP(), ref.RawID)
	if previewErr == nil && previewPath != "" {
		return ResolveOnlinePlayOut{
			Kind:             "file",
			Path:             previewPath,
			Via:              "pjmp3_fallback_fetch",
			ResolvedSourceID: ref.EncodedID,
		}, nil
	}
	previewURL, directErr := ref.Provider.FetchPreviewURL(s.state.HTTP(), ref.RawID)
	if directErr == nil && strings.TrimSpace(previewURL) != "" {
		return ResolveOnlinePlayOut{
			Kind:             "url",
			URL:              previewURL,
			Via:              "pjmp3_fallback_url",
			ResolvedSourceID: ref.EncodedID,
		}, nil
	}
	if previewErr != nil && directErr != nil {
		return ResolveOnlinePlayOut{}, fmt.Errorf("%v; fallback direct url failed: %v", previewErr, directErr)
	}
	if previewErr != nil {
		return ResolveOnlinePlayOut{}, previewErr
	}
	return ResolveOnlinePlayOut{}, fmt.Errorf("pjmp3 fallback unavailable")
}

func (s *CloudPlayerService) findBestPjmp3Fallback(title, artist string) (musicsource.SourceRef, error) {
	provider, ok := musicsource.ProviderByKey(musicsource.ProviderPJMP3)
	if !ok {
		return musicsource.SourceRef{}, fmt.Errorf("pjmp3 provider unavailable")
	}
	query := strings.TrimSpace(strings.Join([]string{title, artist}, " "))
	if query == "" {
		return musicsource.SourceRef{}, fmt.Errorf("fallback search query empty")
	}
	results, _, err := provider.Search(s.state.HTTP(), query, 1)
	if err != nil {
		return musicsource.SourceRef{}, err
	}
	bestSourceID := ""
	bestScore := -1
	for _, row := range results {
		score := scoreFallbackCandidate(row.Title, row.Artist, title, artist)
		if score > bestScore {
			bestScore = score
			bestSourceID = row.SourceID
		}
	}
	if bestScore < 2 || strings.TrimSpace(bestSourceID) == "" {
		return musicsource.SourceRef{}, fmt.Errorf("no pjmp3 fallback match for %s - %s", title, artist)
	}
	return musicsource.ParseSourceID(bestSourceID)
}

func pickKugouAudioURL(result *kg.SongPlayURLResult) string {
	if result == nil {
		return ""
	}
	candidates := append([]string{result.Primary}, result.URLs...)
	for _, candidate := range candidates {
		if isUsableAudioURL(candidate) && !isKugouPreviewURL(candidate) {
			return strings.TrimSpace(candidate)
		}
	}
	return ""
}

func scoreFallbackCandidate(candidateTitle, candidateArtist, targetTitle, targetArtist string) int {
	score := 0
	normalizedCandidateTitle := normalizeFallbackText(candidateTitle)
	normalizedCandidateArtist := normalizeFallbackText(candidateArtist)
	normalizedTargetTitle := normalizeFallbackText(targetTitle)
	normalizedTargetArtist := normalizeFallbackText(targetArtist)
	switch {
	case normalizedCandidateTitle == normalizedTargetTitle:
		score += 4
	case strings.Contains(normalizedCandidateTitle, normalizedTargetTitle) || strings.Contains(normalizedTargetTitle, normalizedCandidateTitle):
		score += 2
	}
	switch {
	case normalizedTargetArtist == "":
	case normalizedCandidateArtist == normalizedTargetArtist:
		score += 3
	case strings.Contains(normalizedCandidateArtist, normalizedTargetArtist) || strings.Contains(normalizedTargetArtist, normalizedCandidateArtist):
		score += 1
	}
	return score
}

func normalizeFallbackText(raw string) string {
	value := strings.ToLower(strings.TrimSpace(raw))
	replacer := strings.NewReplacer(" ", "", "\t", "", "\n", "", "\r", "", "-", "", "_", "", "/", "", "\\", "", ".", "", ",", "", "(", "", ")", "", "[", "", "]", "", "{", "", "}", "", "'", "", "\"", "", "&", "")
	return replacer.Replace(value)
}

func parseKugouPlaybackRawID(rawID string) (string, int, error) {
	parts := strings.SplitN(strings.TrimSpace(rawID), "|", 2)
	hash := strings.ToLower(strings.TrimSpace(parts[0]))
	if hash == "" {
		return "", 0, fmt.Errorf("invalid kugou track id")
	}
	if len(parts) == 1 {
		return hash, 0, nil
	}
	albumAudioID, err := strconv.Atoi(strings.TrimSpace(parts[1]))
	if err != nil {
		return "", 0, err
	}
	return hash, albumAudioID, nil
}

func isUsableAudioURL(raw string) bool {
	value := strings.TrimSpace(raw)
	if value == "" {
		return false
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return false
	}
	lowerPath := strings.ToLower(parsed.Path)
	for _, suffix := range []string{".jpg", ".jpeg", ".png", ".webp", ".gif"} {
		if strings.HasSuffix(lowerPath, suffix) {
			return false
		}
	}
	return true
}

func isKugouPreviewURL(raw string) bool {
	lower := strings.ToLower(strings.TrimSpace(raw))
	return strings.Contains(lower, "/p_0_") || strings.Contains(lower, "free_part")
}
