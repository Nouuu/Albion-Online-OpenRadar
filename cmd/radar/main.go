package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/nospy/albion-openradar/internal/capture"
	"github.com/nospy/albion-openradar/internal/photon"
	"github.com/nospy/albion-openradar/internal/server"
)

const (
	httpPort = 5001
	wsPort   = 5002
)

func main() {
	fmt.Println("🎯 OpenRadar Go v2.0")
	fmt.Println("====================")

	// Get working directory
	appDir, err := os.Getwd()
	if err != nil {
		fmt.Printf("❌ Failed to get working directory: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("📂 App directory: %s\n", appDir)

	// Create WebSocket server
	wsServer := server.NewWebSocketServer(wsPort)
	go func() {
		if err := wsServer.Start(); err != nil {
			fmt.Printf("❌ WebSocket server error: %v\n", err)
		}
	}()

	// Create HTTP server
	httpServer := server.NewHTTPServer(httpPort, appDir)
	go func() {
		if err := httpServer.Start(); err != nil {
			fmt.Printf("❌ HTTP server error: %v\n", err)
		}
	}()

	// Create capturer
	cap, err := capture.New(appDir)
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
