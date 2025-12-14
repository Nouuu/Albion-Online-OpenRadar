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
	headerHeight        = 5
	footerHeight        = 5
	maxLogs             = 1000
	sparklineHistory    = 60 // 60s of data
	sparklineDisplayLen = 42 // Display width (30% smaller)
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
	Packets         uint64
	Errors          uint64
	WsClients       int
	MemoryMB        float64
	Goroutines      int
	WsBatches       uint64
	WsMessages      uint64
	WsQueueSize     int
	BytesReceived   uint64
	BytesSent       uint64
	LogLinesWritten int
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

	// WebSocket batching stats
	wsBatches   uint64
	wsMessages  uint64
	wsQueueSize int

	// Traffic stats
	bytesReceived     uint64
	bytesSent         uint64
	lastBytesReceived uint64
	lastBytesSent     uint64
	rxPerSec          uint64
	txPerSec          uint64

	// Log file stats
	logLinesWritten int

	// Sparkline history
	packetsHistory []uint64
	memoryHistory  []float64
	wsBatchHistory []uint64
	lastPackets    uint64
	lastWsBatches  uint64

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
		packetsHistory: make([]uint64, 0, sparklineHistory),
		memoryHistory:  make([]float64, 0, sparklineHistory),
		wsBatchHistory: make([]uint64, 0, sparklineHistory),
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
		// Update sparkline histories
		packetsDiff := msg.Packets - d.lastPackets
		d.lastPackets = msg.Packets
		d.packetsHistory = append(d.packetsHistory, packetsDiff)
		if len(d.packetsHistory) > sparklineHistory {
			d.packetsHistory = d.packetsHistory[1:]
		}

		d.memoryHistory = append(d.memoryHistory, msg.MemoryMB)
		if len(d.memoryHistory) > sparklineHistory {
			d.memoryHistory = d.memoryHistory[1:]
		}

		batchDiff := msg.WsBatches - d.lastWsBatches
		d.lastWsBatches = msg.WsBatches
		d.wsBatchHistory = append(d.wsBatchHistory, batchDiff)
		if len(d.wsBatchHistory) > sparklineHistory {
			d.wsBatchHistory = d.wsBatchHistory[1:]
		}

		d.packets = msg.Packets
		d.errors = msg.Errors
		d.wsClients = msg.WsClients
		d.memoryMB = msg.MemoryMB
		d.goroutines = msg.Goroutines
		d.wsBatches = msg.WsBatches
		d.wsMessages = msg.WsMessages
		d.wsQueueSize = msg.WsQueueSize

		// Traffic stats (per second)
		d.rxPerSec = msg.BytesReceived - d.lastBytesReceived
		d.txPerSec = msg.BytesSent - d.lastBytesSent
		d.lastBytesReceived = msg.BytesReceived
		d.lastBytesSent = msg.BytesSent
		d.bytesReceived = msg.BytesReceived
		d.bytesSent = msg.BytesSent
		d.logLinesWritten = msg.LogLinesWritten

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

	// Stats line 1: Packets & Memory
	stats1 := fmt.Sprintf(
		"%s %s %s  |  %s %s %s  |  %s %s",
		StatLabelStyle.Render("Pkts:"),
		StatValueStyle.Render(formatNumber(d.packets)),
		packetsSparkline,
		StatLabelStyle.Render("Mem:"),
		StatValueStyle.Render(fmt.Sprintf("%.1fMB", d.memoryMB)),
		memorySparkline,
		StatLabelStyle.Render("Up:"),
		StatValueStyle.Render(formatDuration(uptime)),
	)

	// Stats line 2: WS batching & system
	stats2 := fmt.Sprintf(
		"%s %s  |  %s %s  |  %s %s  |  %s %s",
		StatLabelStyle.Render("Batch:"),
		StatValueStyle.Render(fmt.Sprintf("%s/%s", formatNumber(d.wsBatches), formatNumber(d.wsMessages))),
		StatLabelStyle.Render("WS:"),
		StatValueStyle.Render(fmt.Sprintf("%d", d.wsClients)),
		StatLabelStyle.Render("Err:"),
		StatValueStyle.Render(formatNumber(d.errors)),
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

	// Calculate derived metrics
	avgMsgsPerBatch := float64(0)
	if d.wsBatches > 0 {
		avgMsgsPerBatch = float64(d.wsMessages) / float64(d.wsBatches)
	}
	errorRate := float64(0)
	if d.packets > 0 {
		errorRate = float64(d.errors) / float64(d.packets) * 100
	}
	packetsPerSec := float64(0)
	if len(d.packetsHistory) > 0 {
		packetsPerSec = float64(d.packetsHistory[len(d.packetsHistory)-1])
	}
	batchesPerSec := float64(0)
	if len(d.wsBatchHistory) > 0 {
		batchesPerSec = float64(d.wsBatchHistory[len(d.wsBatchHistory)-1])
	}

	// Fixed-width stat helper
	labelStyle := StatLabelStyle.Width(12).Align(lipgloss.Right)
	valStyle := func(color lipgloss.Color) lipgloss.Style {
		return lipgloss.NewStyle().Bold(true).Foreground(color).Width(12)
	}
	stat := func(label, value string, color lipgloss.Color) string {
		return fmt.Sprintf(" %s %s", labelStyle.Render(label), valStyle(color).Render(value))
	}
	section := func(icon, title string) string {
		return fmt.Sprintf(" %s %s", icon, TitleStyle.Render(title))
	}

	// Left column: Server, WebSocket, Traffic
	leftLines := []string{
		section("📊", "Server"),
		stat("Uptime:", formatDuration(uptime), ColorHighlight),
		stat("Packets:", formatNumber(d.packets), ColorSuccess),
		stat("Pkts/sec:", fmt.Sprintf("%.0f", packetsPerSec), ColorPrimary),
		stat("Errors:", formatNumber(d.errors), d.getErrorColor(errorRate)),
		stat("Err rate:", fmt.Sprintf("%.2f%%", errorRate), d.getErrorColor(errorRate)),
		"",
		section("🔌", "WebSocket"),
		stat("Clients:", fmt.Sprintf("%d", d.wsClients), ColorPrimary),
		stat("Batches:", formatNumber(d.wsBatches), ColorSuccess),
		stat("Batch/s:", fmt.Sprintf("%.0f", batchesPerSec), ColorPrimary),
		stat("Messages:", formatNumber(d.wsMessages), ColorSuccess),
		stat("Avg/batch:", fmt.Sprintf("%.1f", avgMsgsPerBatch), ColorWarning),
		stat("Queue:", fmt.Sprintf("%d", d.wsQueueSize), d.getQueueColor()),
		"",
		section("📡", "Traffic"),
		stat("RX total:", formatBytes(d.bytesReceived), ColorPrimary),
		stat("RX/sec:", formatBytes(d.rxPerSec)+"/s", ColorSuccess),
		stat("TX total:", formatBytes(d.bytesSent), ColorPrimary),
		stat("TX/sec:", formatBytes(d.txPerSec)+"/s", ColorWarning),
	}

	// Right column: Sparklines
	rightLines := []string{
		section("📈", "Packets/s"),
		" " + renderSparkline(d.packetsHistory, ColorPrimary),
		" " + d.getSparklineStats(d.packetsHistory, ""),
		"",
		section("🧠", "Memory MB"),
		" " + renderSparkline(d.memoryHistory, ColorWarning),
		" " + d.getSparklineStatsFloat(d.memoryHistory, ""),
		"",
		section("📦", "WS Batch/s"),
		" " + renderSparkline(d.wsBatchHistory, ColorSuccess),
		" " + d.getSparklineStats(d.wsBatchHistory, ""),
	}

	colWidth := (d.width - 4) / 2
	leftCol := lipgloss.NewStyle().Width(colWidth).Render(strings.Join(leftLines, "\n"))
	rightCol := lipgloss.NewStyle().Width(colWidth).Render(strings.Join(rightLines, "\n"))

	return lipgloss.JoinHorizontal(lipgloss.Top, " ", leftCol, " ", rightCol)
}

func (d *Dashboard) getErrorColor(rate float64) lipgloss.Color {
	if rate > 5 {
		return ColorError
	} else if rate > 1 {
		return ColorWarning
	}
	return ColorSuccess
}

func (d *Dashboard) getQueueColor() lipgloss.Color {
	if d.wsQueueSize > 50 {
		return ColorError
	} else if d.wsQueueSize > 20 {
		return ColorWarning
	}
	return ColorSuccess
}

func (d *Dashboard) getMemoryColor() lipgloss.Color {
	if d.memoryMB > 500 {
		return ColorError
	} else if d.memoryMB > 200 {
		return ColorWarning
	}
	return ColorSuccess
}

func (d *Dashboard) getSparklineStats(data []uint64, unit string) string {
	if len(data) == 0 {
		return StatLabelStyle.Render("No data")
	}
	min, max, avg := minVal(data), maxVal(data), avgVal(data)
	return StatLabelStyle.Render(fmt.Sprintf("min: %.0f  avg: %.0f  max: %.0f %s", min, avg, max, unit))
}

func (d *Dashboard) getSparklineStatsFloat(data []float64, unit string) string {
	if len(data) == 0 {
		return StatLabelStyle.Render("No data")
	}
	min, max, avg := minVal(data), maxVal(data), avgVal(data)
	return StatLabelStyle.Render(fmt.Sprintf("min: %.1f  avg: %.1f  max: %.1f %s", min, avg, max, unit))
}

func (d *Dashboard) renderConfigView() string {
	section := func(icon, title string) string {
		return fmt.Sprintf(" %s %s", icon, TitleStyle.Render(title))
	}
	labelStyle := StatLabelStyle.Width(12).Align(lipgloss.Right)
	cfgLine := func(label, value string, style lipgloss.Style) string {
		return fmt.Sprintf(" %s %s", labelStyle.Render(label), style.Render(value))
	}
	keyStyle := lipgloss.NewStyle().Bold(true).Foreground(ColorPrimary).Width(6)
	keyLine := func(key, desc string) string {
		return fmt.Sprintf(" %s %s", keyStyle.Render(key), StatLabelStyle.Render(desc))
	}

	// Left column: Configuration
	leftLines := []string{
		section("⚙️", "Configuration"),
		cfgLine("Version:", d.version, StatValueStyle),
		cfgLine("Mode:", d.mode, ModeStyle),
		cfgLine("HTTP URL:", d.serverURL, URLStyle),
		cfgLine("WS URL:", d.wsURL, URLStyle),
		cfgLine("Adapter:", d.adapterIP, StatValueStyle),
		"",
		section("ℹ️", "About"),
		cfgLine("", "OpenRadar - Albion Online", StatLabelStyle),
		cfgLine("", "Real-time packet radar", StatLabelStyle),
	}

	// Right column: Keyboard shortcuts (single column for alignment)
	rightLines := []string{
		section("⌨️", "Shortcuts"),
		keyLine("q", "Quit application"),
		keyLine("r", "Restart application"),
		keyLine("p", "Toggle auto-scroll"),
		keyLine("c", "Clear logs"),
		keyLine("f", "Cycle log filter"),
		keyLine("/", "Search logs"),
		keyLine("↑↓", "Scroll logs"),
		keyLine("g/G", "Go to top/bottom"),
		keyLine("1-3", "Switch tabs"),
		keyLine("tab", "Next tab"),
		"",
		section("📋", "Log Levels"),
		" " + LogInfoStyle.Render("INFO") + " " + LogSuccessStyle.Render("SUCCESS") + " " + LogWarnStyle.Render("WARN") + " " + LogErrorStyle.Render("ERROR"),
	}

	colWidth := (d.width - 4) / 2
	leftCol := lipgloss.NewStyle().Width(colWidth).Render(strings.Join(leftLines, "\n"))
	rightCol := lipgloss.NewStyle().Width(colWidth).Render(strings.Join(rightLines, "\n"))

	return lipgloss.JoinHorizontal(lipgloss.Top, " ", leftCol, " ", rightCol)
}

// Sparkline rendering
var sparkChars = []rune{'▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'}

func renderSparkline[T uint64 | float64](data []T, color lipgloss.Color) string {
	if len(data) == 0 {
		return ""
	}

	// Downsample if needed (60 data points -> 42 display chars)
	displayData := data
	if len(data) > sparklineDisplayLen {
		displayData = make([]T, sparklineDisplayLen)
		ratio := float64(len(data)) / float64(sparklineDisplayLen)
		for i := 0; i < sparklineDisplayLen; i++ {
			// Average the values in each bucket
			start := int(float64(i) * ratio)
			end := int(float64(i+1) * ratio)
			if end > len(data) {
				end = len(data)
			}
			var sum float64
			for j := start; j < end; j++ {
				sum += float64(data[j])
			}
			displayData[i] = T(sum / float64(end-start))
		}
	}

	var max T
	for _, v := range displayData {
		if v > max {
			max = v
		}
	}

	if max == 0 {
		return lipgloss.NewStyle().
			Foreground(color).
			Render(strings.Repeat(string(sparkChars[0]), len(displayData)))
	}

	var sb strings.Builder
	for _, v := range displayData {
		idx := int(float64(v) / float64(max) * float64(len(sparkChars)-1))
		if idx >= len(sparkChars) {
			idx = len(sparkChars) - 1
		}
		sb.WriteRune(sparkChars[idx])
	}

	return lipgloss.NewStyle().Foreground(color).Render(sb.String())
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

func avgVal[T uint64 | float64](data []T) float64 {
	if len(data) == 0 {
		return 0
	}
	var sum float64
	for _, v := range data {
		sum += float64(v)
	}
	return sum / float64(len(data))
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

func formatBytes(b uint64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := uint64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
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
