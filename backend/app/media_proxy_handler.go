package cloudplayer

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cloudplayer/backend/config"
	"cloudplayer/backend/httpclient"
	"cloudplayer/backend/state"
)

// Remote media proxy keeps third-party avatars, covers and stream URLs behind the app's HTTP client.
func remoteMediaHandler(state *state.AppState, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/__media__":
			path := request.URL.Query().Get("path")
			if path == "" {
				http.NotFound(writer, request)
				return
			}
			http.ServeFile(writer, request, path)
			return
		case "/__remote_media__":
			serveRemoteMedia(state, writer, request)
			return
		default:
			next.ServeHTTP(writer, request)
		}
	})
}

func serveRemoteMedia(state *state.AppState, writer http.ResponseWriter, request *http.Request) {
	rawURL := strings.TrimSpace(request.URL.Query().Get("url"))
	if rawURL == "" || (!strings.HasPrefix(rawURL, "https://") && !strings.HasPrefix(rawURL, "http://")) {
		http.NotFound(writer, request)
		return
	}
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	trace := shouldTraceRemoteMediaRequest(request, rawURL)
	rangeHeader := strings.TrimSpace(request.Header.Get("Range"))
	if serveRemoteMediaCache(rawURL, writer, request) {
		if trace {
			log.Printf("remote media cache hit: method=%s range=%q url=%s", request.Method, rangeHeader, logURL160(rawURL))
		}
		return
	}

	req, err := http.NewRequestWithContext(request.Context(), request.Method, rawURL, nil)
	if err != nil {
		log.Printf("remote media build request failed: method=%s range=%q url=%s err=%v", request.Method, rangeHeader, logURL160(rawURL), err)
		http.Error(writer, "bad remote media url", http.StatusBadRequest)
		return
	}
	req.Header.Set("User-Agent", request.UserAgent())
	if accept := strings.TrimSpace(request.Header.Get("Accept")); accept != "" {
		req.Header.Set("Accept", accept)
	}
	if rng := strings.TrimSpace(request.Header.Get("Range")); rng != "" {
		req.Header.Set("Range", rng)
	}

	if trace {
		log.Printf("remote media fetch start: method=%s range=%q url=%s", request.Method, rangeHeader, logURL160(rawURL))
	}
	resp, err := httpclient.StreamingClone(state.HTTP()).Do(req)
	if err != nil {
		log.Printf("remote media upstream failed: method=%s range=%q url=%s err=%v", request.Method, rangeHeader, logURL160(rawURL), err)
		http.Error(writer, "remote media fetch failed", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	cacheable := remoteImageCacheable(resp.Header.Get("Content-Type"))
	copyRemoteMediaHeaders(writer.Header(), resp.Header)
	if writer.Header().Get("Cache-Control") == "" {
		writer.Header().Set("Cache-Control", "public, max-age=86400")
	}
	if writer.Header().Get("Access-Control-Allow-Origin") == "" {
		writer.Header().Set("Access-Control-Allow-Origin", "*")
	}
	if trace || resp.StatusCode >= http.StatusBadRequest {
		log.Printf(
			"remote media upstream response: method=%s status=%d range=%q type=%q length=%q url=%s",
			request.Method,
			resp.StatusCode,
			rangeHeader,
			strings.TrimSpace(resp.Header.Get("Content-Type")),
			strings.TrimSpace(resp.Header.Get("Content-Length")),
			logURL160(rawURL),
		)
	}
	if request.Method == http.MethodHead {
		writer.WriteHeader(resp.StatusCode)
		return
	}
	if cacheable && resp.StatusCode == http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		if err == nil && len(body) > 0 {
			cacheRemoteMedia(rawURL, body)
			writer.WriteHeader(resp.StatusCode)
			_, _ = io.Copy(writer, bytes.NewReader(body))
			return
		}
	}
	writer.WriteHeader(resp.StatusCode)
	written, err := io.Copy(writer, resp.Body)
	if err != nil {
		log.Printf(
			"remote media stream copy failed: method=%s status=%d range=%q bytes=%d url=%s err=%v",
			request.Method,
			resp.StatusCode,
			rangeHeader,
			written,
			logURL160(rawURL),
			err,
		)
		return
	}
	if trace {
		log.Printf("remote media fetch complete: method=%s status=%d range=%q bytes=%d url=%s", request.Method, resp.StatusCode, rangeHeader, written, logURL160(rawURL))
	}
}

func copyRemoteMediaHeaders(dst, src http.Header) {
	for _, key := range []string{
		"Content-Type",
		"Content-Length",
		"Content-Range",
		"Accept-Ranges",
		"ETag",
		"Last-Modified",
		"Cache-Control",
	} {
		if value := strings.TrimSpace(src.Get(key)); value != "" {
			dst.Set(key, value)
		}
	}
	if expires := strings.TrimSpace(src.Get("Expires")); expires != "" {
		dst.Set("Expires", expires)
		return
	}
	dst.Set("Expires", time.Now().Add(24*time.Hour).UTC().Format(http.TimeFormat))
}

func remoteMediaCacheDir() string {
	return filepath.Join(config.ConfigDir(), "remote_media_cache")
}

func remoteMediaCachePath(rawURL string) string {
	sum := sha1.Sum([]byte(strings.TrimSpace(rawURL)))
	return filepath.Join(remoteMediaCacheDir(), hex.EncodeToString(sum[:]))
}

func remoteImageCacheable(contentType string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(contentType)), "image/")
}

func shouldTraceRemoteMediaRequest(request *http.Request, rawURL string) bool {
	if request == nil {
		return false
	}
	accept := strings.ToLower(strings.TrimSpace(request.Header.Get("Accept")))
	if strings.Contains(accept, "audio/") || strings.Contains(accept, "video/") {
		return true
	}
	if strings.TrimSpace(request.Header.Get("Range")) != "" {
		return true
	}
	lowerURL := strings.ToLower(strings.TrimSpace(rawURL))
	for _, ext := range []string{".mp3", ".flac", ".m4a", ".aac", ".ogg", ".wav"} {
		if strings.Contains(lowerURL, ext) {
			return true
		}
	}
	return false
}

func serveRemoteMediaCache(rawURL string, writer http.ResponseWriter, request *http.Request) bool {
	path := remoteMediaCachePath(rawURL)
	info, err := os.Stat(path)
	if err != nil || info.IsDir() || info.Size() <= 0 {
		return false
	}
	writer.Header().Set("Cache-Control", "public, max-age=604800")
	writer.Header().Set("Access-Control-Allow-Origin", "*")
	http.ServeFile(writer, request, path)
	return true
}

func cacheRemoteMedia(rawURL string, body []byte) {
	if err := os.MkdirAll(remoteMediaCacheDir(), 0o755); err != nil {
		return
	}
	path := remoteMediaCachePath(rawURL)
	tmp := path + ".tmp"
	file, err := os.Create(tmp)
	if err != nil {
		return
	}
	if _, err = file.Write(body); err != nil {
		_ = file.Close()
		_ = os.Remove(tmp)
		return
	}
	if err = file.Close(); err != nil {
		_ = os.Remove(tmp)
		return
	}
	_ = os.Rename(tmp, path)
}
