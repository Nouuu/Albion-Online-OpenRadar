package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

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
	httpPort = 5001
	wsPort   = 5002
)

func main() {
	// Parse flags
	devMode := flag.Bool("dev", false, "Run in development mode (read files from disk)")
	showVersion := flag.Bool("version", false, "Show version information")
	ipAddr := flag.String("ip", "", "Network adapter IP address (skip interactive prompt)")
	flag.Parse()

	if *showVersion {
		fmt.Printf("OpenRadar v%s (built: %s)\n", Version, BuildTime)
		os.Exit(0)
	}

	fmt.Printf("🎯 OpenRadar v%s\n", Version)
	fmt.Println("====================")

	// Get working directory
	appDir, err := os.Getwd()
	if err != nil {
		fmt.Printf("❌ Failed to get working directory: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("📂 App directory: %s\n", appDir)

	// Create logger
	log := logger.New("./logs")

	// Create WebSocket server
	wsServer := server.NewWebSocketServer(wsPort, log)
	go func() {
		if err := wsServer.Start(); err != nil {
			fmt.Printf("❌ WebSocket server error: %v\n", err)
		}
	}()

	// Create HTTP server
	var httpServer *server.HTTPServer
	if *devMode {
		fmt.Println("🔧 Development mode: reading files from disk")
		httpServer = server.NewHTTPServerDev(httpPort, appDir, log)
	} else {
		fmt.Println("📦 Production mode: using embedded assets")
		httpServer = server.NewHTTPServer(httpPort, assets.Images, assets.Scripts, assets.Public, assets.Sounds, log)
	}
	go func() {
		if err := httpServer.Start(); err != nil {
			fmt.Printf("❌ HTTP server error: %v\n", err)
		}
	}()

	// Create capturer
	cap, err := capture.New(appDir, *ipAddr)
	if err != nil {
		fmt.Printf("❌ Failed to create capturer: %v\n", err)
		os.Exit(1)
	}
	defer cap.Close()

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("\n👋 Shutting down...")
		cap.Close()
		os.Exit(0)
	}()

	// Set packet handler
	cap.OnPacket(func(payload []byte) {
		// Parse Photon packet
		packet, err := photon.ParsePacket(payload)
		if err != nil || packet == nil {
			return
		}

		// Process each command
		for _, cmd := range packet.Commands {
			if cmd.Payload == nil {
				continue
			}

			switch cmd.MessageType {
			case photon.MessageTypeEvent:
				event, err := photon.DeserializeEvent(cmd.Payload)
				if err != nil {
					continue
				}
				// Broadcast to all WebSocket clients
				wsServer.BroadcastEvent(event)

			case photon.MessageTypeRequest:
				req, err := photon.DeserializeRequest(cmd.Payload)
				if err != nil {
					continue
				}
				wsServer.BroadcastRequest(req)

			case photon.MessageTypeResponse:
				resp, err := photon.DeserializeResponse(cmd.Payload)
				if err != nil {
					continue
				}
				wsServer.BroadcastResponse(resp)
			}
		}
	})

	fmt.Printf("\n🌐 Web UI: http://localhost:%d\n", httpPort)
	fmt.Printf("📡 WebSocket: ws://localhost:%d\n", wsPort)
	fmt.Println("\n🔍 Listening for Albion packets on UDP port 5056...")
	fmt.Println("   Press Ctrl+C to stop\n")

	// Start capture (blocking)
	if err := cap.Start(); err != nil {
		fmt.Printf("❌ Capture error: %v\n", err)
		os.Exit(1)
	}
}
