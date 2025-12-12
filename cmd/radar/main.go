package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	assets "github.com/nospy/albion-openradar"
	"github.com/nospy/albion-openradar/internal/capture"
	"github.com/nospy/albion-openradar/internal/logger"
	"github.com/nospy/albion-openradar/internal/photon"
	"github.com/nospy/albion-openradar/internal/server"
)

// Version info (injected at build time via ldflags)
var (
	Version   = "2.0.0"
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
	// Packet statistics
	packetStats struct {
		processed uint64
		errors    uint64
	}
}

func main() {
	cfg := parseFlags()
	if cfg.showVersion {
		fmt.Printf("OpenRadar v%s (built: %s)\n", Version, BuildTime)
		return
	}

	printBanner()

	appDir, err := os.Getwd()
	if err != nil {
		exitWithError("Failed to get working directory", err)
	}

	// Initialize capture first (may prompt for interface selection)
	// This ensures the prompt isn't mixed with server startup messages
	ctx, cancel := context.WithCancel(context.Background())
	capturer, err := capture.New(ctx, appDir, cfg.ipAddr)
	if err != nil {
		cancel()
		exitWithError("Failed to create capturer", err)
	}

	// Now that interface is selected, show all startup messages
	logger.PrintInfo("APP", "Directory: %s", appDir)

	app := newApp(appDir, cfg, ctx, cancel, capturer)
	app.start()
	app.waitForShutdown()
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

func newApp(appDir string, cfg Config, ctx context.Context, cancel context.CancelFunc, capturer *capture.Capturer) *App {
	log := logger.New("./logs")

	// Create WebSocket handler first (shared between HTTP server and packet processor)
	wsHandler := server.NewWebSocketHandler(log)

	app := &App{
		ctx:        ctx,
		cancel:     cancel,
		logger:     log,
		wsHandler:  wsHandler,
		httpServer: createHTTPServer(cfg.devMode, appDir, wsHandler, log),
		capturer:   capturer,
	}

	app.capturer.OnPacket(app.handlePacket)

	return app
}

func createHTTPServer(
	devMode bool,
	appDir string,
	wsHandler *server.WebSocketHandler,
	log *logger.Logger,
) *server.HTTPServer {
	if devMode {
		logger.PrintInfo("MODE", "Development mode: reading files from disk")
		return server.NewHTTPServerDev(serverPort, appDir, wsHandler, log)
	}
	logger.PrintInfo("MODE", "Production mode: using embedded assets")
	return server.NewHTTPServer(
		serverPort,
		assets.Images,
		assets.Scripts,
		assets.Public,
		assets.Sounds,
		wsHandler,
		log,
	)
}

func (app *App) start() {
	app.startServer("HTTP", app.httpServer.Start)
	app.startServer("Capture", app.capturer.Start)

	fmt.Println()
	logger.PrintSuccess("HTTP", "Server: http://localhost:%d", serverPort)
	logger.PrintSuccess("WS", "WebSocket: ws://localhost:%d/ws", serverPort)
	logger.PrintInfo("PKT", "Listening for Albion packets on UDP port 5056...")
	fmt.Println()
	fmt.Println("Press Ctrl+C to stop")
	fmt.Println("--------------------")
}

func (app *App) startServer(name string, startFn func() error) {
	app.wg.Add(1)
	go func() {
		defer app.wg.Done()
		if err := startFn(); err != nil && !errors.Is(err, http.ErrServerClosed) &&
			app.ctx.Err() == nil {
			logger.PrintError(name, "Error: %v", err)
		}
	}()
}

func (app *App) handlePacket(payload []byte) {
	packet, err := photon.ParsePacket(payload)
	if err != nil {
		app.packetStats.errors++
		// Log only every 100 errors to avoid spam
		if app.packetStats.errors%100 == 1 {
			logger.PrintWarn("PKT", "Parsing errors: %d (latest: %v)", app.packetStats.errors, err)
		}
		return
	}
	if packet == nil {
		return
	}

	app.packetStats.processed++
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

func (app *App) waitForShutdown() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	fmt.Println()
	logger.PrintInfo("APP", "Shutting down gracefully...")
	app.shutdown()
}

func (app *App) shutdown() {
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	app.cancel()
	app.capturer.Close()

	if err := app.httpServer.Shutdown(ctx); err != nil {
		logger.PrintError("HTTP", "Shutdown error: %v", err)
	}

	app.waitWithTimeout(ctx)
}

func (app *App) waitWithTimeout(ctx context.Context) {
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
