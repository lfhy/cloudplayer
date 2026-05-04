package download

import (
	"fmt"
	"strconv"
	"strings"
)

// Kugou download IDs mirror the music-source codec so provider dispatch can stay simple here.
func parseKugouDownloadID(rawID string) (string, int, error) {
	parts := strings.Split(strings.TrimSpace(rawID), "|")
	hash := strings.ToLower(strings.TrimSpace(parts[0]))
	if hash == "" {
		return "", 0, fmt.Errorf("无效的酷狗歌曲 ID")
	}
	if len(parts) == 1 {
		return hash, 0, nil
	}
	albumAudioID, err := strconv.Atoi(strings.TrimSpace(parts[1]))
	if err != nil {
		return "", 0, fmt.Errorf("无效的酷狗歌曲 ID")
	}
	return hash, albumAudioID, nil
}
