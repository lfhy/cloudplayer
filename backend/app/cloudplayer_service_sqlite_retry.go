package cloudplayer

import (
	"strings"
	"time"
)

const sqliteBusyRetryDelay = 140 * time.Millisecond
const sqliteBusyRetryLimit = 4

// SQLite busy retries are scoped to short UI-triggered races so real database errors still surface immediately.
func withSQLiteBusyRetry(run func() error) error {
	_, err := withSQLiteBusyRetryValue(func() (struct{}, error) {
		return struct{}{}, run()
	})
	return err
}

func withSQLiteBusyRetryValue[T any](run func() (T, error)) (T, error) {
	var zero T
	var lastErr error
	for attempt := 0; attempt < sqliteBusyRetryLimit; attempt++ {
		value, err := run()
		if err == nil {
			return value, nil
		}
		if !isSQLiteBusyError(err) {
			return zero, err
		}
		lastErr = err
		if attempt == sqliteBusyRetryLimit-1 {
			break
		}
		time.Sleep(time.Duration(attempt+1) * sqliteBusyRetryDelay)
	}
	return zero, lastErr
}

func isSQLiteBusyError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "sqlite_busy") ||
		strings.Contains(message, "database is locked") ||
		strings.Contains(message, "database table is locked")
}
