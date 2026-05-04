package httpclient

import (
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"time"

	"cloudplayer/backend/core/cloudplayer/config"
	"cloudplayer/backend/core/cloudplayer/systemproxy"
)

// New constructs the shared HTTP client with timeout, cookie jar and proxy behavior applied.

const requestTimeout = 45 * time.Second

func NewJar() *cookiejar.Jar {
	jar, _ := cookiejar.New(nil)
	return jar
}

func Build(settings config.Settings, jar http.CookieJar) (*http.Client, error) {
	transport := &http.Transport{
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          64,
		MaxIdleConnsPerHost:   8,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	switch config.NormalizeNetworkProxyMode(settings.NetworkProxyMode) {
	case config.NetworkProxyModeSystem:
		proxyFunc, err := systemproxy.ProxyFunc()
		if err != nil {
			return nil, err
		}
		transport.Proxy = proxyFunc
	case config.NetworkProxyModeCustom:
		proxyURL, err := proxyURLFromSettings(settings)
		if err != nil {
			return nil, err
		}
		if proxyURL == nil {
			return nil, fmt.Errorf("请先填写自定义代理地址")
		}
		transport.Proxy = http.ProxyURL(proxyURL)
	}

	return &http.Client{
		Timeout:   requestTimeout,
		Jar:       jar,
		Transport: transport,
	}, nil
}

func proxyURLFromSettings(settings config.Settings) (*url.URL, error) {
	normalized, err := config.NormalizeNetworkProxyURL(settings.NetworkProxyURL)
	if err != nil {
		return nil, err
	}
	if normalized == "" {
		return nil, nil
	}
	parsed, err := url.Parse(normalized)
	if err != nil {
		return nil, err
	}
	return parsed, nil
}
