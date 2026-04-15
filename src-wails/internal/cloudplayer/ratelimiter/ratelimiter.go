package ratelimiter

import (
	"sync"
	"time"
)

type Limiter struct {
	maxPerMinute int
	mu           sync.Mutex
	timestamps   []time.Time
}

func New(maxPerMinute int) *Limiter {
	if maxPerMinute < 1 {
		maxPerMinute = 1
	}
	return &Limiter{maxPerMinute: maxPerMinute}
}

func (l *Limiter) AcquireSlot() {
	for {
		wait := l.reserve()
		if wait <= 0 {
			return
		}
		time.Sleep(wait)
	}
}

func (l *Limiter) reserve() time.Duration {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-time.Minute)
	filtered := l.timestamps[:0]
	for _, ts := range l.timestamps {
		if ts.After(cutoff) {
			filtered = append(filtered, ts)
		}
	}
	l.timestamps = filtered
	if len(l.timestamps) < l.maxPerMinute {
		l.timestamps = append(l.timestamps, now)
		return 0
	}
	wait := time.Minute - now.Sub(l.timestamps[0]) + 50*time.Millisecond
	if wait < 50*time.Millisecond {
		wait = 50 * time.Millisecond
	}
	return wait
}
