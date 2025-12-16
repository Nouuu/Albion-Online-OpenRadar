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

const (
	FlushInterval = 2 * time.Second
	MaxBufferSize = 500
)

type LogEntry struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Category  string                 `json:"category"`
	Event     string                 `json:"event"`
	Data      interface{}            `json:"data"`
	Context   map[string]interface{} `json:"context"`
}

type Logger struct {
	logsDir            string
	currentSessionFile string
	sessionStartTime   time.Time
	enabled            bool
	mu                 sync.Mutex

	// Batching
	buffer      []interface{}
	bufferMu    sync.Mutex
	flushTicker *time.Ticker
	stopFlush   chan struct{}

	// Stats
	totalEntries  uint64
	totalBatches  uint64
	clientEntries uint64
	serverEntries uint64
}

func New(logsDir string) *Logger {
	l := &Logger{
		logsDir:          logsDir,
		enabled:          true,
		sessionStartTime: time.Now(),
		buffer:           make([]interface{}, 0, MaxBufferSize),
		stopFlush:        make(chan struct{}),
	}
	l.initializeDirectories()
	l.createSessionFile()
	l.startFlushLoop()

	return l
}

func (l *Logger) startFlushLoop() {
	l.flushTicker = time.NewTicker(FlushInterval)
	go func() {
		for {
			select {
			case <-l.flushTicker.C:
				l.Flush()
			case <-l.stopFlush:
				l.flushTicker.Stop()
				l.Flush()
				return
			}
		}
	}()
}

func (l *Logger) Stop() {
	close(l.stopFlush)
}

func (l *Logger) PrintSessionInfo() {
	PrintInfo("LOG", "Session file: %s", l.currentSessionFile)
}

func (l *Logger) SetEnabled(enabled bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.enabled = enabled
	if enabled {
		PrintSuccess("LOG", "Server Side Logging ENABLED")
	} else {
		PrintWarn("LOG", "Server Side Logging DISABLED")
	}
}

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
			PrintError("LOG", "Failed to create directory %s: %v", dir, err)
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

// WriteLogs queues client logs for batched writing
func (l *Logger) WriteLogs(logs []interface{}) {
	if len(logs) == 0 {
		return
	}

	l.bufferMu.Lock()
	l.buffer = append(l.buffer, logs...)
	l.clientEntries += uint64(len(logs))
	shouldFlush := len(l.buffer) >= MaxBufferSize
	l.bufferMu.Unlock()

	if shouldFlush {
		l.Flush()
	}
}

// Flush writes buffered logs to file
func (l *Logger) Flush() {
	l.bufferMu.Lock()
	if len(l.buffer) == 0 {
		l.bufferMu.Unlock()
		return
	}
	batch := l.buffer
	l.buffer = make([]interface{}, 0, MaxBufferSize)
	l.bufferMu.Unlock()

	l.mu.Lock()
	defer l.mu.Unlock()

	f, err := os.OpenFile(l.currentSessionFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	for _, log := range batch {
		line, err := json.Marshal(log)
		if err != nil {
			continue
		}
		f.Write(line)
		f.WriteString("\n")
	}

	l.totalEntries += uint64(len(batch))
	l.totalBatches++
}

// Log queues a server-side log entry
func (l *Logger) Log(level, category, event string, data interface{}, context map[string]interface{}) {
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

	l.bufferMu.Lock()
	l.buffer = append(l.buffer, entry)
	l.serverEntries++
	l.bufferMu.Unlock()
}

func (l *Logger) Error(category, event string, data interface{}, context map[string]interface{}) {
	l.Log("ERROR", category, event, data, context)

	// Also write to dedicated error file immediately
	l.mu.Lock()
	defer l.mu.Unlock()

	date := time.Now().Format("2006-01-02")
	errorFile := filepath.Join(l.logsDir, "errors", fmt.Sprintf("errors_%s.log", date))

	f, err := os.OpenFile(errorFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	dataJSON, _ := json.Marshal(data)
	line := fmt.Sprintf("[%s] %s.%s: %s\n", time.Now().UTC().Format(time.RFC3339), category, event, string(dataJSON))
	f.WriteString(line)
}

func (l *Logger) Debug(category, event string, data interface{}, context map[string]interface{}) {
	l.Log("DEBUG", category, event, data, context)
}

func (l *Logger) Info(category, event string, data interface{}, context map[string]interface{}) {
	l.Log("INFO", category, event, data, context)
}

func (l *Logger) Warn(category, event string, data interface{}, context map[string]interface{}) {
	l.Log("WARN", category, event, data, context)
}

func (l *Logger) Critical(category, event string, data interface{}, context map[string]interface{}) {
	l.Log("CRITICAL", category, event, data, context)
}

type LogStats struct {
	TotalEntries  uint64 `json:"totalEntries"`
	TotalBatches  uint64 `json:"totalBatches"`
	ClientEntries uint64 `json:"clientEntries"`
	ServerEntries uint64 `json:"serverEntries"`
	BufferSize    int    `json:"bufferSize"`
}

func (l *Logger) GetStats() LogStats {
	l.bufferMu.Lock()
	bufSize := len(l.buffer)
	l.bufferMu.Unlock()

	return LogStats{
		TotalEntries:  l.totalEntries,
		TotalBatches:  l.totalBatches,
		ClientEntries: l.clientEntries,
		ServerEntries: l.serverEntries,
		BufferSize:    bufSize,
	}
}

type SessionStats struct {
	SessionFile     string `json:"sessionFile"`
	LineCount       int    `json:"lineCount"`
	FileSize        int64  `json:"fileSize"`
	SessionDuration int    `json:"sessionDuration"`
}

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

	f, err := os.Open(l.currentSessionFile)
	if err != nil {
		return stats
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		if len(strings.TrimSpace(scanner.Text())) > 0 {
			stats.LineCount++
		}
	}

	return stats
}
