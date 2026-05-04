package cloudplayer

import (
	"database/sql"
	"strings"
)

// Shared helpers stay in a tiny companion file so the larger service files can stay domain-focused.
func clampFloat(value, minValue, maxValue float64) float64 {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func maxInt(value, minValue int) int {
	if value < minValue {
		return minValue
	}
	return value
}

func normalizeHexColour(value string) (string, bool) {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) != 7 || trimmed[0] != '#' {
		return "", false
	}
	for _, r := range trimmed[1:] {
		if (r < '0' || r > '9') && (r < 'a' || r > 'f') && (r < 'A' || r > 'F') {
			return "", false
		}
	}
	return strings.ToLower(trimmed), true
}

func maxUint32(value, minValue uint32) uint32 {
	if value < minValue {
		return minValue
	}
	return value
}

func rollback(tx *sql.Tx) {
	_ = tx.Rollback()
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
