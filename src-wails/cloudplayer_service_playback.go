package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"cloudplayer/internal/cloudplayer/download"
	"cloudplayer/internal/cloudplayer/importplaylist"
	"cloudplayer/internal/cloudplayer/musicsource"
)

// Playback helpers resolve online tracks and expose import parsing to the frontend.
func (s *CloudPlayerService) SearchSongs(keyword string, page uint32) (SearchResponse, error) {
	trimmed := strings.TrimSpace(keyword)
	if trimmed == "" {
		return SearchResponse{}, fmt.Errorf("请输入搜索关键词")
	}
	resolvedPage := maxUint32(page, 1)
	provider := musicsource.Current()
	cacheKey := SearchCacheKey(provider.Key(), trimmed, resolvedPage)
	if cached, ok := s.state.SearchCache.Get(cacheKey); ok {
		return cached, nil
	}
	s.state.RateLimiter.AcquireSlot()
	results, hasNext, err := provider.Search(s.state.HTTP(), trimmed, resolvedPage)
	if err != nil {
		log.Printf("SearchSongs failed: keyword=%q page=%d provider=%s err=%v", trimmed, resolvedPage, provider.Key(), err)
		return SearchResponse{}, err
	}
	response := SearchResponse{Results: results, HasNext: hasNext}
	s.state.SearchCache.Set(cacheKey, response, s.state.SearchCacheTTL)
	return response, nil
}

func (s *CloudPlayerService) GetPreviewURL(songID string) (string, error) {
	ref, err := musicsource.ParseSourceID(songID)
	if err != nil {
		return "", err
	}
	s.state.RateLimiter.AcquireSlot()
	previewURL, err := ref.Provider.FetchPreviewURL(s.state.HTTP(), ref.RawID)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(previewURL) == "" {
		return "", fmt.Errorf("未解析到 MP3 试听地址")
	}
	return previewURL, nil
}

func (s *CloudPlayerService) CachePreviewForPlay(songID string) (string, error) {
	ref, err := musicsource.ParseSourceID(songID)
	if err != nil {
		return "", err
	}
	s.state.RateLimiter.AcquireSlot()
	return ref.Provider.CachePreviewAudioFile(s.state.HTTP(), ref.RawID)
}

func (s *CloudPlayerService) ResolveOnlinePlay(songID, title, artist string) (ResolveOnlinePlayOut, error) {
	ref, err := musicsource.ParseSourceID(songID)
	if err != nil {
		return ResolveOnlinePlayOut{}, err
	}
	trimmedTitle := strings.TrimSpace(title)
	trimmedArtist := strings.TrimSpace(artist)

	for _, path := range download.CandidateDownloadedAudioPaths(trimmedTitle, trimmedArtist) {
		info, err := os.Stat(path)
		if err == nil && !info.IsDir() && info.Size() > 0 {
			return ResolveOnlinePlayOut{
				Kind: "file",
				Path: path,
				Via:  "download",
			}, nil
		}
	}

	if path := ref.Provider.PreviewCachePathIfExists(ref.RawID); path != "" {
		return ResolveOnlinePlayOut{
			Kind: "file",
			Path: path,
			Via:  "preview_cache",
		}, nil
	}

	s.state.RateLimiter.AcquireSlot()
	previewPath, previewErr := ref.Provider.CachePreviewAudioFile(s.state.HTTP(), ref.RawID)
	if previewErr == nil && previewPath != "" {
		return ResolveOnlinePlayOut{
			Kind: "file",
			Path: previewPath,
			Via:  "fetched_preview",
		}, nil
	}

	s.state.RateLimiter.AcquireSlot()
	previewURL, directErr := ref.Provider.FetchPreviewURL(s.state.HTTP(), ref.RawID)
	if directErr == nil && strings.TrimSpace(previewURL) != "" {
		return ResolveOnlinePlayOut{
			Kind: "url",
			URL:  previewURL,
			Via:  "direct_url",
		}, nil
	}

	if previewErr != nil && directErr != nil {
		return ResolveOnlinePlayOut{}, fmt.Errorf("%v；直链降级失败：%v", previewErr, directErr)
	}
	if previewErr != nil {
		return ResolveOnlinePlayOut{}, fmt.Errorf("%v；直链降级：未解析到 MP3 地址", previewErr)
	}
	if directErr != nil {
		return ResolveOnlinePlayOut{}, directErr
	}
	return ResolveOnlinePlayOut{}, fmt.Errorf("未解析到可播放地址")
}

func (s *CloudPlayerService) ParseImportText(text, format string) ([]importplaylist.ImportedTrackDTO, error) {
	return importplaylist.ParsePlaylistText(text, format)
}
