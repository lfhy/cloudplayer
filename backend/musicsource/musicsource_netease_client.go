package musicsource

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	neteaseReferer = "https://music.163.com/"
	neteaseUA      = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)

// neteaseWEAPIPost sends one WEAPI encrypted form request and decodes JSON into out.
func neteaseWEAPIPost(client *http.Client, endpoint string, payload any, out any) error {
	requestPayload := neteasePayloadWithCSRF(payload, neteaseFindCSRFToken(client, endpoint))
	form, err := neteaseWEAPIForm(requestPayload)
	if err != nil {
		return err
	}

	csrfToken := neteaseFindCSRFToken(client, endpoint)
	values := url.Values{}
	values.Set("csrf_token", csrfToken)
	requestURL := endpoint
	if strings.Contains(endpoint, "?") {
		requestURL += "&" + values.Encode()
	} else {
		requestURL += "?" + values.Encode()
	}

	request, err := http.NewRequest(http.MethodPost, requestURL, strings.NewReader(url.Values{
		"params":    []string{form["params"]},
		"encSecKey": []string{form["encSecKey"]},
	}.Encode()))
	if err != nil {
		return err
	}
	neteaseApplyHeaders(request)
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.AddCookie(&http.Cookie{Name: "__remember_me", Value: "true"})

	response, err := client.Do(request)
	if err != nil {
		log.Printf("netease weapi request failed endpoint=%s err=%v", endpoint, err)
		return err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		log.Printf("netease weapi bad status endpoint=%s status=%d", endpoint, response.StatusCode)
		return fmt.Errorf("netease request failed: http %d", response.StatusCode)
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(body, out); err != nil {
		log.Printf("netease weapi decode failed endpoint=%s body=%s err=%v", endpoint, strings.TrimSpace(string(body)), err)
		return fmt.Errorf("netease decode json failed: %w", err)
	}
	return nil
}

func neteasePayloadWithCSRF(payload any, csrfToken string) map[string]any {
	merged := map[string]any{}
	if current, ok := payload.(map[string]any); ok {
		for key, value := range current {
			merged[key] = value
		}
	}
	merged["csrf_token"] = strings.TrimSpace(csrfToken)
	return merged
}

func neteaseApplyHeaders(request *http.Request) {
	request.Header.Set("Accept", "*/*")
	request.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	request.Header.Set("Referer", neteaseReferer)
	request.Header.Set("User-Agent", neteaseUA)
	request.Header.Set("Origin", "https://music.163.com")
	request.Header.Set("Connection", "keep-alive")
	request.Header.Set("Pragma", "no-cache")
	request.Header.Set("Cache-Control", "no-cache")
}

func neteaseApplyPortalHeaders(request *http.Request) {
	request.Header.Set("Accept", "application/json, text/plain, */*")
	request.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	request.Header.Set("Referer", neteaseReferer)
	request.Header.Set("User-Agent", neteaseUA)
}

func neteaseFindCSRFToken(client *http.Client, rawURL string) string {
	if client == nil || client.Jar == nil {
		return ""
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	for _, cookie := range client.Jar.Cookies(parsed) {
		switch strings.TrimSpace(cookie.Name) {
		case "__csrf", "__csrf_token":
			return strings.TrimSpace(cookie.Value)
		}
	}
	return ""
}

func neteaseDefaultClient(client *http.Client) *http.Client {
	if client != nil {
		return client
	}
	return &http.Client{Timeout: 30 * time.Second}
}
