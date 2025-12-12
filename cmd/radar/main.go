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
	fmt.Printf("App directory: %s\n", appDir)

	app := newApp(appDir, cfg)
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

func newApp(appDir string, cfg Config) *App {
	ctx, cancel := context.WithCancel(context.Background())
	log := logger.New("./logs")

	// Create WebSocket handler first (shared between HTTP server and packet processor)
	wsHandler := server.NewWebSocketHandler(log)

	app := &App{
		ctx:        ctx,
		cancel:     cancel,
		logger:     log,
		wsHandler:  wsHandler,
		httpServer: createHTTPServer(cfg.devMode, appDir, wsHandler, log),
	}

	capInstance, err := capture.New(ctx, appDir, cfg.ipAddr)
	if err != nil {
		cancel()
		exitWithError("Failed to create capturer", err)
	}
	app.capturer = capInstance
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
		fmt.Println("Development mode: reading files from disk")
		return server.NewHTTPServerDev(serverPort, appDir, wsHandler, log)
	}
	fmt.Println("Production mode: using embedded assets")
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

	fmt.Printf("\nServer: http://localhost:%d\n", serverPort)
	fmt.Printf("WebSocket: ws://localhost:%d/ws\n", serverPort)
	fmt.Println("\nListening for Albion packets on UDP port 5056...")
	fmt.Println("   Press Ctrl+C to stop")
}

func (app *App) startServer(name string, startFn func() error) {
	app.wg.Add(1)
	go func() {
		defer app.wg.Done()
		if err := startFn(); err != nil && !errors.Is(err, http.ErrServerClosed) &&
			app.ctx.Err() == nil {
			fmt.Printf("%s error: %v\n", name, err)
		}
	}()
}

func (app *App) handlePacket(payload []byte) {
	packet, err := photon.ParsePacket(payload)
	if err != nil || packet == nil {
		return
	}

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

	fmt.Println("\nShutting down gracefully...")
	app.shutdown()
}

func (app *App) shutdown() {
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	app.cancel()
	app.capturer.Close()

	if err := app.httpServer.Shutdown(ctx); err != nil {
		fmt.Printf("Server shutdown error: %v\n", err)
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
		fmt.Println("Shutdown complete")
	case <-ctx.Done():
		fmt.Println("Shutdown timed out")
	}
}
