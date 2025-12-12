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

// WSMessage represents a message sent to WebSocket clients
type WSMessage struct {
	Code       string `json:"code"`
	Dictionary string `json:"dictionary"`
}

// WebSocketServer manages WebSocket connections and broadcasts
type WebSocketServer struct {
	clients   map[*websocket.Conn]bool
	clientsMu sync.RWMutex
	upgrader  websocket.Upgrader
	port      int
	logger    *logger.Logger
}

// NewWebSocketServer creates a new WebSocket server
func NewWebSocketServer(port int, log *logger.Logger) *WebSocketServer {
	return &WebSocketServer{
		clients: make(map[*websocket.Conn]bool),
		port:    port,
		logger:  log,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for local development
			},
		},
	}
}

// Start starts the WebSocket server
func (ws *WebSocketServer) Start() error {
	http.HandleFunc("/", ws.handleConnection)

	addr := fmt.Sprintf("localhost:%d", ws.port)
	fmt.Printf("📡 WebSocket server started on ws://%s\n", addr)

	return http.ListenAndServe(addr, nil)
}

// handleConnection handles new WebSocket connections
func (ws *WebSocketServer) handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := ws.upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Printf("❌ WebSocket upgrade error: %v\n", err)
		return
	}

	// Register client
	ws.clientsMu.Lock()
	ws.clients[conn] = true
	ws.clientsMu.Unlock()

	fmt.Println("📡 [WS] Client connected")

	// Handle incoming messages (for logs from client)
	go ws.handleMessages(conn)
}

// handleMessages handles incoming messages from a client
func (ws *WebSocketServer) handleMessages(conn *websocket.Conn) {
	defer func() {
		ws.clientsMu.Lock()
		delete(ws.clients, conn)
		ws.clientsMu.Unlock()
		conn.Close()
		fmt.Println("📡 [WS] Client disconnected")
	}()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				fmt.Printf("❌ [WS] Read error: %v\n", err)
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

// Broadcast sends a message to all connected clients
func (ws *WebSocketServer) Broadcast(msg *WSMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	ws.clientsMu.RLock()
	defer ws.clientsMu.RUnlock()

	for client := range ws.clients {
		err := client.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			client.Close()
			delete(ws.clients, client)
		}
	}
}

// BroadcastEvent broadcasts an event to all clients
func (ws *WebSocketServer) BroadcastEvent(event *photon.EventData) {
	dictJSON, err := json.Marshal(map[string]interface{}{
		"code":       event.Code,
		"parameters": event.Parameters,
	})
	if err != nil {
		return
	}

	ws.Broadcast(&WSMessage{
		Code:       "event",
		Dictionary: string(dictJSON),
	})
}

// BroadcastRequest broadcasts a request to all clients
func (ws *WebSocketServer) BroadcastRequest(req *photon.OperationRequest) {
	dictJSON, err := json.Marshal(map[string]interface{}{
		"operationCode": req.OperationCode,
		"parameters":    req.Parameters,
	})
	if err != nil {
		return
	}

	ws.Broadcast(&WSMessage{
		Code:       "request",
		Dictionary: string(dictJSON),
	})
}

// BroadcastResponse broadcasts a response to all clients
func (ws *WebSocketServer) BroadcastResponse(resp *photon.OperationResponse) {
	dictJSON, err := json.Marshal(map[string]interface{}{
		"operationCode": resp.OperationCode,
		"returnCode":    resp.ReturnCode,
		"debugMessage":  resp.DebugMessage,
		"parameters":    resp.Parameters,
	})
	if err != nil {
		return
	}

	ws.Broadcast(&WSMessage{
		Code:       "response",
		Dictionary: string(dictJSON),
	})
}

// ClientCount returns the number of connected clients
func (ws *WebSocketServer) ClientCount() int {
	ws.clientsMu.RLock()
	defer ws.clientsMu.RUnlock()
	return len(ws.clients)
}
