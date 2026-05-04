package musicsource

import (
	"fmt"
	"strconv"
	"strings"
)

// Kugou source IDs use hash plus albumAudioID so search/play/download share one stable identifier.
func encodeKugouRawID(hash string, albumAudioID int) string {
	trimmedHash := strings.ToLower(strings.TrimSpace(hash))
	if trimmedHash == "" {
		return ""
	}
	if albumAudioID <= 0 {
		return trimmedHash
	}
	return trimmedHash + "|" + strconv.Itoa(albumAudioID)
}

func parseKugouRawID(rawID string) (string, int, error) {
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
