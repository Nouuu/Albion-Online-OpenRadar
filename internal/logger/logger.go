package logger

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// LogEntry represents a single log entry
type LogEntry struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Category  string                 `json:"category"`
	Event     string                 `json:"event"`
	Data      interface{}            `json:"data"`
	Context   map[string]interface{} `json:"context"`
}

// Logger handles server-side logging with JSONL persistence
type Logger struct {
	logsDir            string
	currentSessionFile string
	sessionStartTime   time.Time
	enabled            bool
	mu                 sync.Mutex
}

// New creates a new Logger instance
func New(logsDir string) *Logger {
	l := &Logger{
		logsDir:          logsDir,
		enabled:          true,
		sessionStartTime: time.Now(),
	}
	l.initializeDirectories()
	l.createSessionFile()

	fmt.Printf("[Logger] Session file: %s\n", l.currentSessionFile)
	fmt.Printf("[Logger] Logging enabled: %v\n", l.enabled)

	return l
}

// SetEnabled enables or disables logging
func (l *Logger) SetEnabled(enabled bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.enabled = enabled
	state := "DISABLED"
	if enabled {
		state = "ENABLED"
	}
	fmt.Printf("[Logger] Logging %s\n", state)
}

// IsEnabled returns current logging state
func (l *Logger) IsEnabled() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.enabled
}

func (l *Logger) initializeDirectories() {
	dirs := []string{
		filepath.Join(l.logsDir, "sessions"),
		filepath.Join(l.logsDir, "errors"),
		filepath.Join(l.logsDir, "debug"),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			fmt.Printf("[Logger] Failed to create directory %s: %v\n", dir, err)
		}
	}
}

func (l *Logger) createSessionFile() {
	timestamp := strings.ReplaceAll(time.Now().Format("2006-01-02T15-04-05"), ":", "-")
	l.currentSessionFile = filepath.Join(
		l.logsDir,
		"sessions",
		fmt.Sprintf("session_%s.jsonl", timestamp),
	)
}

// WriteLogs writes an array of log entries to the session file
func (l *Logger) WriteLogs(logs []interface{}) {
	if len(logs) == 0 {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	if !l.enabled {
		return
	}

	f, err := os.OpenFile(l.currentSessionFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Printf("[Logger] Error opening log file: %v\n", err)
		return
	}
	defer func(f *os.File) {
		_ = f.Close()
	}(f)

	for _, log := range logs {
		line, err := json.Marshal(log)
		if err != nil {
			continue
		}
		_, _ = f.Write(line)
		_, _ = f.WriteString("\n")
	}
}

// Log writes a single log entry
func (l *Logger) Log(
	level, category, event string,
	data interface{},
	context map[string]interface{},
) {
	l.mu.Lock()
	if !l.enabled {
		l.mu.Unlock()
		return
	}
	l.mu.Unlock()

	if context == nil {
		context = make(map[string]interface{})
	}
	context["sessionDuration"] = int(time.Since(l.sessionStartTime).Seconds())

	entry := LogEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Level:     level,
		Category:  "[SERVER] " + category,
		Event:     event,
		Data:      data,
		Context:   context,
	}

	l.WriteLogs([]interface{}{entry})
}

// Error logs an error and writes to dedicated error file
func (l *Logger) Error(category, event string, data interface{}, context map[string]interface{}) {
	l.Log("ERROR", category, event, data, context)

	// Also write to dedicated error file
	l.mu.Lock()
	defer l.mu.Unlock()

	date := time.Now().Format("2006-01-02")
	errorFile := filepath.Join(l.logsDir, "errors", fmt.Sprintf("errors_%s.log", date))

	f, err := os.OpenFile(errorFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Printf("[Logger] Failed to open error file: %v\n", err)
		return
	}
	defer func(f *os.File) {
		_ = f.Close()
	}(f)

	dataJSON, err := json.Marshal(data)
	if err != nil {
		dataJSON = []byte(fmt.Sprintf(`{"error":"marshal failed: %v"}`, err))
	}
	line := fmt.Sprintf(
		"[%s] %s.%s: %s\n",
		time.Now().UTC().Format(time.RFC3339),
		category,
		event,
		string(dataJSON),
	)
	_, _ = f.WriteString(line)
}

// Debug logs a debug message
func (l *Logger) Debug(category, event string, data interface{}, context map[string]interface{}) {
	l.Log("DEBUG", category, event, data, context)
}

// Info logs an info message
func (l *Logger) Info(category, event string, data interface{}, context map[string]interface{}) {
	l.Log("INFO", category, event, data, context)
}

// Warn logs a warning message
func (l *Logger) Warn(category, event string, data interface{}, context map[string]interface{}) {
	l.Log("WARN", category, event, data, context)
}

// Critical logs a critical message
func (l *Logger) Critical(
	category, event string,
	data interface{},
	context map[string]interface{},
) {
	l.Log("CRITICAL", category, event, data, context)
}

// SessionStats contains session statistics
type SessionStats struct {
	SessionFile     string `json:"sessionFile"`
	LineCount       int    `json:"lineCount"`
	FileSize        int64  `json:"fileSize"`
	SessionDuration int    `json:"sessionDuration"`
}

// GetSessionStats returns session statistics
func (l *Logger) GetSessionStats() SessionStats {
	l.mu.Lock()
	defer l.mu.Unlock()

	stats := SessionStats{
		SessionFile:     l.currentSessionFile,
		SessionDuration: int(time.Since(l.sessionStartTime).Seconds()),
	}

	info, err := os.Stat(l.currentSessionFile)
	if err != nil {
		return stats
	}

	stats.FileSize = info.Size()

	// Count lines efficiently using streaming (avoid loading entire file into memory)
	f, err := os.Open(l.currentSessionFile)
	if err != nil {
		return stats
	}
	defer func(f *os.File) {
		_ = f.Close()
	}(f)

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		if len(strings.TrimSpace(scanner.Text())) > 0 {
			stats.LineCount++
		}
	}

	return stats
}
