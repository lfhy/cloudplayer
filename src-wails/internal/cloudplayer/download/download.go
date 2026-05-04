package download

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"cloudplayer/internal/cloudplayer/musicsource"
)

// Queue entrypoints keep provider dispatch separate from provider-specific download implementations.
const browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

type DownloadJob struct {
	SourceID string `json:"source_id"`
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	Quality  string `json:"quality"`
}

type DownloadTaskEvent struct {
	SourceID string  `json:"source_id"`
	Title    string  `json:"title"`
	Artist   string  `json:"artist"`
	Quality  string  `json:"quality"`
	Status   string  `json:"status"`
	Progress float64 `json:"progress"`
	Message  *string `json:"message,omitempty"`
}

func CandidateDownloadedAudioPaths(title, artist string) []string {
	root := destinationRoot()
	mp3Name := sanitizeFilename(fmt.Sprintf("%s - %s.mp3", strings.TrimSpace(title), strings.TrimSpace(artist)))
	flacName := sanitizeFilename(fmt.Sprintf("%s - %s.flac", strings.TrimSpace(title), strings.TrimSpace(artist)))
	return []string{
		filepath.Join(root, mp3Name),
		filepath.Join(root, flacName),
	}
}

func EmitQueued(job DownloadJob) {
	message := "已加入下载队列"
	emitTask(DownloadTaskEvent{
		SourceID: job.SourceID,
		Title:    job.Title,
		Artist:   job.Artist,
		Quality:  job.Quality,
		Status:   "queued",
		Progress: 0,
		Message:  &message,
	})
}

func RunOneJob(client *http.Client, job DownloadJob) {
	task := DownloadTaskEvent{
		SourceID: job.SourceID,
		Title:    job.Title,
		Artist:   job.Artist,
		Quality:  job.Quality,
		Status:   "queued",
		Progress: 0,
	}

	fail := func(format string, args ...any) {
		message := fmt.Sprintf(format, args...)
		task.Status = "failed"
		task.Message = &message
		emitTask(task)
	}

	ref, err := musicsource.ParseSourceID(job.SourceID)
	if err != nil {
		fail("%s", err)
		return
	}

	if err := checkAndReserveDownloadSlot(); err != nil {
		fail("%s", err)
		return
	}

	task.Status = "downloading"
	task.Message = nil
	emitTask(task)

	switch ref.ProviderKey {
	case musicsource.ProviderPJMP3:
		runPJMP3Job(client, ref.RawID, job, &task, fail)
	case musicsource.ProviderKugou:
		runKugouJob(ref.RawID, job, &task, fail)
	default:
		fail("不支持的音乐源: %s", ref.ProviderKey)
	}
}
