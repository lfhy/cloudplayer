package cloudplayer

import (
	"fmt"
	"log"
	"strings"

	"cloudplayer/backend/config"
	"cloudplayer/backend/musicsource"
)

// Fallback chain helpers resolve playback across providers when the current source fails.
func (s *CloudPlayerService) resolveOnlinePlayWithFallback(ref musicsource.SourceRef, title, artist string) (ResolveOnlinePlayOut, error) {
	if primary, err := s.resolveOnlinePlayViaProvider(ref, title, artist); err == nil {
		return primary, nil
	} else {
		log.Printf("playback primary failed provider=%s source=%s title=%q artist=%q err=%v", ref.ProviderKey, ref.EncodedID, title, artist, err)
	}

	chain := playbackFallbackChainForProvider(ref.ProviderKey)
	if len(chain) == 0 {
		return ResolveOnlinePlayOut{}, fmt.Errorf("online play failed for provider=%s", ref.ProviderKey)
	}

	reasons := make([]string, 0, len(chain)+1)
	for _, providerKey := range chain {
		fallbackRef, ok, err := s.resolveFallbackSourceRef(providerKey, title, artist)
		if err != nil {
			log.Printf("playback fallback source resolve failed provider=%s title=%q artist=%q err=%v", providerKey, title, artist, err)
			reasons = append(reasons, playbackProviderReason(providerKey, err))
			continue
		}
		if !ok {
			log.Printf("playback fallback source missing provider=%s title=%q artist=%q", providerKey, title, artist)
			reasons = append(reasons, playbackProviderLabel(providerKey)+"未找到可匹配歌曲")
			continue
		}
		resolved, err := s.resolveOnlinePlayViaProvider(fallbackRef, title, artist)
		if err != nil {
			log.Printf("playback fallback play failed provider=%s source=%s title=%q artist=%q err=%v", providerKey, fallbackRef.EncodedID, title, artist, err)
			reasons = append(reasons, playbackProviderReason(providerKey, err))
			continue
		}
		if strings.TrimSpace(resolved.ResolvedSourceID) == "" {
			resolved.ResolvedSourceID = fallbackRef.EncodedID
		}
		resolved.Via = "fallback_" + providerKey + "_" + strings.TrimSpace(resolved.Via)
		return resolved, nil
	}
	if len(reasons) > 0 {
		return ResolveOnlinePlayOut{}, fmt.Errorf("播放失败：%s", strings.Join(uniquePlaybackReasons(reasons), "；"))
	}
	return ResolveOnlinePlayOut{}, fmt.Errorf("播放失败：所有故障转移音源都不可用")
}

func (s *CloudPlayerService) resolveOnlinePlayViaProvider(ref musicsource.SourceRef, title, artist string) (ResolveOnlinePlayOut, error) {
	if ref.ProviderKey == musicsource.ProviderKugou {
		return s.resolveKugouOnlinePlay(ref, title, artist)
	}
	if path := ref.Provider.PreviewCachePathIfExists(ref.RawID); path != "" {
		return ResolveOnlinePlayOut{Kind: "file", Path: path, Via: "preview_cache", ResolvedSourceID: ref.EncodedID}, nil
	}

	s.state.RateLimiter.AcquireSlot()
	previewPath, previewErr := ref.Provider.CachePreviewAudioFile(s.state.HTTP(), ref.RawID)
	if previewErr == nil && previewPath != "" {
		return ResolveOnlinePlayOut{Kind: "file", Path: previewPath, Via: "fetched_preview", ResolvedSourceID: ref.EncodedID}, nil
	}

	s.state.RateLimiter.AcquireSlot()
	previewURL, directErr := ref.Provider.FetchPreviewURL(s.state.HTTP(), ref.RawID)
	if directErr == nil && strings.TrimSpace(previewURL) != "" {
		return ResolveOnlinePlayOut{Kind: "url", URL: previewURL, Via: "direct_url", ResolvedSourceID: ref.EncodedID}, nil
	}

	if previewErr != nil && directErr != nil {
		return ResolveOnlinePlayOut{}, fmt.Errorf("%v; direct url failed: %v", previewErr, directErr)
	}
	if previewErr != nil {
		return ResolveOnlinePlayOut{}, fmt.Errorf("%v; direct url empty", previewErr)
	}
	return ResolveOnlinePlayOut{}, directErr
}

func (s *CloudPlayerService) resolveFallbackSourceRef(providerKey, title, artist string) (musicsource.SourceRef, bool, error) {
	switch providerKey {
	case musicsource.ProviderPJMP3:
		ref, err := s.findBestPjmp3Fallback(strings.TrimSpace(title), strings.TrimSpace(artist))
		if err != nil {
			return musicsource.SourceRef{}, false, err
		}
		return ref, true, nil
	case musicsource.ProviderNetease:
		ref, err := s.findBestNeteaseFallback(strings.TrimSpace(title), strings.TrimSpace(artist))
		if err != nil {
			return musicsource.SourceRef{}, false, err
		}
		return ref, true, nil
	case musicsource.ProviderKugou:
		ref, err := s.findBestKugouFallback(strings.TrimSpace(title), strings.TrimSpace(artist))
		if err != nil {
			return musicsource.SourceRef{}, false, err
		}
		return ref, true, nil
	default:
		return musicsource.SourceRef{}, false, nil
	}
}

func (s *CloudPlayerService) findBestNeteaseFallback(title, artist string) (musicsource.SourceRef, error) {
	return s.findBestProviderFallback(musicsource.ProviderNetease, title, artist, 2)
}

func (s *CloudPlayerService) findBestKugouFallback(title, artist string) (musicsource.SourceRef, error) {
	return s.findBestProviderFallback(musicsource.ProviderKugou, title, artist, 2)
}

func (s *CloudPlayerService) findBestProviderFallback(providerKey, title, artist string, minScore int) (musicsource.SourceRef, error) {
	provider, ok := musicsource.ProviderByKey(providerKey)
	if !ok {
		return musicsource.SourceRef{}, fmt.Errorf("%s provider unavailable", providerKey)
	}
	query := strings.TrimSpace(strings.Join([]string{title, artist}, " "))
	if query == "" {
		return musicsource.SourceRef{}, fmt.Errorf("fallback search query empty")
	}
	s.state.RateLimiter.AcquireSlot()
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
	if bestScore < minScore || strings.TrimSpace(bestSourceID) == "" {
		return musicsource.SourceRef{}, fmt.Errorf("no %s fallback match for %s - %s", providerKey, title, artist)
	}
	return musicsource.ParseSourceID(bestSourceID)
}

func playbackFallbackChainForProvider(currentProvider string) []string {
	settings := config.LoadSettings()
	raw := config.NormalizePlaybackFallbackChain(settings.PlaybackFallbackChain)
	parts := strings.Split(raw, ",")
	chain := make([]string, 0, len(parts))
	seen := map[string]struct{}{}
	for _, part := range parts {
		key := strings.TrimSpace(strings.ToLower(part))
		if key == "" || key == currentProvider {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		switch key {
		case musicsource.ProviderKugou, musicsource.ProviderPJMP3, musicsource.ProviderNetease:
			seen[key] = struct{}{}
			chain = append(chain, key)
		}
	}
	log.Printf("playback fallback chain current=%s chain=%v", currentProvider, chain)
	return chain
}

func playbackProviderReason(providerKey string, err error) string {
	message := strings.TrimSpace(strings.ToLower(err.Error()))
	label := playbackProviderLabel(providerKey)
	switch {
	case strings.Contains(message, "kugou login required"):
		return label + "需要重新登录"
	case strings.Contains(message, "forcibly closed"), strings.Contains(message, "connection was forcibly closed"), strings.Contains(message, "timeout"), strings.Contains(message, "deadline exceeded"):
		return label + "连接失败"
	case strings.Contains(message, "no playable url"), strings.Contains(message, "preview url is empty"), strings.Contains(message, "full url unavailable"):
		return label + "找到了歌曲，但当前不可播放"
	case strings.Contains(message, "no ") && strings.Contains(message, "fallback match"):
		return label + "未找到可匹配歌曲"
	case strings.Contains(message, "fallback search query empty"):
		return "当前歌曲缺少可用于故障转移的标题或歌手信息"
	default:
		return label + "不可用"
	}
}

func playbackProviderLabel(providerKey string) string {
	switch providerKey {
	case musicsource.ProviderKugou:
		return "酷狗"
	case musicsource.ProviderPJMP3:
		return "PJMP3"
	case musicsource.ProviderNetease:
		return "网易云"
	default:
		return providerKey
	}
}

func uniquePlaybackReasons(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		key := strings.TrimSpace(value)
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, key)
	}
	return out
}
