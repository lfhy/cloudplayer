package musicsource

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
)

// kugouNumericID decodes SDK payload numbers that may already be float64 or scientific notation strings.
func kugouNumericID(value any) int {
	switch typed := value.(type) {
	case int:
		if typed > 0 {
			return typed
		}
	case int32:
		if typed > 0 {
			return int(typed)
		}
	case int64:
		if typed > 0 {
			return int(typed)
		}
	case float32:
		if typed > 0 {
			return int(math.Round(float64(typed)))
		}
	case float64:
		if typed > 0 {
			return int(math.Round(typed))
		}
	case json.Number:
		if parsed, err := typed.Int64(); err == nil && parsed > 0 {
			return int(parsed)
		}
		if parsed, err := typed.Float64(); err == nil && parsed > 0 {
			return int(math.Round(parsed))
		}
	}

	text := strings.TrimSpace(fmt.Sprintf("%v", value))
	if text == "" || text == "<nil>" {
		return 0
	}
	if parsed, err := strconv.ParseInt(text, 10, 64); err == nil && parsed > 0 {
		return int(parsed)
	}
	if parsed, err := strconv.ParseFloat(text, 64); err == nil && parsed > 0 {
		return int(math.Round(parsed))
	}
	return 0
}
