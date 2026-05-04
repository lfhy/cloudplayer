//go:build !darwin

package systemproxy

import (
	"net/http"
	"net/url"
)

func ProxyFunc() (func(*http.Request) (*url.URL, error), error) {
	return http.ProxyFromEnvironment, nil
}
