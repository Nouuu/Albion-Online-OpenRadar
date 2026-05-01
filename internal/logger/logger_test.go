package logger

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
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

func TestWriteLogs_RoutesToDebugFile(t *testing.T) {
	dir := t.TempDir()
	l := New(dir, false)
	defer l.Stop()

	l.WriteLogs([]interface{}{
		map[string]interface{}{"level": "DEBUG", "category": "X", "event": "e", "data": map[string]interface{}{}},
	})
	l.Flush()

	debugLines := readDebugLines(t, dir)
	if len(debugLines) != 1 {
		t.Fatalf("debug file: want 1 line, got %d", len(debugLines))
	}
	var entry map[string]interface{}
	if err := json.Unmarshal([]byte(debugLines[0]), &entry); err != nil {
		t.Fatalf("debug line not valid JSON: %v", err)
	}
	if entry["level"] != "DEBUG" {
		t.Fatalf("level: want DEBUG, got %v", entry["level"])
	}

	sessionLines := readSessionLines(t, dir)
	if len(sessionLines) != 0 {
		t.Fatalf("sessions file: want 0 lines, got %d", len(sessionLines))
	}
}

func TestWriteLogs_ErrorAlsoRoutesToErrorsFile(t *testing.T) {
	dir := t.TempDir()
	l := New(dir, false)
	defer l.Stop()

	l.WriteLogs([]interface{}{
		map[string]interface{}{"level": "ERROR", "category": "X", "event": "e", "data": map[string]interface{}{}},
	})
	l.Flush()

	debugLines := readDebugLines(t, dir)
	if len(debugLines) != 1 {
		t.Fatalf("debug file: want 1 line, got %d", len(debugLines))
	}

	errLines := readErrorLines(t, dir)
	if len(errLines) != 1 {
		t.Fatalf("errors file: want 1 line, got %d", len(errLines))
	}
	if !strings.Contains(errLines[0], "X.e") {
		t.Fatalf("errors line: want X.e, got %q", errLines[0])
	}
}

func TestWriteLogs_CriticalAlsoRoutesToErrorsFile(t *testing.T) {
	dir := t.TempDir()
	l := New(dir, false)
	defer l.Stop()

	l.WriteLogs([]interface{}{
		map[string]interface{}{"level": "CRITICAL", "category": "X", "event": "e", "data": map[string]interface{}{}},
	})
	l.Flush()

	debugLines := readDebugLines(t, dir)
	if len(debugLines) != 1 {
		t.Fatalf("debug file: want 1 line, got %d", len(debugLines))
	}

	errLines := readErrorLines(t, dir)
	if len(errLines) != 1 {
		t.Fatalf("errors file: want 1 line, got %d", len(errLines))
	}
	if !strings.Contains(errLines[0], "X.e") {
		t.Fatalf("errors line: want X.e, got %q", errLines[0])
	}
}

func TestWriteLogs_MixedBatch_RoutesPerLevel(t *testing.T) {
	dir := t.TempDir()
	l := New(dir, false)
	defer l.Stop()

	l.WriteLogs([]interface{}{
		map[string]interface{}{"level": "INFO", "category": "INFO_CAT", "event": "info_evt", "data": nil},
		map[string]interface{}{"level": "WARN", "category": "WARN_CAT", "event": "warn_evt", "data": nil},
		map[string]interface{}{"level": "ERROR", "category": "ERR_CAT", "event": "err_evt", "data": nil},
		map[string]interface{}{"level": "CRITICAL", "category": "CRIT_CAT", "event": "crit_evt", "data": nil},
	})
	l.Flush()

	debugLines := readDebugLines(t, dir)
	if len(debugLines) != 4 {
		t.Fatalf("debug file: want 4 lines, got %d", len(debugLines))
	}

	errLines := readErrorLines(t, dir)
	if len(errLines) != 2 {
		t.Fatalf("errors file: want 2 lines, got %d", len(errLines))
	}

	hasErr := false
	hasCrit := false
	for _, line := range errLines {
		if strings.Contains(line, "ERR_CAT.err_evt") {
			hasErr = true
		}
		if strings.Contains(line, "CRIT_CAT.crit_evt") {
			hasCrit = true
		}
	}
	if !hasErr {
		t.Fatalf("errors file: no line containing ERR_CAT.err_evt; lines: %v", errLines)
	}
	if !hasCrit {
		t.Fatalf("errors file: no line containing CRIT_CAT.crit_evt; lines: %v", errLines)
	}
}

func TestLog_ErrorWritesToErrorsEvenWhenDisabled(t *testing.T) {
	dir := t.TempDir()
	l := New(dir, false)
	defer l.Stop()

	l.Error("CAT", "ev", map[string]interface{}{"k": 1}, nil)
	l.Flush()

	errLines := readErrorLines(t, dir)
	if len(errLines) != 1 {
		t.Fatalf("errors file: want 1 line, got %d", len(errLines))
	}
	if !strings.Contains(errLines[0], "CAT.ev") {
		t.Fatalf("errors line: want CAT.ev, got %q", errLines[0])
	}

	sessionLines := readSessionLines(t, dir)
	for _, line := range sessionLines {
		if strings.Contains(line, "CAT") && strings.Contains(line, "ev") {
			t.Fatalf("sessions file: unexpected CAT.ev entry when disabled: %q", line)
		}
	}
}

func TestLog_CriticalWritesToErrorsEvenWhenDisabled(t *testing.T) {
	dir := t.TempDir()
	l := New(dir, false)
	defer l.Stop()

	l.Critical("CAT", "ev", map[string]interface{}{"k": 1}, nil)
	l.Flush()

	errLines := readErrorLines(t, dir)
	if len(errLines) != 1 {
		t.Fatalf("errors file: want 1 line, got %d", len(errLines))
	}
	if !strings.Contains(errLines[0], "CAT.ev") {
		t.Fatalf("errors line: want CAT.ev, got %q", errLines[0])
	}

	sessionLines := readSessionLines(t, dir)
	for _, line := range sessionLines {
		if strings.Contains(line, "CAT") && strings.Contains(line, "ev") {
			t.Fatalf("sessions file: unexpected CAT.ev entry when disabled: %q", line)
		}
	}
}

func TestLog_ErrorWhenEnabledHitsBothFiles(t *testing.T) {
	dir := t.TempDir()
	l := New(dir, true)
	defer l.Stop()

	l.Error("CAT", "ev", map[string]interface{}{"k": 1}, nil)
	l.Flush()

	errLines := readErrorLines(t, dir)
	if len(errLines) != 1 {
		t.Fatalf("errors file: want 1 line, got %d", len(errLines))
	}
	if !strings.Contains(errLines[0], "CAT.ev") {
		t.Fatalf("errors line: want CAT.ev, got %q", errLines[0])
	}

	sessionLines := readSessionLines(t, dir)
	found := false
	for _, line := range sessionLines {
		if strings.Contains(line, "CAT") && strings.Contains(line, "ev") {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("sessions file: want CAT.ev entry when enabled, got lines: %v", sessionLines)
	}
}

func TestLog_CriticalWhenEnabledHitsBothFiles(t *testing.T) {
	dir := t.TempDir()
	l := New(dir, true)
	defer l.Stop()

	l.Critical("CAT", "ev", map[string]interface{}{"k": 1}, nil)
	l.Flush()

	errLines := readErrorLines(t, dir)
	if len(errLines) != 1 {
		t.Fatalf("errors file: want 1 line, got %d", len(errLines))
	}
	if !strings.Contains(errLines[0], "CAT.ev") {
		t.Fatalf("errors line: want CAT.ev, got %q", errLines[0])
	}

	sessionLines := readSessionLines(t, dir)
	found := false
	for _, line := range sessionLines {
		if strings.Contains(line, "CAT") && strings.Contains(line, "ev") {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("sessions file: want CAT.ev entry when enabled, got lines: %v", sessionLines)
	}
}

func TestLog_InfoWhenDisabledWritesNothing(t *testing.T) {
	dir := t.TempDir()
	l := New(dir, false)
	defer l.Stop()

	l.Info("CAT", "ev", map[string]interface{}{"k": 1}, nil)
	l.Flush()

	sessionLines := readSessionLines(t, dir)
	for _, line := range sessionLines {
		if strings.Contains(line, "CAT") && strings.Contains(line, "ev") {
			t.Fatalf("sessions file: unexpected CAT.ev entry when disabled: %q", line)
		}
	}

	errLines := readErrorLines(t, dir)
	if len(errLines) != 0 {
		t.Fatalf("errors file: want 0 lines, got %d: %v", len(errLines), errLines)
	}
}

func readDebugLines(t *testing.T, dir string) []string {
	t.Helper()
	return readNonEmptyLinesFromDir(t, filepath.Join(dir, "debug"))
}

func readSessionLines(t *testing.T, dir string) []string {
	t.Helper()
	return readNonEmptyLinesFromDir(t, filepath.Join(dir, "sessions"))
}

func readErrorLines(t *testing.T, dir string) []string {
	t.Helper()
	return readNonEmptyLinesFromDir(t, filepath.Join(dir, "errors"))
}

func readNonEmptyLinesFromDir(t *testing.T, dir string) []string {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir %s: %v", dir, err)
	}
	var lines []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			t.Fatalf("ReadFile: %v", err)
		}
		for _, line := range strings.Split(string(data), "\n") {
			if strings.TrimSpace(line) != "" {
				lines = append(lines, line)
			}
		}
	}
	return lines
}
