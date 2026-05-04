package pjmp3

import (
	"fmt"
	"io"
	"net/http"
	"time"
)

// Shared PJMP3 headers keep search/page requests stable behind some local proxies.
func applyPJMP3PageHeaders(request *http.Request, referer string) {
	request.Header.Set("User-Agent", browserUA)
	request.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	if referer != "" {
		request.Header.Set("Referer", referer)
	}
}

// PJMP3 HTML pages intermittently return 500 behind some local proxies when Go
// auto-negotiates compressed responses. Use a shallow client clone that turns
// off automatic compression only for these page fetches.
func pjmp3PageClient(client *http.Client) *http.Client {
	if client == nil {
		return http.DefaultClient
	}
	clone := *client
	transport, ok := client.Transport.(*http.Transport)
	if !ok || transport == nil {
		return &clone
	}
	clonedTransport := transport.Clone()
	clonedTransport.DisableCompression = true
	clone.Transport = clonedTransport
	return &clone
}

func fetchPJMP3PageBytes(client *http.Client, request *http.Request) ([]byte, error) {
	pageClient := pjmp3PageClient(client)
	var lastErr error
	for attempt := 0; attempt < 4; attempt++ {
		req := request.Clone(request.Context())
		response, err := pageClient.Do(req)
		if err != nil {
			lastErr = err
		} else {
			body, readErr := io.ReadAll(response.Body)
			response.Body.Close()
			if readErr != nil {
				lastErr = readErr
			} else if response.StatusCode >= 200 && response.StatusCode < 300 {
				return body, nil
			} else {
				lastErr = fmt.Errorf("http %s", response.Status)
				if response.StatusCode < 500 {
					return nil, lastErr
				}
			}
		}
		if attempt < 3 {
			time.Sleep(time.Duration(180+attempt*120) * time.Millisecond)
		}
	}
	return nil, lastErr
}
