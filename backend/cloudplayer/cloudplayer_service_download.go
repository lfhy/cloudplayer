package cloudplayer

import (
	"fmt"
	"strings"

	"cloudplayer/backend/core/cloudplayer/download"
)

// Download service methods validate queue requests before pushing them to the worker channel.
func (s *CloudPlayerService) EnqueueDownload(job download.DownloadJob) error {
	job.SourceID = strings.TrimSpace(job.SourceID)
	job.Title = strings.TrimSpace(job.Title)
	job.Artist = strings.TrimSpace(job.Artist)
	job.Quality = normalizeDownloadQuality(job.Quality)
	if job.SourceID == "" {
		return fmt.Errorf("无曲库 id，无法下载")
	}

	download.EmitQueued(job)
	select {
	case s.state.DownloadCh <- job:
		return nil
	default:
		return fmt.Errorf("下载队列已满，请稍后再试")
	}
}

func isAudioExtension(ext string) bool {
	switch strings.ToLower(strings.TrimSpace(ext)) {
	case "mp3", "flac", "m4a", "wav", "ogg", "aac", "opus", "wma":
		return true
	default:
		return false
	}
}

func normalizeDownloadQuality(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "flac":
		return "flac"
	case "320", "hq":
		return "320"
	default:
		return "128"
	}
}
