package cloudplayer

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"cloudplayer/backend/config"
)

var (
	logInitOnce    sync.Once
	logInitErr     error
	logFilePath    string
	logSessionPath string
	lyricTraceOn   bool
)

// InitAppLogging installs the shared desktop log sink before the runtime starts serving windows.
func InitAppLogging() error {
	logInitOnce.Do(func() {
		sharedPath, sharedErr := appLogPath()
		sessionPath, sessionErr := appSessionLogPath()
		writers := []io.Writer{os.Stderr}

		if sharedErr == nil {
			file, err := openLogFile(sharedPath)
			if err == nil {
				writers = append(writers, file)
				logFilePath = sharedPath
			} else {
				sharedErr = err
			}
		}

		if sessionErr == nil {
			file, err := openLogFile(sessionPath)
			if err == nil {
				writers = append(writers, file)
				logSessionPath = sessionPath
			} else {
				sessionErr = err
			}
		}

		if len(writers) == 1 {
			logInitErr = firstError(sharedErr, sessionErr)
			if logInitErr == nil {
				logInitErr = fmt.Errorf("no log sink available")
			}
			return
		}

		log.SetFlags(log.LstdFlags | log.Lmicroseconds)
		log.SetOutput(io.MultiWriter(writers...))
		lyricTraceOn = strings.TrimSpace(os.Getenv("CLOUDPLAYER_LYRIC_TRACE")) == "1"
		log.Printf("CloudPlayer logging ready pid=%d shared=%s session=%s", os.Getpid(), stringsTrimOrDash(logFilePath), stringsTrimOrDash(logSessionPath))
		if sharedErr != nil {
			log.Printf("CloudPlayer shared log unavailable: %v", sharedErr)
		}
		if sessionErr != nil {
			log.Printf("CloudPlayer session log unavailable: %v", sessionErr)
		}
	})
	return logInitErr
}

func HandlePanic() {
	recovered := recover()
	if recovered == nil {
		return
	}
	panicPath, _ := appPanicPath()
	text := fmt.Sprintf("panic: %v\n\n%s", recovered, debug.Stack())
	_ = os.MkdirAll(filepath.Dir(panicPath), 0o755)
	_ = os.WriteFile(panicPath, []byte(text), 0o644)
	log.Printf("CloudPlayer panic details written to %s", panicPath)
	panic(recovered)
}

func GetAppLogPath() (string, error) {
	if logFilePath != "" {
		return logFilePath, nil
	}
	if logSessionPath != "" {
		return logSessionPath, nil
	}
	return appLogPath()
}

func LogPlayEvent(stage string, url *string, errorCode *int, message *string, extra *string) {
	stageTrimmed := strings.TrimSpace(stage)
	if stageTrimmed == "lyric_sync_tick" && !lyricTraceOn {
		return
	}
	stageValue := stringsTrimOrDash(stage)
	urlValue := "-"
	if url != nil {
		urlValue = logURL160(*url)
	}
	messageValue := "-"
	if message != nil && strings.TrimSpace(*message) != "" {
		messageValue = *message
	}
	extraValue := ""
	if extra != nil {
		extraValue = *extra
	}
	line := fmt.Sprintf("pj-play webview stage=%s url=%s code=%v msg=%s extra=%s", stageValue, urlValue, errorCode, messageValue, extraValue)
	if strings.Contains(stageValue, "error") || strings.HasSuffix(stageValue, "_err") {
		log.Printf("WARN %s", line)
		return
	}
	log.Printf("INFO %s", line)
}

func lyricTraceEnabled() bool {
	return lyricTraceOn
}

func appPanicPath() (string, error) {
	path, err := appLogPath()
	if err != nil {
		return filepath.Join(config.ConfigDir(), "last_panic.txt"), nil
	}
	return filepath.Join(filepath.Dir(path), "last_panic.txt"), nil
}

func appLogPath() (string, error) {
	dir, err := appLogDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "cloudplayer.log"), nil
}

func appSessionLogPath() (string, error) {
	dir, err := appLogDir()
	if err != nil {
		dir = filepath.Join(config.ConfigDir(), "logs")
	}
	name := fmt.Sprintf("session-%s-%d.log", time.Now().Format("20060102-150405"), os.Getpid())
	return filepath.Join(dir, name), nil
}

func appLogDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return filepath.Join(config.ConfigDir(), "logs"), nil
	}
	switch runtime.GOOS {
	case "darwin":
		return filepath.Join(home, "Library", "Logs", "CloudPlayer"), nil
	case "windows":
		if dir := firstNonEmpty(os.Getenv("LOCALAPPDATA"), os.Getenv("APPDATA")); dir != "" {
			return filepath.Join(dir, "CloudPlayer", "Logs"), nil
		}
		return filepath.Join(config.ConfigDir(), "logs"), nil
	default:
		if dir := os.Getenv("XDG_STATE_HOME"); strings.TrimSpace(dir) != "" {
			return filepath.Join(dir, "CloudPlayer"), nil
		}
		return filepath.Join(home, ".local", "state", "CloudPlayer"), nil
	}
}

func openLogFile(filePath string) (*os.File, error) {
	if strings.TrimSpace(filePath) == "" {
		return nil, fmt.Errorf("log path is empty")
	}
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		return nil, err
	}
	file, err := os.OpenFile(filePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	return file, nil
}

func logURL160(value string) string {
	runes := []rune(value)
	if len(runes) <= 160 {
		return value
	}
	return string(runes[:160]) + "…"
}

func stringsTrimOrDash(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "-"
	}
	return trimmed
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func firstError(values ...error) error {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}
