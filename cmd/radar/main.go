package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	tea "github.com/charmbracelet/bubbletea"

	assets "github.com/nospy/albion-openradar"
	"github.com/nospy/albion-openradar/internal/capture"
	"github.com/nospy/albion-openradar/internal/logger"
	"github.com/nospy/albion-openradar/internal/photon"
	"github.com/nospy/albion-openradar/internal/server"
	"github.com/nospy/albion-openradar/internal/ui"
)

// Version info (injected at build time via ldflags)
// Default values are used when running with 'go run' without ldflags
var (
	Version   = "dev"
	BuildTime = "unknown"
)

const (
	serverPort      = 5001
	shutdownTimeout = 10 * time.Second
	pcapCaptureDir  = "./logs/captures"
)

type App struct {
	ctx            context.Context
	cancel         context.CancelFunc
	wg             sync.WaitGroup
	logger         *logger.Logger
	httpServer     *server.HTTPServer
	wsHandler      *server.WebSocketHandler
	captureManager *capture.Manager
	photonParser   *photon.PhotonParser
	program        *tea.Program

	// Packet statistics (atomic for thread safety)
	packetsProcessed uint64
	packetsErrors    uint64
	packetsEncrypted uint64

	// Server status (atomic for thread safety)
	httpRunning int32
}

func main() {
	cfg := parseFlags()
	if cfg.showVersion {
		fmt.Printf("OpenRadar v%s (built: %s)\n", Version, BuildTime)
		return
	}

	printBanner()

	for {
		shouldRestart := runApp(cfg)
		if !shouldRestart {
			break
		}
		fmt.Println("Restarting...")
	}
}

func runApp(cfg Config) bool {
	appDir, err := os.Getwd()
	if err != nil {
		exitWithError("Failed to get working directory", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	allIfaces, err := capture.EnumerateInterfaces()
	if err != nil {
		cancel()
		exitWithError("Failed to enumerate interfaces", err)
	}

	if _, mErr := capture.MigrateIPTxt(appDir, capture.ResolveByIP); mErr != nil {
		logger.PrintWarn("NET", "ip.txt migration failed: %v", mErr)
	}

	cfgPersisted, _ := capture.ReadConfig(appDir)
	target := resolvePersisted(cfgPersisted, allIfaces, cfg.ipAddr)
	if len(target) == 0 {
		target = autoPickDefaults(allIfaces)
		if len(target) > 0 {
			toPersist := make([]capture.PersistedInterface, 0, len(target))
			for _, i := range target {
				toPersist = append(toPersist, capture.PersistedInterface{Name: i.Name, Description: i.Description})
			}
			_ = capture.WriteConfig(appDir, capture.Config{CaptureInterfaces: toPersist})
			logger.PrintInfo("NET", "Auto-selected %d interface(s). Change in /settings if needed.", len(target))
		}
	}

	manager := capture.NewManager(ctx)

	app, err := newApp(appDir, cfg, ctx, cancel, manager, allIfaces, cfgPersisted.Logging.ServerLogsEnabled)
	if err != nil {
		cancel()
		manager.Close(context.Background())
		exitWithError("Failed to create app", err)
	}

	if err := manager.Reconfigure(target); err != nil {
		logger.PrintWarn("NET", "Some interfaces failed to open: %v", err)
	}

	if cfgPersisted.Logging.PcapRecording {
		if err := manager.StartRecording(pcapCaptureDir); err != nil {
			logger.PrintWarn("PKT", "pcap recording could not start: %v", err)
			_ = capture.MutateConfig(appDir, func(cfg *capture.Config) {
				cfg.Logging.PcapRecording = false
			})
		}
	}

	dashboard := ui.NewDashboard(Version, serverPort, cfg.devMode, capture.LANAddresses(), nil)
	app.program = tea.NewProgram(dashboard, tea.WithAltScreen())

	app.startCaptureStatePoll()

	// Track if restart was requested
	restartRequested := false

	// Set up log callback to send logs to dashboard
	logger.SetLogCallback(func(level, tag, message string) {
		app.program.Send(ui.LogMsg{
			Level:   level,
			Tag:     tag,
			Message: message,
		})
	})

	// Start servers in background (will also print session info)
	go app.startServers()

	// Start stats updater
	go app.updateStats()

	// Run dashboard (blocking)
	model, err := app.program.Run()
	if err != nil {
		logger.ClearLogCallback()
		fmt.Printf("Dashboard error: %v\n", err)
	}

	// Check if restart was requested
	if d, ok := model.(ui.Dashboard); ok {
		restartRequested = d.RestartRequested()
	}

	// Cleanup
	logger.ClearLogCallback()
	app.shutdown()

	return restartRequested
}

// Config holds command-line configuration
type Config struct {
	devMode     bool
	showVersion bool
	ipAddr      string
}

func parseFlags() Config {
	cfg := Config{}
	flag.BoolVar(&cfg.devMode, "dev", false, "Run in development mode (read files from disk)")
	flag.BoolVar(&cfg.showVersion, "version", false, "Show version information")
	flag.StringVar(&cfg.ipAddr, "ip", "", "Network adapter IP address (skip interactive prompt)")
	flag.Parse()
	return cfg
}

func printBanner() {
	fmt.Printf("OpenRadar v%s\n", Version)
	fmt.Println("====================")
}

func exitWithError(msg string, err error) {
	fmt.Printf("%s: %v\n", msg, err)
	os.Exit(1)
}

func newApp(
	appDir string,
	cfg Config,
	ctx context.Context,
	cancel context.CancelFunc,
	manager *capture.Manager,
	allIfaces []capture.NetworkInterface,
	serverLogsEnabled bool,
) (*App, error) {
	log := logger.New("./logs", serverLogsEnabled)
	wsHandler := server.NewWebSocketHandler(log)

	httpServer, err := createHTTPServer(cfg.devMode, appDir, wsHandler, log, Version, manager, allIfaces)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP server: %w", err)
	}

	app := &App{
		ctx:            ctx,
		cancel:         cancel,
		logger:         log,
		wsHandler:      wsHandler,
		httpServer:     httpServer,
		captureManager: manager,
	}
	app.photonParser = photon.NewPhotonParser(
		app.onPhotonEvent,
		app.onPhotonRequest,
		app.onPhotonResponse,
	)
	app.photonParser.OnEncrypted = app.onPhotonEncrypted
	app.photonParser.OnParseError = app.onPhotonParseError

	app.captureManager.OnPacket(app.handlePacket)

	return app, nil
}

func createHTTPServer(
	devMode bool,
	appDir string,
	wsHandler *server.WebSocketHandler,
	log *logger.Logger,
	version string,
	mgr *capture.Manager,
	allIfaces []capture.NetworkInterface,
) (*server.HTTPServer, error) {
	if devMode {
		logger.PrintInfo("MODE", "Development mode: reading files from disk")
		return server.NewHTTPServerDev(serverPort, appDir, wsHandler, log, version, mgr, allIfaces, mgr, pcapCaptureDir)
	}
	logger.PrintInfo("MODE", "Production mode: using embedded assets")
	return server.NewHTTPServer(
		serverPort,
		assets.Images,
		assets.Scripts,
		assets.Data,
		assets.Sounds,
		assets.Styles,
		assets.Templates,
		wsHandler,
		log,
		version,
		mgr,
		allIfaces,
		appDir,
		mgr,
		pcapCaptureDir,
	)
}

func (app *App) startServers() {
	app.logger.PrintSessionInfo()
	logger.PrintInfo("APP", "Starting servers...")

	app.wg.Go(func() {
		atomic.StoreInt32(&app.httpRunning, 1)
		if err := app.httpServer.Start(); err != nil && !errors.Is(err, http.ErrServerClosed) &&
			app.ctx.Err() == nil {
			logger.PrintError("HTTP", "Error: %v", err)
		}
		atomic.StoreInt32(&app.httpRunning, 0)
	})

	time.Sleep(100 * time.Millisecond)

	logger.PrintSuccess("HTTP", "Server: http://localhost:%d", serverPort)
	for _, ip := range capture.LANAddresses() {
		logger.PrintSuccess("HTTP", "Server: http://%s:%d  (LAN)", ip, serverPort)
	}
	logger.PrintSuccess("WS", "WebSocket: ws://localhost:%d/ws", serverPort)
	for _, ip := range capture.LANAddresses() {
		logger.PrintSuccess("WS", "WebSocket: ws://%s:%d/ws  (LAN)", ip, serverPort)
	}
	logger.PrintInfo("PKT", "Listening for Albion packets on UDP port 5056...")
	for _, s := range app.captureManager.State().Active {
		logger.PrintInfo("NET", "Capturing on %s [%s]", s.Description, s.Address)
	}
}

func (app *App) updateStats() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-app.ctx.Done():
			return
		case <-ticker.C:
			// TODO(#91): aggregate pcap.Stats across active capturers.
			if app.program != nil {
				var m runtime.MemStats
				runtime.ReadMemStats(&m)

				wsStats := app.wsHandler.Stats()
				logStats := app.logger.GetStats()
				app.program.Send(ui.StatsMsg{
					Packets:       atomic.LoadUint64(&app.packetsProcessed),
					Errors:        atomic.LoadUint64(&app.packetsErrors),
					WsClients:     app.wsHandler.ClientCount(),
					MemoryMB:      float64(m.Alloc) / 1024 / 1024,
					MemorySysMB:   float64(m.Sys) / 1024 / 1024,
					Goroutines:    runtime.NumGoroutine(),
					WsBatches:     wsStats.BatchesSent,
					WsMessages:    wsStats.MessagesSent,
					WsQueueSize:   wsStats.MessagesQueue,
					BytesReceived: app.captureManager.BytesReceived(),
					BytesSent:     wsStats.BytesSent,
					LogEntries:    logStats.TotalEntries,
					LogBatches:    logStats.TotalBatches,
					LogBufferSize: logStats.BufferSize,
				})

				captureActive := len(app.captureManager.State().Active) > 0
				app.program.Send(ui.StatusMsg{
					HTTPRunning:    atomic.LoadInt32(&app.httpRunning) == 1,
					WSRunning:      app.wsHandler.ClientCount() >= 0,
					CaptureRunning: captureActive,
				})
			}
		}
	}
}

func (app *App) handlePacket(payload []byte) {
	if app.photonParser.ReceivePacket(payload) {
		atomic.AddUint64(&app.packetsProcessed, 1)
	}
}

func (app *App) onPhotonParseError(reason string, payloadLen int) {
	n := atomic.AddUint64(&app.packetsErrors, 1)
	if n%100 == 1 {
		logger.PrintWarn("PKT", "Parsing errors: %d (last reason: %s, payload len: %d)",
			n, reason, payloadLen)
	}
}

func (app *App) onPhotonEvent(event *photon.EventData) {
	photon.PostProcessEvent(event)
	realCode := event.Parameters[252]
	app.logger.Debug("EVENT_CAPTURE", fmt.Sprintf("Event_%v", realCode), map[string]interface{}{
		"code":       realCode,
		"paramCount": len(event.Parameters),
	}, nil)
	app.wsHandler.BroadcastEvent(event)
}

func (app *App) onPhotonRequest(req *photon.OperationRequest) {
	photon.PostProcessRequest(req)
	app.wsHandler.BroadcastRequest(req)
}

func (app *App) onPhotonResponse(resp *photon.OperationResponse) {
	photon.PostProcessResponse(resp)
	app.wsHandler.BroadcastResponse(resp)
}

func (app *App) onPhotonEncrypted() {
	n := atomic.AddUint64(&app.packetsEncrypted, 1)
	if n%100 == 1 {
		logger.PrintWarn("PKT", "Encrypted traffic seen (%d so far, ignored)", n)
	}
}

func (app *App) shutdown() {
	logger.PrintInfo("APP", "Shutting down gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	app.cancel()
	app.captureManager.Close(ctx)
	app.logger.Stop()

	if err := app.httpServer.Shutdown(ctx); err != nil {
		logger.PrintError("HTTP", "Shutdown error: %v", err)
	}

	done := make(chan struct{})
	go func() {
		app.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		logger.PrintSuccess("APP", "Shutdown complete")
	case <-ctx.Done():
		logger.PrintWarn("APP", "Shutdown timed out")
	}
}

// resolvePersisted maps a persisted (or CLI-overridden) selection to currently
// available NetworkInterface entries. Returns nil if the override IP no longer
// resolves; the caller falls back to autoPickDefaults.
func resolvePersisted(cfg capture.Config, all []capture.NetworkInterface, ipOverride string) []capture.NetworkInterface {
	if ipOverride != "" {
		for _, i := range all {
			if i.Address == ipOverride {
				return []capture.NetworkInterface{i}
			}
		}
		return nil
	}
	available := make(map[string]capture.NetworkInterface, len(all))
	for _, i := range all {
		available[i.Name] = i
	}
	out := make([]capture.NetworkInterface, 0, len(cfg.CaptureInterfaces))
	for _, p := range cfg.CaptureInterfaces {
		if i, ok := available[p.Name]; ok {
			out = append(out, i)
		}
	}
	return out
}

func autoPickDefaults(all []capture.NetworkInterface) []capture.NetworkInterface {
	out := make([]capture.NetworkInterface, 0)
	for _, i := range capture.RankCandidates(all) {
		c := capture.Categorize(i.Name, i.Description)
		if (c == capture.CategoryEthernet || c == capture.CategoryWiFi || c == capture.CategoryExitLag) && capture.IsRFC1918(i.Address) {
			out = append(out, i)
		}
	}
	return out
}

// startCaptureStatePoll pushes a CaptureStateMsg to the TUI every 2s so
// header and Config tab reflect live Manager state without coupling ui to capture.
func (app *App) startCaptureStatePoll() {
	app.wg.Go(func() {
		t := time.NewTicker(2 * time.Second)
		defer t.Stop()
		for {
			select {
			case <-app.ctx.Done():
				return
			case <-t.C:
				if app.program == nil {
					continue
				}
				s := app.captureManager.State()
				summaries := make([]ui.CaptureSummary, 0, len(s.Active))
				for _, a := range s.Active {
					summaries = append(summaries, ui.CaptureSummary{
						Description: a.Description,
						Address:     a.Address,
						Category:    string(a.Category),
					})
				}
				app.program.Send(ui.CaptureStateMsg{
					Active:       summaries,
					LanAddresses: capture.LANAddresses(),
					Status:       string(s.Status),
				})
			}
		}
	})
}
