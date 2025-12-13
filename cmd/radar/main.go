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
)

// App holds all application components
type App struct {
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	logger     *logger.Logger
	httpServer *server.HTTPServer
	wsHandler  *server.WebSocketHandler
	capturer   *capture.Capturer
	program    *tea.Program
	adapterIP  string

	// Packet statistics (atomic for thread safety)
	packetsProcessed uint64
	packetsErrors    uint64

	// Server status (atomic for thread safety)
	httpRunning    int32
	captureRunning int32
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

	// Initialize capture first (may prompt for interface selection)
	// This happens BEFORE the dashboard starts
	ctx, cancel := context.WithCancel(context.Background())
	capturer, err := capture.New(ctx, appDir, cfg.ipAddr)
	if err != nil {
		cancel()
		exitWithError("Failed to create capturer", err)
	}

	// Create the app
	app, err := newApp(appDir, cfg, ctx, cancel, capturer)
	if err != nil {
		cancel()
		capturer.Close()
		exitWithError("Failed to create app", err)
	}
	app.adapterIP = capturer.AdapterIP()

	// Create dashboard
	dashboard := ui.NewDashboard(Version, serverPort, cfg.devMode, app.adapterIP)
	app.program = tea.NewProgram(dashboard, tea.WithAltScreen())

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
	capturer *capture.Capturer,
) (*App, error) {
	log := logger.New("./logs")
	wsHandler := server.NewWebSocketHandler(log)

	httpServer, err := createHTTPServer(cfg.devMode, appDir, wsHandler, log, Version)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP server: %w", err)
	}

	app := &App{
		ctx:        ctx,
		cancel:     cancel,
		logger:     log,
		wsHandler:  wsHandler,
		httpServer: httpServer,
		capturer:   capturer,
	}

	app.capturer.OnPacket(app.handlePacket)

	return app, nil
}

func createHTTPServer(
	devMode bool,
	appDir string,
	wsHandler *server.WebSocketHandler,
	log *logger.Logger,
	version string,
) (*server.HTTPServer, error) {
	if devMode {
		logger.PrintInfo("MODE", "Development mode: reading files from disk")
		return server.NewHTTPServerDev(serverPort, appDir, wsHandler, log, version)
	}
	logger.PrintInfo("MODE", "Production mode: using embedded assets")
	return server.NewHTTPServer(
		serverPort,
		assets.Images,
		assets.Scripts,
		assets.Public,
		assets.Sounds,
		assets.Styles,
		assets.Templates,
		wsHandler,
		log,
		version,
	)
}

func (app *App) startServers() {
	// Log startup messages
	app.logger.PrintSessionInfo()
	logger.PrintInfo("APP", "Starting servers...")

	// Start HTTP server
	app.wg.Add(1)
	go func() {
		defer app.wg.Done()
		atomic.StoreInt32(&app.httpRunning, 1)
		if err := app.httpServer.Start(); err != nil && !errors.Is(err, http.ErrServerClosed) &&
			app.ctx.Err() == nil {
			logger.PrintError("HTTP", "Error: %v", err)
		}
		atomic.StoreInt32(&app.httpRunning, 0)
	}()

	// Start packet capture
	app.wg.Add(1)
	go func() {
		defer app.wg.Done()
		atomic.StoreInt32(&app.captureRunning, 1)
		if err := app.capturer.Start(); err != nil && app.ctx.Err() == nil {
			logger.PrintError("CAP", "Error: %v", err)
		}
		atomic.StoreInt32(&app.captureRunning, 0)
	}()

	// Give servers a moment to start
	time.Sleep(100 * time.Millisecond)

	logger.PrintSuccess("HTTP", "Server: http://localhost:%d", serverPort)
	logger.PrintSuccess("WS", "WebSocket: ws://localhost:%d/ws", serverPort)
	logger.PrintInfo("PKT", "Listening for Albion packets on UDP port 5056...")
	logger.PrintInfo("NET", "Adapter: %s", app.adapterIP)
}

func (app *App) updateStats() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-app.ctx.Done():
			return
		case <-ticker.C:
			if app.program != nil {
				var m runtime.MemStats
				runtime.ReadMemStats(&m)

				wsStats := app.wsHandler.Stats()
				app.program.Send(ui.StatsMsg{
					Packets:       atomic.LoadUint64(&app.packetsProcessed),
					Errors:        atomic.LoadUint64(&app.packetsErrors),
					WsClients:     app.wsHandler.ClientCount(),
					MemoryMB:      float64(m.Alloc) / 1024 / 1024,
					Goroutines:    runtime.NumGoroutine(),
					WsBatches:     wsStats.BatchesSent,
					WsMessages:    wsStats.MessagesSent,
					WsQueueSize:   wsStats.MessagesQueue,
					BytesReceived: app.capturer.BytesReceived(),
					BytesSent:     wsStats.BytesSent,
				})

				app.program.Send(ui.StatusMsg{
					HTTPRunning:    atomic.LoadInt32(&app.httpRunning) == 1,
					WSRunning:      app.wsHandler.ClientCount() >= 0,
					CaptureRunning: atomic.LoadInt32(&app.captureRunning) == 1,
				})
			}
		}
	}
}

func (app *App) handlePacket(payload []byte) {
	packet, err := photon.ParsePacket(payload)
	if err != nil {
		atomic.AddUint64(&app.packetsErrors, 1)
		errCount := atomic.LoadUint64(&app.packetsErrors)
		// Log only every 100 errors to avoid spam
		if errCount%100 == 1 {
			logger.PrintWarn("PKT", "Parsing errors: %d (latest: %v)", errCount, err)
		}
		return
	}
	if packet == nil {
		return
	}

	atomic.AddUint64(&app.packetsProcessed, 1)
	for _, cmd := range packet.Commands {
		app.processCommand(cmd)
	}
}

func (app *App) processCommand(cmd *photon.Command) {
	if cmd.Payload == nil {
		return
	}

	switch cmd.MessageType {
	case photon.MessageTypeEvent:
		if event, err := photon.DeserializeEvent(cmd.Payload); err == nil {
			app.wsHandler.BroadcastEvent(event)
		}
	case photon.MessageTypeRequest:
		if req, err := photon.DeserializeRequest(cmd.Payload); err == nil {
			app.wsHandler.BroadcastRequest(req)
		}
	case photon.MessageTypeResponse:
		if resp, err := photon.DeserializeResponse(cmd.Payload); err == nil {
			app.wsHandler.BroadcastResponse(resp)
		}
	}
}

func (app *App) shutdown() {
	logger.PrintInfo("APP", "Shutting down gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	app.cancel()
	app.capturer.Close()

	if err := app.httpServer.Shutdown(ctx); err != nil {
		logger.PrintError("HTTP", "Shutdown error: %v", err)
	}

	// Wait for goroutines
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
