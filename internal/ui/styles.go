package ui

import "github.com/charmbracelet/lipgloss"

// Colors
var (
	ColorPrimary   = lipgloss.Color("#00D4FF") // Cyan
	ColorSuccess   = lipgloss.Color("#00FF88") // Green
	ColorWarning   = lipgloss.Color("#FFD700") // Yellow
	ColorError     = lipgloss.Color("#FF4444") // Red
	ColorMuted     = lipgloss.Color("#666666") // Gray
	ColorBorder    = lipgloss.Color("#444444") // Dark gray
	ColorHighlight = lipgloss.Color("#FFFFFF") // White
)

// Styles
var (
	// Header styles
	HeaderStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(ColorHighlight).
			Background(lipgloss.Color("#1a1a2e")).
			Padding(0, 1)

	TitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(ColorPrimary)

	URLStyle = lipgloss.NewStyle().
			Foreground(ColorSuccess)

	ModeStyle = lipgloss.NewStyle().
			Foreground(ColorWarning)

	// Log styles
	LogInfoStyle = lipgloss.NewStyle().
			Foreground(ColorPrimary)

	LogSuccessStyle = lipgloss.NewStyle().
			Foreground(ColorSuccess)

	LogWarnStyle = lipgloss.NewStyle().
			Foreground(ColorWarning)

	LogErrorStyle = lipgloss.NewStyle().
			Foreground(ColorError)

	TimestampStyle = lipgloss.NewStyle().
			Foreground(ColorMuted)

	TagStyle = lipgloss.NewStyle().
			Bold(true)

	// Footer styles
	FooterStyle = lipgloss.NewStyle().
			Foreground(ColorMuted).
			Padding(0, 1)

	StatLabelStyle = lipgloss.NewStyle().
			Foreground(ColorMuted)

	StatValueStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(ColorHighlight)

	HelpStyle = lipgloss.NewStyle().
			Foreground(ColorMuted).
			Italic(true)

	// Border styles
	BorderStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(ColorBorder)

	// Viewport style
	ViewportStyle = lipgloss.NewStyle().
			Padding(0, 1)

	// Tab styles
	TabStyle = lipgloss.NewStyle().
			Foreground(ColorMuted).
			Padding(0, 1)

	TabActiveStyle = lipgloss.NewStyle().
			Foreground(ColorPrimary).
			Bold(true).
			Padding(0, 1).
			Underline(true)

	// Status indicator styles
	StatusOnStyle = lipgloss.NewStyle().
			Foreground(ColorSuccess)

	StatusOffStyle = lipgloss.NewStyle().
			Foreground(ColorError)
)

// GetTagStyle returns the appropriate style for a log tag
func GetTagStyle(level string) lipgloss.Style {
	switch level {
	case "SUCCESS":
		return TagStyle.Foreground(ColorSuccess)
	case "WARN":
		return TagStyle.Foreground(ColorWarning)
	case "ERROR":
		return TagStyle.Foreground(ColorError)
	default:
		return TagStyle.Foreground(ColorPrimary)
	}
}
