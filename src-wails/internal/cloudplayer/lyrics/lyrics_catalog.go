package lyrics

import (
	"strconv"
	"strings"
)

// Provider catalog helpers normalize saved source order without touching network code.
type neteaseHit struct {
	ID         int64
	Title      string
	Artist     string
	Album      string
	DurationMS int64
}

type lrclibHit struct {
	ID         int64
	Title      string
	Artist     string
	Album      string
	DurationMS int64
}

func defaultLyricSources() []string {
	return []string{"qq", "kugou", "netease", "lrclib"}
}

func parseProviderOrder(value string) []string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" || normalized == "pjmp3,netease,lrclib" {
		return defaultLyricSources()
	}

	out := make([]string, 0, 4)
	seen := map[string]struct{}{}
	for _, part := range strings.Split(normalized, ",") {
		source := strings.TrimSpace(part)
		switch source {
		case "qq", "kugou", "netease", "lrclib":
			if _, ok := seen[source]; ok {
				continue
			}
			seen[source] = struct{}{}
			out = append(out, source)
		}
	}
	if len(out) == 0 {
		return defaultLyricSources()
	}
	return out
}

func normalizeSourceList(sources []string) []string {
	out := make([]string, 0, len(sources))
	seen := map[string]struct{}{}
	for _, source := range sources {
		normalized := strings.ToLower(strings.TrimSpace(source))
		switch normalized {
		case "qq", "kugou", "netease", "lrclib":
			if _, ok := seen[normalized]; ok {
				continue
			}
			seen[normalized] = struct{}{}
			out = append(out, normalized)
		}
	}
	return out
}

func removeSource(sources []string, source string) []string {
	target := strings.ToLower(strings.TrimSpace(source))
	out := make([]string, 0, len(sources))
	for _, item := range sources {
		if strings.ToLower(strings.TrimSpace(item)) == target {
			continue
		}
		out = append(out, item)
	}
	return out
}

func candidateIDInt64(id string, fallback *int64) (int64, bool) {
	if fallback != nil && *fallback > 0 {
		return *fallback, true
	}
	value, err := strconv.ParseInt(strings.TrimSpace(id), 10, 64)
	return value, err == nil && value > 0
}

func derefInt64(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

func absInt64(value int64) int64 {
	if value < 0 {
		return -value
	}
	return value
}
