//go:build android || ios

package cloudplayer

// Mobile bridge builds do not manage native desktop window chrome.
func syncMainWindowTheme(string) {}
