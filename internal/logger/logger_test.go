package logger

import (
	"testing"
)

func TestNew_RespectsInitialEnabled(t *testing.T) {
	l := New(t.TempDir(), true)
	defer l.Stop()

	if !l.IsEnabled() {
		t.Fatal("IsEnabled: got false, want true")
	}
}

func TestNew_RespectsInitialDisabled(t *testing.T) {
	l := New(t.TempDir(), false)
	defer l.Stop()

	if l.IsEnabled() {
		t.Fatal("IsEnabled: got true, want false")
	}
}
