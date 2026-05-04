package main

import (
	"io"
	"net/http"
	"strings"
	"time"
)

// Remote media proxy keeps third-party avatars, covers and stream URLs behind the app's HTTP client.
func remoteMediaHandler(state *AppState, next http.Handler) http.Handler {
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

func serveRemoteMedia(state *AppState, writer http.ResponseWriter, request *http.Request) {
	rawURL := strings.TrimSpace(request.URL.Query().Get("url"))
	if rawURL == "" || (!strings.HasPrefix(rawURL, "https://") && !strings.HasPrefix(rawURL, "http://")) {
		http.NotFound(writer, request)
		return
	}

	req, err := http.NewRequestWithContext(request.Context(), http.MethodGet, rawURL, nil)
	if err != nil {
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

	resp, err := state.HTTP().Do(req)
	if err != nil {
		http.Error(writer, "remote media fetch failed", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	copyRemoteMediaHeaders(writer.Header(), resp.Header)
	if writer.Header().Get("Cache-Control") == "" {
		writer.Header().Set("Cache-Control", "public, max-age=86400")
	}
	if writer.Header().Get("Access-Control-Allow-Origin") == "" {
		writer.Header().Set("Access-Control-Allow-Origin", "*")
	}
	writer.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(writer, resp.Body)
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
