package cloudplayer

import (
	"os/exec"
	"path/filepath"
	"runtime"
)

// Log-location helpers stay separate so settings actions do not bloat the main settings service file.
func (s *CloudPlayerService) OpenAppLogLocation() error {
	logPath, err := GetAppLogPath()
	if err != nil {
		return err
	}
	return logLocationOpenError(revealPathInFileManager(logPath))
}

func revealPathInFileManager(targetPath string) error {
	resolved := filepath.Clean(targetPath)
	switch runtime.GOOS {
	case "windows":
		return exec.Command("explorer.exe", "/select,", resolved).Start()
	case "darwin":
		return exec.Command("open", "-R", resolved).Start()
	default:
		dir := filepath.Dir(resolved)
		if dir == "" || dir == "." {
			dir = resolved
		}
		return exec.Command("xdg-open", dir).Start()
	}
}

func logLocationOpenError(err error) error { return err }
