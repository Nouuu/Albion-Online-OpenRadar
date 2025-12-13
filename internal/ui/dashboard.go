package ui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

const (
	headerHeight    = 5
	footerHeight    = 5
	maxLogs         = 1000
	sparklineLength = 30
)

// View tabs
type ViewTab int

const (
	TabLogs ViewTab = iota
	TabStats
	TabConfig
)

// Log levels for filtering
type LogLevel int

const (
	LevelAll LogLevel = iota
	LevelInfo
	LevelSuccess
	LevelWarn
	LevelError
)

// Message types
type LogMsg struct {
	Level   string
	Tag     string
	Message string
}

type StatsMsg struct {
	Packets    uint64
	Errors     uint64
	WsClients  int
	MemoryMB   float64
	Goroutines int
}

type StatusMsg struct {
	HTTPRunning    bool
	WSRunning      bool
	CaptureRunning bool
}

type RestartMsg struct{}

type TickMsg time.Time

// LogEntry stores a log with its metadata
type LogEntry struct {
	Time     time.Time
	Level    string
	Tag      string
	Message  string
	Rendered string
}

// Dashboard is the main Bubble Tea model
type Dashboard struct {
	ready            bool
	quitting         bool
	restartRequested bool

	// Static info
	version   string
	serverURL string
	wsURL     string
	mode      string
	adapterIP string

	// Status indicators
	httpRunning    bool
	wsRunning      bool
	captureRunning bool

	// Real-time stats
	packets    uint64
	errors     uint64
	wsClients  int
	memoryMB   float64
	goroutines int
	startTime  time.Time

	// Sparkline history
	packetsHistory []uint64
	memoryHistory  []float64
	lastPackets    uint64

	// Components
	viewport    viewport.Model
	searchInput textinput.Model
	logs        []LogEntry

	// UI State
	currentTab  ViewTab
	logFilter   LogLevel
	autoScroll  bool
	searching   bool
	searchQuery string

	// Dimensions
	width  int
	height int
}

// NewDashboard creates a new dashboard model
func NewDashboard(version string, port int, devMode bool, adapterIP string) Dashboard {
	mode := "Production"
	if devMode {
		mode = "Development"
	}

	ti := textinput.New()
	ti.Placeholder = "Search logs..."
	ti.CharLimit = 50

	return Dashboard{
		version:        version,
		serverURL:      fmt.Sprintf("http://localhost:%d", port),
		wsURL:          fmt.Sprintf("ws://localhost:%d/ws", port),
		mode:           mode,
		adapterIP:      adapterIP,
		startTime:      time.Now(),
		logs:           make([]LogEntry, 0, maxLogs),
		packetsHistory: make([]uint64, 0, sparklineLength),
		memoryHistory:  make([]float64, 0, sparklineLength),
		autoScroll:     true,
		currentTab:     TabLogs,
		logFilter:      LevelAll,
		searchInput:    ti,
	}
}

// RestartRequested returns true if user requested a restart
func (d Dashboard) RestartRequested() bool {
	return d.restartRequested
}

// Init initializes the dashboard
func (d Dashboard) Init() tea.Cmd {
	return tea.Batch(tickCmd(), tea.EnterAltScreen)
}

func tickCmd() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return TickMsg(t)
	})
}

// Update handles messages
func (d Dashboard) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var (
		cmd  tea.Cmd
		cmds []tea.Cmd
	)

	// Handle search input mode
	if d.searching {
		switch msg := msg.(type) {
		case tea.KeyMsg:
			switch msg.String() {
			case "enter":
				d.searchQuery = d.searchInput.Value()
				d.searching = false
				d.viewport.SetContent(d.renderLogs())
			case "esc":
				d.searching = false
				d.searchInput.SetValue("")
				d.searchQuery = ""
				d.viewport.SetContent(d.renderLogs())
			default:
				d.searchInput, cmd = d.searchInput.Update(msg)
				cmds = append(cmds, cmd)
			}
		}
		return d, tea.Batch(cmds...)
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			d.quitting = true
			return d, tea.Quit
		case "r":
			d.restartRequested = true
			d.quitting = true
			return d, tea.Quit
		case "g":
			d.viewport.GotoTop()
			return d, nil
		case "G":
			d.viewport.GotoBottom()
			return d, nil
		case "p":
			d.autoScroll = !d.autoScroll
			return d, nil
		case "c":
			d.logs = make([]LogEntry, 0, maxLogs)
			d.viewport.SetContent(d.renderLogs())
			return d, nil
		case "f":
			d.logFilter = (d.logFilter + 1) % 5
			d.viewport.SetContent(d.renderLogs())
			return d, nil
		case "/":
			d.searching = true
			d.searchInput.Focus()
			return d, textinput.Blink
		case "1":
			d.currentTab = TabLogs
			return d, nil
		case "2":
			d.currentTab = TabStats
			return d, nil
		case "3":
			d.currentTab = TabConfig
			return d, nil
		case "tab":
			d.currentTab = (d.currentTab + 1) % 3
			return d, nil
		}

	case tea.WindowSizeMsg:
		d.width = msg.Width
		d.height = msg.Height

		viewportHeight := d.height - headerHeight - footerHeight - 2
		if !d.ready {
			d.viewport = viewport.New(d.width-2, viewportHeight)
			d.viewport.SetContent(d.renderLogs())
			d.ready = true
		} else {
			d.viewport.Width = d.width - 2
			d.viewport.Height = viewportHeight
		}

	case LogMsg:
		d.addLog(msg)
		d.viewport.SetContent(d.renderLogs())
		if d.autoScroll {
			d.viewport.GotoBottom()
		}

	case StatsMsg:
		// Update sparkline history
		packetsDiff := msg.Packets - d.lastPackets
		d.lastPackets = msg.Packets
		d.packetsHistory = append(d.packetsHistory, packetsDiff)
		if len(d.packetsHistory) > sparklineLength {
			d.packetsHistory = d.packetsHistory[1:]
		}

		d.memoryHistory = append(d.memoryHistory, msg.MemoryMB)
		if len(d.memoryHistory) > sparklineLength {
			d.memoryHistory = d.memoryHistory[1:]
		}

		d.packets = msg.Packets
		d.errors = msg.Errors
		d.wsClients = msg.WsClients
		d.memoryMB = msg.MemoryMB
		d.goroutines = msg.Goroutines

	case StatusMsg:
		d.httpRunning = msg.HTTPRunning
		d.wsRunning = msg.WSRunning
		d.captureRunning = msg.CaptureRunning

	case TickMsg:
		cmds = append(cmds, tickCmd())
	}

	// Only pass non-key messages to viewport (scroll is handled by arrow keys internally)
	if _, isKey := msg.(tea.KeyMsg); !isKey {
		d.viewport, cmd = d.viewport.Update(msg)
		cmds = append(cmds, cmd)
	} else {
		// Pass only arrow keys to viewport for scrolling
		if key, ok := msg.(tea.KeyMsg); ok {
			switch key.String() {
			case "up", "down", "pgup", "pgdown":
				d.viewport, cmd = d.viewport.Update(msg)
				cmds = append(cmds, cmd)
			}
		}
	}

	return d, tea.Batch(cmds...)
}

func (d *Dashboard) addLog(log LogMsg) {
	entry := LogEntry{
		Time:    time.Now(),
		Level:   log.Level,
		Tag:     log.Tag,
		Message: log.Message,
	}

	// Pre-render the log line
	ts := TimestampStyle.Render(fmt.Sprintf("[%s]", entry.Time.Format("15:04:05")))
	tag := GetTagStyle(log.Level).Render(fmt.Sprintf("[%s]", log.Tag))
	entry.Rendered = fmt.Sprintf("%s %s %s", ts, tag, log.Message)

	d.logs = append(d.logs, entry)

	if len(d.logs) > maxLogs {
		d.logs = d.logs[len(d.logs)-maxLogs:]
	}
}

func (d *Dashboard) filterLogs() []LogEntry {
	if d.logFilter == LevelAll && d.searchQuery == "" {
		return d.logs
	}

	filtered := make([]LogEntry, 0)
	for _, log := range d.logs {
		// Filter by level
		if d.logFilter != LevelAll {
			switch d.logFilter {
			case LevelInfo:
				if log.Level != "INFO" {
					continue
				}
			case LevelSuccess:
				if log.Level != "SUCCESS" {
					continue
				}
			case LevelWarn:
				if log.Level != "WARN" {
					continue
				}
			case LevelError:
				if log.Level != "ERROR" {
					continue
				}
			}
		}

		// Filter by search query
		if d.searchQuery != "" {
			if !strings.Contains(strings.ToLower(log.Message), strings.ToLower(d.searchQuery)) &&
				!strings.Contains(strings.ToLower(log.Tag), strings.ToLower(d.searchQuery)) {
				continue
			}
		}

		filtered = append(filtered, log)
	}
	return filtered
}

func (d *Dashboard) renderLogs() string {
	logs := d.filterLogs()
	if len(logs) == 0 {
		if d.searchQuery != "" {
			return TimestampStyle.Render(fmt.Sprintf("  No logs matching '%s'", d.searchQuery))
		}
		return TimestampStyle.Render("  Waiting for logs...")
	}

	lines := make([]string, len(logs))
	for i, log := range logs {
		lines[i] = log.Rendered
	}
	return strings.Join(lines, "\n")
}

// View renders the dashboard
func (d Dashboard) View() string {
	if d.quitting {
		return ""
	}

	if !d.ready {
		return "Initializing..."
	}

	header := d.renderHeader()

	var content string
	switch d.currentTab {
	case TabLogs:
		content = BorderStyle.Width(d.width - 2).Render(d.viewport.View())
	case TabStats:
		content = BorderStyle.Width(d.width - 2).Render(d.renderStatsView())
	case TabConfig:
		content = BorderStyle.Width(d.width - 2).Render(d.renderConfigView())
	}

	footer := d.renderFooter()

	return lipgloss.JoinVertical(lipgloss.Left, header, content, footer)
}

func (d *Dashboard) renderHeader() string {
	// Title and status indicators
	title := TitleStyle.Render(fmt.Sprintf("OpenRadar v%s", d.version))

	httpStatus := statusIndicator(d.httpRunning, "HTTP")
	wsStatus := statusIndicator(d.wsRunning, "WS")
	captureStatus := statusIndicator(d.captureRunning, "CAP")
	status := fmt.Sprintf("%s %s %s", httpStatus, wsStatus, captureStatus)

	// Mode and adapter
	mode := ModeStyle.Render(fmt.Sprintf("Mode: %s", d.mode))
	adapter := TimestampStyle.Render(fmt.Sprintf("Adapter: %s", d.adapterIP))

	// URLs
	httpURL := URLStyle.Render(d.serverURL)
	wsURL := URLStyle.Render(d.wsURL)

	// Started time
	startedAt := TimestampStyle.Render(fmt.Sprintf("Started: %s", d.startTime.Format("15:04:05")))

	// Tabs
	tabs := d.renderTabs()

	left := lipgloss.JoinVertical(lipgloss.Left, title, mode, adapter, startedAt)
	right := lipgloss.JoinVertical(lipgloss.Right, status, httpURL, wsURL, "")

	leftWidth := lipgloss.Width(left)
	rightWidth := lipgloss.Width(right)
	spacing := d.width - leftWidth - rightWidth - 4
	if spacing < 1 {
		spacing = 1
	}

	row := lipgloss.JoinHorizontal(lipgloss.Top, left, strings.Repeat(" ", spacing), right)
	headerContent := lipgloss.JoinVertical(lipgloss.Left, row, tabs)

	return HeaderStyle.Width(d.width).Render(headerContent)
}

func (d *Dashboard) renderTabs() string {
	tabs := []string{"[1] Logs", "[2] Stats", "[3] Config"}
	rendered := make([]string, len(tabs))

	for i, tab := range tabs {
		if ViewTab(i) == d.currentTab {
			rendered[i] = TabActiveStyle.Render(tab)
		} else {
			rendered[i] = TabStyle.Render(tab)
		}
	}

	return strings.Join(rendered, "  ")
}

func statusIndicator(running bool, label string) string {
	if running {
		return StatusOnStyle.Render("●") + " " + StatLabelStyle.Render(label)
	}
	return StatusOffStyle.Render("●") + " " + StatLabelStyle.Render(label)
}

func (d *Dashboard) renderFooter() string {
	uptime := time.Since(d.startTime).Round(time.Second)

	// Sparklines
	packetsSparkline := renderSparkline(d.packetsHistory, ColorPrimary)
	memorySparkline := renderSparkline(d.memoryHistory, ColorWarning)

	// Stats line 1
	stats1 := fmt.Sprintf(
		"%s %s %s  |  %s %s  |  %s %s  |  %s %s",
		StatLabelStyle.Render("Pkts:"),
		StatValueStyle.Render(formatNumber(d.packets)),
		packetsSparkline,
		StatLabelStyle.Render("Err:"),
		StatValueStyle.Render(formatNumber(d.errors)),
		StatLabelStyle.Render("WS:"),
		StatValueStyle.Render(fmt.Sprintf("%d", d.wsClients)),
		StatLabelStyle.Render("Up:"),
		StatValueStyle.Render(formatDuration(uptime)),
	)

	// Stats line 2
	stats2 := fmt.Sprintf(
		"%s %s %s  |  %s %s  |  %s %s",
		StatLabelStyle.Render("Mem:"),
		StatValueStyle.Render(fmt.Sprintf("%.1fMB", d.memoryMB)),
		memorySparkline,
		StatLabelStyle.Render("Goroutines:"),
		StatValueStyle.Render(fmt.Sprintf("%d", d.goroutines)),
		StatLabelStyle.Render("Logs:"),
		StatValueStyle.Render(fmt.Sprintf("%d", len(d.logs))),
	)

	// Filter and scroll status
	filterStr := d.getFilterString()
	scrollStr := ""
	if !d.autoScroll {
		scrollStr = " | " + ModeStyle.Render("PAUSED")
	}
	if d.searchQuery != "" {
		scrollStr += " | " + URLStyle.Render(fmt.Sprintf("Search: %s", d.searchQuery))
	}
	statusLine := filterStr + scrollStr

	// Help
	help := HelpStyle.Render(
		"q:quit  r:restart  p:pause  c:clear  f:filter  /:search  tab:switch  ↑↓:scroll",
	)

	// Search input if active
	if d.searching {
		searchBox := d.searchInput.View()
		return FooterStyle.Width(d.width).Align(lipgloss.Center).Render(
			lipgloss.JoinVertical(lipgloss.Center, stats1, stats2, searchBox, help),
		)
	}

	return FooterStyle.Width(d.width).Align(lipgloss.Center).Render(
		lipgloss.JoinVertical(lipgloss.Center, stats1, stats2, statusLine, help),
	)
}

func (d *Dashboard) getFilterString() string {
	switch d.logFilter {
	case LevelInfo:
		return LogInfoStyle.Render("Filter: INFO")
	case LevelSuccess:
		return LogSuccessStyle.Render("Filter: SUCCESS")
	case LevelWarn:
		return LogWarnStyle.Render("Filter: WARN")
	case LevelError:
		return LogErrorStyle.Render("Filter: ERROR")
	default:
		return StatLabelStyle.Render("Filter: ALL")
	}
}

func (d *Dashboard) renderStatsView() string {
	uptime := time.Since(d.startTime).Round(time.Second)

	lines := []string{
		"",
		TitleStyle.Render("  Server Statistics"),
		"",
		fmt.Sprintf(
			"  %s %s",
			StatLabelStyle.Render("Packets processed:"),
			StatValueStyle.Render(formatNumber(d.packets)),
		),
		fmt.Sprintf(
			"  %s %s",
			StatLabelStyle.Render("Packet errors:    "),
			StatValueStyle.Render(formatNumber(d.errors)),
		),
		fmt.Sprintf(
			"  %s %s",
			StatLabelStyle.Render("WS clients:       "),
			StatValueStyle.Render(fmt.Sprintf("%d", d.wsClients)),
		),
		fmt.Sprintf(
			"  %s %s",
			StatLabelStyle.Render("Uptime:           "),
			StatValueStyle.Render(formatDuration(uptime)),
		),
		"",
		TitleStyle.Render("  Resource Usage"),
		"",
		fmt.Sprintf(
			"  %s %s",
			StatLabelStyle.Render("Memory:           "),
			StatValueStyle.Render(fmt.Sprintf("%.2f MB", d.memoryMB)),
		),
		fmt.Sprintf(
			"  %s %s",
			StatLabelStyle.Render("Goroutines:       "),
			StatValueStyle.Render(fmt.Sprintf("%d", d.goroutines)),
		),
		"",
		TitleStyle.Render("  Packet Rate (last 30s)"),
		"",
		fmt.Sprintf("  %s", renderSparklineLarge(d.packetsHistory)),
		"",
		TitleStyle.Render("  Memory Usage (last 30s)"),
		"",
		fmt.Sprintf("  %s", renderSparklineLarge(d.memoryHistory)),
	}

	return strings.Join(lines, "\n")
}

func (d *Dashboard) renderConfigView() string {
	lines := []string{
		"",
		TitleStyle.Render("  Configuration"),
		"",
		fmt.Sprintf(
			"  %s %s",
			StatLabelStyle.Render("Version:    "),
			StatValueStyle.Render(d.version),
		),
		fmt.Sprintf(
			"  %s %s",
			StatLabelStyle.Render("Mode:       "),
			StatValueStyle.Render(d.mode),
		),
		fmt.Sprintf("  %s %s", StatLabelStyle.Render("HTTP URL:   "), URLStyle.Render(d.serverURL)),
		fmt.Sprintf("  %s %s", StatLabelStyle.Render("WS URL:     "), URLStyle.Render(d.wsURL)),
		fmt.Sprintf(
			"  %s %s",
			StatLabelStyle.Render("Adapter IP: "),
			StatValueStyle.Render(d.adapterIP),
		),
		"",
		TitleStyle.Render("  Keyboard Shortcuts"),
		"",
		fmt.Sprintf(
			"  %s  %s",
			StatValueStyle.Render("q"),
			StatLabelStyle.Render("Quit application"),
		),
		fmt.Sprintf(
			"  %s  %s",
			StatValueStyle.Render("r"),
			StatLabelStyle.Render("Restart application"),
		),
		fmt.Sprintf(
			"  %s  %s",
			StatValueStyle.Render("p"),
			StatLabelStyle.Render("Toggle auto-scroll"),
		),
		fmt.Sprintf("  %s  %s", StatValueStyle.Render("c"), StatLabelStyle.Render("Clear logs")),
		fmt.Sprintf(
			"  %s  %s",
			StatValueStyle.Render("f"),
			StatLabelStyle.Render("Cycle log filter"),
		),
		fmt.Sprintf("  %s  %s", StatValueStyle.Render("/"), StatLabelStyle.Render("Search logs")),
		fmt.Sprintf("  %s  %s", StatValueStyle.Render("↑↓"), StatLabelStyle.Render("Scroll logs")),
		fmt.Sprintf(
			"  %s  %s",
			StatValueStyle.Render("g/G"),
			StatLabelStyle.Render("Go to top/bottom"),
		),
		fmt.Sprintf("  %s  %s", StatValueStyle.Render("1-3"), StatLabelStyle.Render("Switch tabs")),
	}

	return strings.Join(lines, "\n")
}

// Sparkline rendering
var sparkChars = []rune{'▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'}

func renderSparkline[T uint64 | float64](data []T, color lipgloss.Color) string {
	if len(data) == 0 {
		return ""
	}

	var max T
	for _, v := range data {
		if v > max {
			max = v
		}
	}

	if max == 0 {
		return lipgloss.NewStyle().
			Foreground(color).
			Render(strings.Repeat(string(sparkChars[0]), len(data)))
	}

	var sb strings.Builder
	for _, v := range data {
		idx := int(float64(v) / float64(max) * float64(len(sparkChars)-1))
		if idx >= len(sparkChars) {
			idx = len(sparkChars) - 1
		}
		sb.WriteRune(sparkChars[idx])
	}

	return lipgloss.NewStyle().Foreground(color).Render(sb.String())
}

func renderSparklineLarge[T uint64 | float64](data []T) string {
	if len(data) == 0 {
		return StatLabelStyle.Render("No data yet...")
	}
	return renderSparkline(
		data,
		ColorPrimary,
	) + fmt.Sprintf(
		" (min/max: %.0f/%.0f)",
		minVal(data),
		maxVal(data),
	)
}

func minVal[T uint64 | float64](data []T) float64 {
	if len(data) == 0 {
		return 0
	}
	min := data[0]
	for _, v := range data[1:] {
		if v < min {
			min = v
		}
	}
	return float64(min)
}

func maxVal[T uint64 | float64](data []T) float64 {
	if len(data) == 0 {
		return 0
	}
	max := data[0]
	for _, v := range data[1:] {
		if v > max {
			max = v
		}
	}
	return float64(max)
}

func formatNumber(n uint64) string {
	str := fmt.Sprintf("%d", n)
	if len(str) <= 3 {
		return str
	}

	var result strings.Builder
	for i, c := range str {
		if i > 0 && (len(str)-i)%3 == 0 {
			result.WriteRune(',')
		}
		result.WriteRune(c)
	}
	return result.String()
}

func formatDuration(d time.Duration) string {
	d = d.Round(time.Second)

	h := d / time.Hour
	d -= h * time.Hour
	m := d / time.Minute
	d -= m * time.Minute
	s := d / time.Second

	if h > 0 {
		return fmt.Sprintf("%dh%dm", h, m)
	}
	if m > 0 {
		return fmt.Sprintf("%dm%ds", m, s)
	}
	return fmt.Sprintf("%ds", s)
}
