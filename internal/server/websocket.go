package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/nospy/albion-openradar/internal/logger"
	"github.com/nospy/albion-openradar/internal/photon"
)

const (
	// MaxWebSocketClients is the maximum number of concurrent WebSocket connections
	MaxWebSocketClients = 100
)

// WSMessage represents a message sent to WebSocket clients
type WSMessage struct {
	Code       string `json:"code"`
	Dictionary string `json:"dictionary"`
}

// WebSocketHandler manages WebSocket connections and broadcasts
type WebSocketHandler struct {
	clients   map[*websocket.Conn]bool
	clientsMu sync.RWMutex
	upgrader  websocket.Upgrader
	logger    *logger.Logger
}

// NewWebSocketHandler creates a new WebSocket handler
func NewWebSocketHandler(log *logger.Logger) *WebSocketHandler {
	return &WebSocketHandler{
		clients: make(map[*websocket.Conn]bool),
		logger:  log,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for local development
			},
		},
	}
}

// ServeHTTP implements http.Handler for WebSocket upgrades
func (ws *WebSocketHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ws.handleConnection(w, r)
}

// handleConnection handles new WebSocket connections
func (ws *WebSocketHandler) handleConnection(w http.ResponseWriter, r *http.Request) {
	// Check connection limit before upgrade
	ws.clientsMu.RLock()
	clientCount := len(ws.clients)
	ws.clientsMu.RUnlock()

	if clientCount >= MaxWebSocketClients {
		http.Error(w, "Too many connections", http.StatusServiceUnavailable)
		return
	}

	conn, err := ws.upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Printf("[WS] Upgrade error: %v\n", err)
		return
	}

	// Register client
	ws.clientsMu.Lock()
	ws.clients[conn] = true
	ws.clientsMu.Unlock()

	fmt.Println("[WS] Client connected")

	// Handle incoming messages (for logs from client)
	go ws.handleMessages(conn)
}

// handleMessages handles incoming messages from a client
func (ws *WebSocketHandler) handleMessages(conn *websocket.Conn) {
	defer func() {
		ws.clientsMu.Lock()
		delete(ws.clients, conn)
		ws.clientsMu.Unlock()
		_ = conn.Close()
		fmt.Println("[WS] Client disconnected")
	}()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(
				err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
			) {
				fmt.Printf("[WS] Read error: %v\n", err)
			}
			break
		}

		// Parse incoming message (for logs)
		var data struct {
			Type string        `json:"type"`
			Logs []interface{} `json:"logs"`
		}
		if err := json.Unmarshal(message, &data); err == nil {
			if data.Type == "logs" && len(data.Logs) > 0 && ws.logger != nil {
				ws.logger.WriteLogs(data.Logs)
			}
		}
	}
}

// CloseAllClients closes all WebSocket connections gracefully
func (ws *WebSocketHandler) CloseAllClients() {
	ws.clientsMu.Lock()
	for client := range ws.clients {
		_ = client.WriteMessage(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseGoingAway, "server shutting down"),
		)
		_ = client.Close()
		delete(ws.clients, client)
	}
	ws.clientsMu.Unlock()
}

// Broadcast sends a message to all connected clients
func (ws *WebSocketHandler) Broadcast(msg *WSMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	// Phase 1: Send messages and collect failed clients under RLock
	var failedClients []*websocket.Conn
	ws.clientsMu.RLock()
	for client := range ws.clients {
		if err := client.WriteMessage(websocket.TextMessage, data); err != nil {
			failedClients = append(failedClients, client)
		}
	}
	ws.clientsMu.RUnlock()

	// Phase 2: Remove failed clients under exclusive Lock
	if len(failedClients) > 0 {
		ws.clientsMu.Lock()
		for _, client := range failedClients {
			_ = client.Close()
			delete(ws.clients, client)
		}
		ws.clientsMu.Unlock()
	}
}

// broadcastPayload is a helper to broadcast a typed payload
func (ws *WebSocketHandler) broadcastPayload(code string, payload interface{}) {
	dictJSON, err := json.Marshal(payload)
	if err != nil {
		return
	}
	ws.Broadcast(&WSMessage{
		Code:       code,
		Dictionary: string(dictJSON),
	})
}

// BroadcastEvent broadcasts an event to all clients
func (ws *WebSocketHandler) BroadcastEvent(event *photon.EventData) {
	ws.broadcastPayload("event", map[string]interface{}{
		"code":       event.Code,
		"parameters": event.Parameters,
	})
}

// BroadcastRequest broadcasts a request to all clients
func (ws *WebSocketHandler) BroadcastRequest(req *photon.OperationRequest) {
	ws.broadcastPayload("request", map[string]interface{}{
		"operationCode": req.OperationCode,
		"parameters":    req.Parameters,
	})
}

// BroadcastResponse broadcasts a response to all clients
func (ws *WebSocketHandler) BroadcastResponse(resp *photon.OperationResponse) {
	ws.broadcastPayload("response", map[string]interface{}{
		"operationCode": resp.OperationCode,
		"returnCode":    resp.ReturnCode,
		"debugMessage":  resp.DebugMessage,
		"parameters":    resp.Parameters,
	})
}

// ClientCount returns the number of connected clients
func (ws *WebSocketHandler) ClientCount() int {
	ws.clientsMu.RLock()
	defer ws.clientsMu.RUnlock()
	return len(ws.clients)
}
