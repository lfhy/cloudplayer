package sharelink

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Shared request helpers centralize timeout handling and loose JSON coercion.
func parseJSONPOrJSON(text string) (map[string]any, error) {
	trimmed := strings.TrimSpace(text)
	switch {
	case strings.HasPrefix(trimmed, "MusicJsonCallback("):
		trimmed = strings.TrimPrefix(trimmed, "MusicJsonCallback(")
	case strings.HasPrefix(trimmed, "jsonCallback("):
		trimmed = strings.TrimPrefix(trimmed, "jsonCallback(")
	}
	trimmed = strings.TrimSuffix(trimmed, ");")
	trimmed = strings.TrimSuffix(trimmed, ")")
	result := map[string]any{}
	if err := json.Unmarshal([]byte(strings.TrimSpace(trimmed)), &result); err != nil {
		return nil, err
	}
	return result, nil
}

func doRequest(client *http.Client, request *http.Request, timeout time.Duration) ([]byte, int, error) {
	ctx, cancel := withTimeout(request, timeout)
	defer cancel()
	response, err := client.Do(request.WithContext(ctx))
	if err != nil {
		return nil, 0, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		body, _ := io.ReadAll(response.Body)
		if len(body) > 0 {
			return nil, response.StatusCode, fmt.Errorf("%s", strings.TrimSpace(string(body)))
		}
		return nil, response.StatusCode, fmt.Errorf("http %s", response.Status)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, response.StatusCode, err
	}
	return body, response.StatusCode, nil
}

func doRequestWithFinalURL(client *http.Client, request *http.Request, timeout time.Duration) ([]byte, string, error) {
	ctx, cancel := withTimeout(request, timeout)
	defer cancel()
	response, err := client.Do(request.WithContext(ctx))
	if err != nil {
		return nil, "", err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		body, _ := io.ReadAll(response.Body)
		if len(body) > 0 {
			return nil, "", fmt.Errorf("%s", strings.TrimSpace(string(body)))
		}
		return nil, "", fmt.Errorf("http %s", response.Status)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, "", err
	}
	return body, response.Request.URL.String(), nil
}

func withTimeout(request *http.Request, timeout time.Duration) (context.Context, func()) {
	ctx, cancel := context.WithTimeout(request.Context(), timeout)
	return ctx, cancel
}

func applyHeaders(request *http.Request, headers map[string]string) {
	for key, value := range headers {
		if value != "" {
			request.Header.Set(key, value)
		}
	}
}

func ensureURL(value string) string {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
		return value
	}
	return "https://" + value
}

func percentDecodeURL(value string) string {
	decoded, err := url.QueryUnescape(value)
	if err != nil {
		return value
	}
	return decoded
}

func mapValue(value any) map[string]any {
	if value == nil {
		return nil
	}
	if typed, ok := value.(map[string]any); ok {
		return typed
	}
	return nil
}

func arrayValue(value any) []any {
	if typed, ok := value.([]any); ok {
		return typed
	}
	return nil
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return fmt.Sprintf("%.0f", typed)
	case json.Number:
		return typed.String()
	case int64:
		return fmt.Sprintf("%d", typed)
	case int:
		return fmt.Sprintf("%d", typed)
	default:
		return ""
	}
}

func intValue(value any) int64 {
	switch typed := value.(type) {
	case float64:
		return int64(typed)
	case json.Number:
		result, _ := typed.Int64()
		return result
	case int64:
		return typed
	case int:
		return int64(typed)
	case string:
		if !allDigits(typed) {
			return 0
		}
		var result int64
		for _, r := range typed {
			result = result*10 + int64(r-'0')
		}
		return result
	default:
		return 0
	}
}

func allDigits(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func firstAny(items []any) any {
	if len(items) == 0 {
		return nil
	}
	return items[0]
}

func firstNonNil(values ...any) any {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}
