package httpclient

import "net/http"

// StreamingClone keeps proxy/cookie behavior but removes the overall request timeout for long-lived media streams.
func StreamingClone(client *http.Client) *http.Client {
	if client == nil {
		return &http.Client{}
	}
	clone := *client
	clone.Timeout = 0
	if transport, ok := client.Transport.(*http.Transport); ok && transport != nil {
		clone.Transport = transport.Clone()
	}
	return &clone
}
