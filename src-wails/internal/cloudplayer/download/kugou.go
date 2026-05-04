package download

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	kg "github.com/lfhy/kugou-music-api"
)

// runKugouJob downloads the resolved Kugou playback URL into the app download directory.
func runKugouJob(rawID string, job DownloadJob, task *DownloadTaskEvent, fail func(string, ...any)) {
	hash, albumAudioID, err := parseKugouDownloadID(rawID)
	if err != nil {
		fail("%s", err)
		return
	}
	client, err := kg.New(kg.WithLite(true))
	if err != nil {
		fail("初始化酷狗 SDK 失败: %v", err)
		return
	}
	musicURL, err := client.GetSongPlayURL(context.Background(), kg.SongPlayURLRequest{
		Hash:         hash,
		AlbumAudioID: albumAudioID,
		FreePart:     true,
	})
	if err != nil {
		fail("获取酷狗下载地址失败: %v", err)
		return
	}
	if strings.TrimSpace(musicURL) == "" {
		fail("未解析到酷狗可下载地址")
		return
	}

	root := destinationRoot()
	if err := os.MkdirAll(root, 0o755); err != nil {
		fail("创建目录: %v", err)
		return
	}
	filename := sanitizeFilename(fmt.Sprintf("%s - %s.mp3", job.Title, job.Artist))
	outputPath := filepath.Join(root, filename)
	request, err := http.NewRequest(http.MethodGet, musicURL, nil)
	if err != nil {
		fail("下载音频: %v", err)
		return
	}
	request.Header.Set("User-Agent", browserUA)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	response, err := http.DefaultClient.Do(request.WithContext(ctx))
	if err != nil {
		fail("下载音频: %v", err)
		return
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		fail("音频 HTTP %s", response.Status)
		return
	}

	file, err := os.Create(outputPath)
	if err != nil {
		fail("创建文件: %v", err)
		return
	}
	defer file.Close()

	total := response.ContentLength
	var written int64
	buffer := make([]byte, 128*1024)
	for {
		n, readErr := response.Body.Read(buffer)
		if n > 0 {
			if _, err := file.Write(buffer[:n]); err != nil {
				fail("写入: %v", err)
				return
			}
			written += int64(n)
			if total > 0 {
				task.Progress = float64(written) / float64(total)
			} else {
				task.Progress = 0.99
			}
			emitTask(*task)
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			fail("读取音频: %v", readErr)
			return
		}
	}

	if err := file.Sync(); err != nil {
		fail("写入: %v", err)
		return
	}
	var message string
	if err := recordDownloadSuccess(); err != nil {
		message = "已保存但计数失败: " + err.Error()
	} else {
		message = "已保存: " + outputPath
	}
	task.Status = "completed"
	task.Progress = 1
	task.Message = &message
	emitTask(*task)
}
