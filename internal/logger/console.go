package logger

import (
	"fmt"
	"time"

	"github.com/fatih/color"
)

// Color printers
var (
	gray   = color.New(color.FgHiBlack).SprintFunc()
	cyan   = color.New(color.FgCyan).SprintFunc()
	green  = color.New(color.FgGreen).SprintFunc()
	yellow = color.New(color.FgYellow).SprintFunc()
	red    = color.New(color.FgRed).SprintFunc()
)

// timestamp returns the current time formatted as HH:MM:SS
func timestamp() string {
	return time.Now().Format("15:04:05")
}

// PrintInfo prints an info message with cyan tag
func PrintInfo(tag, msg string, args ...interface{}) {
	formatted := fmt.Sprintf(msg, args...)
	fmt.Printf("%s %s %s\n", gray("["+timestamp()+"]"), cyan("["+tag+"]"), formatted)
}

// PrintSuccess prints a success message with green tag
func PrintSuccess(tag, msg string, args ...interface{}) {
	formatted := fmt.Sprintf(msg, args...)
	fmt.Printf("%s %s %s\n", gray("["+timestamp()+"]"), green("["+tag+"]"), formatted)
}

// PrintWarn prints a warning message with yellow tag
func PrintWarn(tag, msg string, args ...interface{}) {
	formatted := fmt.Sprintf(msg, args...)
	fmt.Printf("%s %s %s\n", gray("["+timestamp()+"]"), yellow("["+tag+"]"), formatted)
}

// PrintError prints an error message with red tag
func PrintError(tag, msg string, args ...interface{}) {
	formatted := fmt.Sprintf(msg, args...)
	fmt.Printf("%s %s %s\n", gray("["+timestamp()+"]"), red("["+tag+"]"), formatted)
}
