package logger

import (
	"fmt"
	"sync"
	"time"

	"github.com/fatih/color"
)

// LogCallback is a function that receives log messages
type LogCallback func(level, tag, message string)

var (
	// logCallback is called for each log message when set
	logCallback LogCallback
	callbackMu  sync.RWMutex

	// Color printers (used when no callback is set)
	gray   = color.New(color.FgHiBlack).SprintFunc()
	cyan   = color.New(color.FgCyan).SprintFunc()
	green  = color.New(color.FgGreen).SprintFunc()
	yellow = color.New(color.FgYellow).SprintFunc()
	red    = color.New(color.FgRed).SprintFunc()
)

// SetLogCallback sets the callback function for log messages
// When set, logs are sent to the callback instead of stdout
func SetLogCallback(cb LogCallback) {
	callbackMu.Lock()
	defer callbackMu.Unlock()
	logCallback = cb
}

// ClearLogCallback removes the callback and reverts to stdout
func ClearLogCallback() {
	callbackMu.Lock()
	defer callbackMu.Unlock()
	logCallback = nil
}

// timestamp returns the current time formatted as HH:MM:SS
func timestamp() string {
	return time.Now().Format("15:04:05")
}

// log sends a log message to the callback or prints to stdout
func log(level, tag, msg string, args ...interface{}) {
	formatted := fmt.Sprintf(msg, args...)

	callbackMu.RLock()
	cb := logCallback
	callbackMu.RUnlock()

	if cb != nil {
		cb(level, tag, formatted)
		return
	}

	// Fallback to stdout with colors
	ts := gray("[" + timestamp() + "]")
	var tagStr string
	switch level {
	case "SUCCESS":
		tagStr = green("[" + tag + "]")
	case "WARN":
		tagStr = yellow("[" + tag + "]")
	case "ERROR":
		tagStr = red("[" + tag + "]")
	default:
		tagStr = cyan("[" + tag + "]")
	}
	fmt.Printf("%s %s %s\n", ts, tagStr, formatted)
}

// PrintInfo prints an info message with cyan tag
func PrintInfo(tag, msg string, args ...interface{}) {
	log("INFO", tag, msg, args...)
}

// PrintSuccess prints a success message with green tag
func PrintSuccess(tag, msg string, args ...interface{}) {
	log("SUCCESS", tag, msg, args...)
}

// PrintWarn prints a warning message with yellow tag
func PrintWarn(tag, msg string, args ...interface{}) {
	log("WARN", tag, msg, args...)
}

// PrintError prints an error message with red tag
func PrintError(tag, msg string, args ...interface{}) {
	log("ERROR", tag, msg, args...)
}
