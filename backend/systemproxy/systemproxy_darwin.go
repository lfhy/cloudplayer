//go:build darwin

package systemproxy

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"strconv"
	"strings"
)

type snapshot struct {
	httpEnabled  bool
	httpHost     string
	httpPort     int
	httpsEnabled bool
	httpsHost    string
	httpsPort    int
	socksEnabled bool
	socksHost    string
	socksPort    int
	exceptions   []string
}

func ProxyFunc() (func(*http.Request) (*url.URL, error), error) {
	cfg, err := readSnapshot()
	if err != nil {
		return nil, err
	}

	httpURL := buildURL("http", cfg.httpHost, cfg.httpPort)
	httpsURL := buildURL("http", cfg.httpsHost, cfg.httpsPort)
	socksURL := buildURL("socks5", cfg.socksHost, cfg.socksPort)

	return func(request *http.Request) (*url.URL, error) {
		if request == nil || request.URL == nil {
			return nil, nil
		}
		host := strings.TrimSpace(request.URL.Hostname())
		if shouldBypass(host, cfg.exceptions) {
			return nil, nil
		}

		switch strings.ToLower(strings.TrimSpace(request.URL.Scheme)) {
		case "https":
			if cfg.httpsEnabled && httpsURL != nil {
				return httpsURL, nil
			}
			if cfg.socksEnabled && socksURL != nil {
				return socksURL, nil
			}
			if cfg.httpEnabled && httpURL != nil {
				return httpURL, nil
			}
		default:
			if cfg.httpEnabled && httpURL != nil {
				return httpURL, nil
			}
			if cfg.socksEnabled && socksURL != nil {
				return socksURL, nil
			}
			if cfg.httpsEnabled && httpsURL != nil {
				return httpsURL, nil
			}
		}
		return nil, nil
	}, nil
}

func readSnapshot() (snapshot, error) {
	command := exec.Command("/usr/sbin/scutil", "--proxy")
	output, err := command.Output()
	if err != nil {
		return snapshot{}, fmt.Errorf("读取系统代理失败: %w", err)
	}

	var cfg snapshot
	inExceptions := false
	for _, rawLine := range strings.Split(string(output), "\n") {
		line := strings.TrimSpace(rawLine)
		if line == "" || line == "<dictionary> {" {
			continue
		}
		if strings.HasPrefix(line, "ExceptionsList") {
			inExceptions = true
			continue
		}
		if inExceptions {
			if line == "}" {
				inExceptions = false
				continue
			}
			key, value, ok := splitKeyValue(line)
			if ok && key != "" && value != "" {
				cfg.exceptions = append(cfg.exceptions, value)
			}
			continue
		}
		key, value, ok := splitKeyValue(line)
		if !ok {
			continue
		}
		switch key {
		case "HTTPEnable":
			cfg.httpEnabled = value == "1"
		case "HTTPProxy":
			cfg.httpHost = value
		case "HTTPPort":
			cfg.httpPort = parsePort(value)
		case "HTTPSEnable":
			cfg.httpsEnabled = value == "1"
		case "HTTPSProxy":
			cfg.httpsHost = value
		case "HTTPSPort":
			cfg.httpsPort = parsePort(value)
		case "SOCKSEnable":
			cfg.socksEnabled = value == "1"
		case "SOCKSProxy":
			cfg.socksHost = value
		case "SOCKSPort":
			cfg.socksPort = parsePort(value)
		}
	}
	return cfg, nil
}

func splitKeyValue(line string) (string, string, bool) {
	parts := strings.SplitN(line, ":", 2)
	if len(parts) != 2 {
		return "", "", false
	}
	key := strings.TrimSpace(parts[0])
	value := strings.TrimSpace(parts[1])
	if key == "" {
		return "", "", false
	}
	return key, value, true
}

func parsePort(value string) int {
	port, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return 0
	}
	return port
}

func buildURL(scheme, host string, port int) *url.URL {
	host = strings.TrimSpace(host)
	if host == "" || port <= 0 {
		return nil
	}
	return &url.URL{
		Scheme: scheme,
		Host:   net.JoinHostPort(host, strconv.Itoa(port)),
	}
}

func shouldBypass(host string, exceptions []string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	if host == "" {
		return false
	}

	ip := net.ParseIP(host)
	for _, raw := range exceptions {
		item := strings.ToLower(strings.TrimSpace(raw))
		if item == "" {
			continue
		}
		switch {
		case item == "<local>":
			if ip == nil && !strings.Contains(host, ".") {
				return true
			}
		case strings.HasPrefix(item, "*."):
			suffix := strings.TrimPrefix(item, "*")
			if strings.HasSuffix(host, suffix) {
				return true
			}
		case strings.Contains(item, "/"):
			if ip == nil {
				continue
			}
			if _, block, err := net.ParseCIDR(item); err == nil && block.Contains(ip) {
				return true
			}
		default:
			if host == item || strings.HasSuffix(host, "."+strings.TrimPrefix(item, ".")) {
				return true
			}
		}
	}
	return false
}
