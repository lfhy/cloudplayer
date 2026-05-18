package cloudplayer

import (
	"errors"
	"testing"
)

// SQLite retry tests pin the lock-competition behavior used by mode switching and playlist refreshes.
func TestWithSQLiteBusyRetryRetriesBusyErrors(t *testing.T) {
	attempts := 0
	err := withSQLiteBusyRetry(func() error {
		attempts++
		if attempts < 3 {
			return errors.New("database is locked (5) (SQLITE_BUSY)")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("withSQLiteBusyRetry() error = %v", err)
	}
	if attempts != 3 {
		t.Fatalf("withSQLiteBusyRetry() attempts = %d, want 3", attempts)
	}
}

func TestWithSQLiteBusyRetryStopsOnNonBusyErrors(t *testing.T) {
	attempts := 0
	wantErr := errors.New("boom")
	err := withSQLiteBusyRetry(func() error {
		attempts++
		return wantErr
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("withSQLiteBusyRetry() error = %v, want %v", err, wantErr)
	}
	if attempts != 1 {
		t.Fatalf("withSQLiteBusyRetry() attempts = %d, want 1", attempts)
	}
}
