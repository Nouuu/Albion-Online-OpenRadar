# Backend Migration Plan: Node.js → Go

**Date:** 2025-12-07
**Goal:** Replace Node.js backend with Go for a single executable without dependencies

---

## Overview

### Why Go?

- Single executable (no node_modules)
- Native cross-compilation (Linux/Windows/macOS)
- gopacket/pcap mature and well documented
- Native performance, no JS runtime
- //go:embed to include static assets

### Target Architecture

```
Albion-Online-ZQRadar/
├── cmd/
│   └── server/
│       ├── main.go              # Entry point
│       ├── embed.go             # //go:embed directives
│       └── internal/
│           ├── server/
│           │   ├── http.go      # HTTP server + routes
│           │   ├── websocket.go # WebSocket server
│           │   └── templates.go # html/template handlers
│           ├── capture/
│           │   └── pcap.go      # gopacket/pcap wrapper
│           ├── photon/
│           │   ├── packet.go    # PhotonPacket struct
│           │   ├── command.go   # PhotonCommand parser
│           │   └── protocol16.go # Protocol16Deserializer
│           └── logger/
│               └── logger.go    # JSONL logging
├── go.mod
└── go.sum
```

### Go Dependencies

```go
// go.mod
module github.com/nospy/albion-openradar

go 1.22

require (
github.com/google/gopacket v1.1.19
github.com/gorilla/websocket v1.5.1
)
```

### Node.js → Go Mapping

| Node.js                     | Go                                                                | Notes           |
|-----------------------------|-------------------------------------------------------------------|-----------------|
| `app.js`                    | `cmd/server/main.go`                                              | Entry point     |
| `express`                   | `net/http`                                                        | Routes + static |
| `ws`                        | `gorilla/websocket` (Consider https://github.com/coder/websocket) | WebSocket       |
| `cap`                       | `gopacket/pcap`                                                   | Packet capture  |
| `BufferCursor`              | `encoding/binary`                                                 | Binary parsing  |
| `ejs`                       | `html/template`                                                   | Templates       |
| `LoggerServer.js`           | `internal/logger`                                                 | JSONL logs      |
| `Protocol16Deserializer.js` | `internal/photon/protocol16.go`                                   | 15+ types       |

### Implementation Phases

#### Phase 1: Go Setup (1h)

- [ ] Create `cmd/server/` structure
- [ ] Initialize `go.mod`
- [ ] Configure `//go:embed` for assets

#### Phase 2: HTTP Server (2h)

- [ ] Static routes (`/scripts/`, `/images/`, `/sounds/`)
- [ ] Template rendering (`html/template`)
- [ ] API endpoint `/api/settings/server-logs`

#### Phase 3: WebSocket Server (2h)

- [ ] Server on port 5002
- [ ] Broadcast events to clients
- [ ] Receive logs from client

#### Phase 4: Protocol16Deserializer (4h) - CRITICAL

Types to implement:

- [ ] Null, Byte, Boolean, Short, Integer
- [ ] Long, Float, Double, String
- [ ] ByteArray, IntegerArray, StringArray
- [ ] Array, ObjectArray, Hashtable, Dictionary
- [ ] EventData, OperationRequest, OperationResponse

#### Phase 5: Photon Packet Parser (2h)

- [ ] PhotonPacket (header 12 bytes)
- [ ] PhotonCommand (types 4, 6, 7)
- [ ] Reliable command parsing

#### Phase 6: Packet Capture (2h)

- [ ] gopacket/pcap integration
- [ ] Filter UDP port 5056
- [ ] Decode Ethernet → IPv4 → UDP → Photon

#### Phase 7: EJS Templates → Go (3h)

- [ ] Convert `layout.ejs` → `layout.html`
- [ ] Convert `views/main/*.ejs` → `templates/main/*.html`
- [ ] Adapt syntax `<% %>` → `{{ }}`

#### Phase 8: Tests & Validation (2h)

- [ ] Test packet capture
- [ ] Test WebSocket broadcast
- [ ] Compare JSON output with Node.js
- [ ] Cross-platform build

### Build Commands

```bash
# Linux
CGO_ENABLED=1 go build -o dist/OpenRadar-linux ./cmd/server

# Windows (cross-compile from Linux)
CGO_ENABLED=1 CC=x86_64-w64-mingw32-gcc GOOS=windows GOARCH=amd64 \
    go build -o dist/OpenRadar.exe ./cmd/server
```

**Windows Note**: gopacket requires WinPcap/Npcap installed.

---

## DETAILED STEPS

---

## Step 1: Go Project Setup

### 1.1 Create the structure

```bash
mkdir -p cmd/server/internal/{server,capture,photon,logger}
```

### 1.2 Initialize go.mod

```bash
cd /path/to/Albion-Online-ZQRadar
go mod init github.com/nospy/albion-openradar
```

### 1.3 Create cmd/server/main.go

```go
package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
)

const (
	httpPort = 5001
	wsPort   = 5002
)

func main() {
	fmt.Println("OpenRadar Go Server Starting...")

	// TODO: Add components as you go

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
}
```

### 1.4 Test

```bash
go run ./cmd/server
# Should display "OpenRadar Go Server Starting..."
```

---

## Step 2: HTTP Server

### 2.1 Create cmd/server/internal/server/http.go

```go
package server

import (
	"embed"
	"fmt"
	"html/template"
	"io/fs"
	"log"
	"net/http"
)

type HTTPServer struct {
	templates *template.Template
	staticFS  fs.FS
}

func NewHTTPServer(staticFS embed.FS) *HTTPServer {
	return &HTTPServer{
		staticFS: staticFS,
	}
}

func (s *HTTPServer) Start(port int) error {
	mux := http.NewServeMux()

	// Static routes
	mux.Handle("/scripts/", http.FileServer(http.FS(s.staticFS)))
	mux.Handle("/images/", http.FileServer(http.FS(s.staticFS)))
	mux.Handle("/sounds/", http.FileServer(http.FS(s.staticFS)))
	mux.Handle("/config/", http.FileServer(http.FS(s.staticFS)))

	// Page routes
	mux.HandleFunc("/", s.handleHome)
	mux.HandleFunc("/home", s.handleHome)
	mux.HandleFunc("/radar-overlay", s.handleOverlay)

	// API
	mux.HandleFunc("/api/settings/server-logs", s.handleLogsAPI)

	addr := fmt.Sprintf(":%d", port)
	log.Printf("HTTP server listening on http://localhost%s", addr)
	return http.ListenAndServe(addr, mux)
}

func (s *HTTPServer) handleHome(w http.ResponseWriter, r *http.Request) {
	// TODO: Render template
	w.Write([]byte("Home page - TODO"))
}

func (s *HTTPServer) handleOverlay(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("Overlay page - TODO"))
}

func (s *HTTPServer) handleLogsAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"enabled": true}`))
}
```

### 2.2 Create cmd/server/embed.go

```go
package main

import "embed"

//go:embed views scripts images sounds config public
var staticFS embed.FS
```

### 2.3 Update main.go

```go
package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/nospy/albion-openradar/cmd/server/internal/server"
)

func main() {
	fmt.Println("OpenRadar Go Server Starting...")

	// HTTP Server
	httpServer := server.NewHTTPServer(staticFS)
	go func() {
		if err := httpServer.Start(5001); err != nil {
			log.Fatal(err)
		}
	}()

	// Wait for signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
}
```

---

## Step 3: WebSocket Server

### 3.1 Install gorilla/websocket

```bash
go get github.com/gorilla/websocket
```

### 3.2 Create cmd/server/internal/server/websocket.go

```go
package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type WSServer struct {
	clients   map[*websocket.Conn]bool
	clientsMu sync.RWMutex
}

func NewWSServer() *WSServer {
	return &WSServer{
		clients: make(map[*websocket.Conn]bool),
	}
}

func (ws *WSServer) Start(port int) error {
	http.HandleFunc("/", ws.handleConnection)

	addr := fmt.Sprintf("localhost:%d", port)
	log.Printf("WebSocket server listening on ws://%s", addr)
	return http.ListenAndServe(addr, nil)
}

func (ws *WSServer) handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}
	defer conn.Close()

	ws.clientsMu.Lock()
	ws.clients[conn] = true
	ws.clientsMu.Unlock()

	log.Println("Client connected")

	// Read messages from client
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}
		// Process client logs if needed
		log.Printf("Received: %s", message)
	}

	ws.clientsMu.Lock()
	delete(ws.clients, conn)
	ws.clientsMu.Unlock()
	log.Println("Client disconnected")
}

// Broadcast sends to all clients
func (ws *WSServer) Broadcast(code string, data interface{}) {
	msg := map[string]interface{}{
		"code":       code,
		"dictionary": data,
	}

	jsonData, err := json.Marshal(msg)
	if err != nil {
		return
	}

	ws.clientsMu.RLock()
	defer ws.clientsMu.RUnlock()

	for client := range ws.clients {
		client.WriteMessage(websocket.TextMessage, jsonData)
	}
}
```

---

## Step 4: Protocol16 Deserializer (CRITICAL)

### 4.1 Create cmd/server/internal/photon/types.go

```go
package photon

// Protocol16Type codes (Big-Endian)
const (
	TypeUnknown           byte = 0
	TypeNull              byte = 42  // '*'
	TypeDictionary        byte = 68  // 'D'
	TypeStringArray       byte = 97  // 'a'
	TypeByte              byte = 98  // 'b'
	TypeDouble            byte = 100 // 'd'
	TypeEventData         byte = 101 // 'e'
	TypeFloat             byte = 102 // 'f'
	TypeHashtable         byte = 104 // 'h'
	TypeInteger           byte = 105 // 'i'
	TypeShort             byte = 107 // 'k'
	TypeLong              byte = 108 // 'l'
	TypeIntegerArray      byte = 110 // 'n'
	TypeBoolean           byte = 111 // 'o'
	TypeOperationResponse byte = 112 // 'p'
	TypeOperationRequest  byte = 113 // 'q'
	TypeString            byte = 115 // 's'
	TypeByteArray         byte = 120 // 'x'
	TypeArray             byte = 121 // 'y'
	TypeObjectArray       byte = 122 // 'z'
)
```

### 4.2 Create cmd/server/internal/photon/protocol16.go

```go
package photon

import (
	"encoding/binary"
	"fmt"
	"io"
	"math"
)

type Protocol16Reader struct {
	data []byte
	pos  int
}

func NewProtocol16Reader(data []byte) *Protocol16Reader {
	return &Protocol16Reader{data: data, pos: 0}
}

func (r *Protocol16Reader) ReadByte() (byte, error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	b := r.data[r.pos]
	r.pos++
	return b, nil
}

func (r *Protocol16Reader) ReadUint16BE() (uint16, error) {
	if r.pos+2 > len(r.data) {
		return 0, io.EOF
	}
	v := binary.BigEndian.Uint16(r.data[r.pos:])
	r.pos += 2
	return v, nil
}

func (r *Protocol16Reader) ReadUint32BE() (uint32, error) {
	if r.pos+4 > len(r.data) {
		return 0, io.EOF
	}
	v := binary.BigEndian.Uint32(r.data[r.pos:])
	r.pos += 4
	return v, nil
}

func (r *Protocol16Reader) ReadInt64BE() (int64, error) {
	if r.pos+8 > len(r.data) {
		return 0, io.EOF
	}
	v := int64(binary.BigEndian.Uint64(r.data[r.pos:]))
	r.pos += 8
	return v, nil
}

func (r *Protocol16Reader) ReadFloat32BE() (float32, error) {
	if r.pos+4 > len(r.data) {
		return 0, io.EOF
	}
	bits := binary.BigEndian.Uint32(r.data[r.pos:])
	r.pos += 4
	return math.Float32frombits(bits), nil
}

func (r *Protocol16Reader) ReadFloat64BE() (float64, error) {
	if r.pos+8 > len(r.data) {
		return 0, io.EOF
	}
	bits := binary.BigEndian.Uint64(r.data[r.pos:])
	r.pos += 8
	return math.Float64frombits(bits), nil
}

func (r *Protocol16Reader) ReadBytes(n int) ([]byte, error) {
	if r.pos+n > len(r.data) {
		return nil, io.EOF
	}
	b := r.data[r.pos : r.pos+n]
	r.pos += n
	return b, nil
}

func (r *Protocol16Reader) Skip(n int) {
	r.pos += n
}

func (r *Protocol16Reader) Remaining() []byte {
	return r.data[r.pos:]
}

// Deserialize reads a value according to the typeCode
func (r *Protocol16Reader) Deserialize(typeCode byte) (interface{}, error) {
	switch typeCode {
	case TypeUnknown, TypeNull:
		return nil, nil
	case TypeByte:
		return r.ReadByte()
	case TypeBoolean:
		b, err := r.ReadByte()
		return b != 0, err
	case TypeShort:
		return r.ReadUint16BE()
	case TypeInteger:
		return r.ReadUint32BE()
	case TypeLong:
		return r.ReadInt64BE()
	case TypeFloat:
		return r.ReadFloat32BE()
	case TypeDouble:
		return r.ReadFloat64BE()
	case TypeString:
		return r.ReadString()
	case TypeByteArray:
		return r.ReadByteArray()
	case TypeIntegerArray:
		return r.ReadIntegerArray()
	case TypeStringArray:
		return r.ReadStringArray()
	case TypeArray:
		return r.ReadArray()
	case TypeObjectArray:
		return r.ReadObjectArray()
	case TypeHashtable:
		return r.ReadHashtable()
	case TypeDictionary:
		return r.ReadDictionary()
	case TypeEventData:
		return r.ReadEventData()
	case TypeOperationRequest:
		return r.ReadOperationRequest()
	case TypeOperationResponse:
		return r.ReadOperationResponse()
	default:
		return nil, fmt.Errorf("unknown type code: %d", typeCode)
	}
}

func (r *Protocol16Reader) ReadString() (string, error) {
	size, err := r.ReadUint16BE()
	if err != nil {
		return "", err
	}
	if size == 0 {
		return "", nil
	}
	b, err := r.ReadBytes(int(size))
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func (r *Protocol16Reader) ReadByteArray() ([]byte, error) {
	size, err := r.ReadUint32BE()
	if err != nil {
		return nil, err
	}
	return r.ReadBytes(int(size))
}

func (r *Protocol16Reader) ReadIntegerArray() ([]uint32, error) {
	size, err := r.ReadUint32BE()
	if err != nil {
		return nil, err
	}
	arr := make([]uint32, size)
	for i := uint32(0); i < size; i++ {
		arr[i], err = r.ReadUint32BE()
		if err != nil {
			return nil, err
		}
	}
	return arr, nil
}

func (r *Protocol16Reader) ReadStringArray() ([]string, error) {
	size, err := r.ReadUint16BE()
	if err != nil {
		return nil, err
	}
	arr := make([]string, size)
	for i := uint16(0); i < size; i++ {
		arr[i], err = r.ReadString()
		if err != nil {
			return nil, err
		}
	}
	return arr, nil
}

func (r *Protocol16Reader) ReadArray() ([]interface{}, error) {
	size, err := r.ReadUint16BE()
	if err != nil {
		return nil, err
	}
	typeCode, err := r.ReadByte()
	if err != nil {
		return nil, err
	}
	arr := make([]interface{}, size)
	for i := uint16(0); i < size; i++ {
		arr[i], err = r.Deserialize(typeCode)
		if err != nil {
			return nil, err
		}
	}
	return arr, nil
}

func (r *Protocol16Reader) ReadObjectArray() ([]interface{}, error) {
	size, err := r.ReadUint16BE()
	if err != nil {
		return nil, err
	}
	arr := make([]interface{}, size)
	for i := uint16(0); i < size; i++ {
		typeCode, err := r.ReadByte()
		if err != nil {
			return nil, err
		}
		arr[i], err = r.Deserialize(typeCode)
		if err != nil {
			return nil, err
		}
	}
	return arr, nil
}

func (r *Protocol16Reader) ReadHashtable() (map[interface{}]interface{}, error) {
	size, err := r.ReadUint16BE()
	if err != nil {
		return nil, err
	}
	return r.readDictionaryElements(int(size), 0, 0)
}

func (r *Protocol16Reader) ReadDictionary() (map[interface{}]interface{}, error) {
	keyType, err := r.ReadByte()
	if err != nil {
		return nil, err
	}
	valueType, err := r.ReadByte()
	if err != nil {
		return nil, err
	}
	size, err := r.ReadUint16BE()
	if err != nil {
		return nil, err
	}
	return r.readDictionaryElements(int(size), keyType, valueType)
}

func (r *Protocol16Reader) readDictionaryElements(size int, keyType, valueType byte) (map[interface{}]interface{}, error) {
	result := make(map[interface{}]interface{})
	for i := 0; i < size; i++ {
		kt := keyType
		if kt == 0 || kt == 42 {
			var err error
			kt, err = r.ReadByte()
			if err != nil {
				return nil, err
			}
		}
		key, err := r.Deserialize(kt)
		if err != nil {
			return nil, err
		}

		vt := valueType
		if vt == 0 || vt == 42 {
			vt, err = r.ReadByte()
			if err != nil {
				return nil, err
			}
		}
		value, err := r.Deserialize(vt)
		if err != nil {
			return nil, err
		}
		result[key] = value
	}
	return result, nil
}

// EventData structure
type EventData struct {
	Code       byte
	Parameters map[interface{}]interface{}
}

func (r *Protocol16Reader) ReadEventData() (*EventData, error) {
	code, err := r.ReadByte()
	if err != nil {
		return nil, err
	}
	params, err := r.ReadParameterTable()
	if err != nil {
		return nil, err
	}
	return &EventData{Code: code, Parameters: params}, nil
}

// OperationRequest structure
type OperationRequest struct {
	OperationCode byte
	Parameters    map[interface{}]interface{}
}

func (r *Protocol16Reader) ReadOperationRequest() (*OperationRequest, error) {
	opCode, err := r.ReadByte()
	if err != nil {
		return nil, err
	}
	params, err := r.ReadParameterTable()
	if err != nil {
		return nil, err
	}
	return &OperationRequest{OperationCode: opCode, Parameters: params}, nil
}

// OperationResponse structure
type OperationResponse struct {
	OperationCode byte
	ReturnCode    uint16
	DebugMessage  interface{}
	Parameters    map[interface{}]interface{}
}

func (r *Protocol16Reader) ReadOperationResponse() (*OperationResponse, error) {
	opCode, err := r.ReadByte()
	if err != nil {
		return nil, err
	}
	returnCode, err := r.ReadUint16BE()
	if err != nil {
		return nil, err
	}
	msgType, err := r.ReadByte()
	if err != nil {
		return nil, err
	}
	debugMsg, err := r.Deserialize(msgType)
	if err != nil {
		return nil, err
	}
	params, err := r.ReadParameterTable()
	if err != nil {
		return nil, err
	}
	return &OperationResponse{
		OperationCode: opCode,
		ReturnCode:    returnCode,
		DebugMessage:  debugMsg,
		Parameters:    params,
	}, nil
}

func (r *Protocol16Reader) ReadParameterTable() (map[interface{}]interface{}, error) {
	// Skip 1 byte, read size
	r.Skip(1)
	size, err := r.ReadUint16BE()
	if err != nil {
		return nil, err
	}

	result := make(map[interface{}]interface{})
	for i := uint16(0); i < size; i++ {
		key, err := r.ReadByte()
		if err != nil {
			return nil, err
		}
		valueType, err := r.ReadByte()
		if err != nil {
			return nil, err
		}
		value, err := r.Deserialize(valueType)
		if err != nil {
			return nil, err
		}
		result[key] = value
	}
	return result, nil
}
```

---

## Step 5: Photon Packet Parser

### 5.1 Create cmd/server/internal/photon/packet.go

```go
package photon

import (
	"encoding/binary"
	"fmt"
)

// PhotonPacket represents a Photon packet (header 12 bytes)
type PhotonPacket struct {
	PeerID       uint16
	Flags        byte
	CommandCount byte
	Timestamp    uint32
	Challenge    uint32
	Commands     []*PhotonCommand
}

func ParsePhotonPacket(data []byte) (*PhotonPacket, error) {
	if len(data) < 12 {
		return nil, fmt.Errorf("packet too short")
	}

	p := &PhotonPacket{
		PeerID:       binary.BigEndian.Uint16(data[0:2]),
		Flags:        data[2],
		CommandCount: data[3],
		Timestamp:    binary.BigEndian.Uint32(data[4:8]),
		Challenge:    binary.BigEndian.Uint32(data[8:12]),
	}

	// Parse commands
	offset := 12
	for i := byte(0); i < p.CommandCount && offset < len(data); i++ {
		cmd, cmdLen, err := ParsePhotonCommand(data[offset:])
		if err != nil {
			break
		}
		p.Commands = append(p.Commands, cmd)
		offset += cmdLen
	}

	return p, nil
}
```

### 5.2 Create cmd/server/internal/photon/command.go

```go
package photon

import (
	"encoding/binary"
	"fmt"
)

const (
	CommandDisconnect = 4
	CommandReliable   = 6
	CommandUnreliable = 7
)

const (
	MessageRequest  = 2
	MessageResponse = 3
	MessageEvent    = 4
)

type PhotonCommand struct {
	CommandType    byte
	ChannelID      byte
	CommandFlags   byte
	CommandLength  uint32
	SequenceNumber uint32
	MessageType    byte
	Data           interface{}
}

func ParsePhotonCommand(data []byte) (*PhotonCommand, int, error) {
	if len(data) < 12 {
		return nil, 0, fmt.Errorf("command too short")
	}

	cmd := &PhotonCommand{
		CommandType:  data[0],
		ChannelID:    data[1],
		CommandFlags: data[2],
		// Skip byte 3
		CommandLength:  binary.BigEndian.Uint32(data[4:8]),
		SequenceNumber: binary.BigEndian.Uint32(data[8:12]),
	}

	payloadStart := 12
	payloadEnd := int(cmd.CommandLength)

	switch cmd.CommandType {
	case CommandReliable:
		if payloadEnd > len(data) {
			return nil, 0, fmt.Errorf("payload too short")
		}
		payload := data[payloadStart:payloadEnd]
		if len(payload) >= 2 {
			cmd.MessageType = payload[1]
			reader := NewProtocol16Reader(payload[2:])

			switch cmd.MessageType {
			case MessageRequest:
				cmd.Data, _ = reader.ReadOperationRequest()
			case MessageResponse:
				cmd.Data, _ = reader.ReadOperationResponse()
			case MessageEvent:
				cmd.Data, _ = reader.ReadEventData()
			}
		}

	case CommandUnreliable:
		// Skip 4 bytes to match reliable
		if payloadEnd > len(data) {
			return nil, 0, fmt.Errorf("payload too short")
		}
		payload := data[payloadStart:payloadEnd]
		if len(payload) >= 6 {
			cmd.MessageType = payload[5]
			reader := NewProtocol16Reader(payload[6:])

			switch cmd.MessageType {
			case MessageRequest:
				cmd.Data, _ = reader.ReadOperationRequest()
			case MessageResponse:
				cmd.Data, _ = reader.ReadOperationResponse()
			case MessageEvent:
				cmd.Data, _ = reader.ReadEventData()
			}
		}

	case CommandDisconnect:
		// Nothing to do
	}

	return cmd, int(cmd.CommandLength), nil
}
```

---

## Step 6: Packet Capture with gopacket

### 6.1 Install gopacket

```bash
go get github.com/google/gopacket
go get github.com/google/gopacket/pcap
```

### 6.2 Create cmd/server/internal/capture/pcap.go

```go
package capture

import (
	"fmt"
	"log"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
)

type PacketCallback func(payload []byte)

type Capturer struct {
	handle   *pcap.Handle
	callback PacketCallback
}

func NewCapturer(deviceIP string, callback PacketCallback) (*Capturer, error) {
	// Find the interface
	devices, err := pcap.FindAllDevs()
	if err != nil {
		return nil, err
	}

	var deviceName string
	for _, device := range devices {
		for _, addr := range device.Addresses {
			if addr.IP.String() == deviceIP {
				deviceName = device.Name
				break
			}
		}
	}

	if deviceName == "" {
		return nil, fmt.Errorf("device with IP %s not found", deviceIP)
	}

	// Open capture
	handle, err := pcap.OpenLive(deviceName, 4096, false, pcap.BlockForever)
	if err != nil {
		return nil, err
	}

	// Filter UDP port 5056
	if err := handle.SetBPFFilter("udp and (dst port 5056 or src port 5056)"); err != nil {
		handle.Close()
		return nil, err
	}

	return &Capturer{handle: handle, callback: callback}, nil
}

func (c *Capturer) Start() {
	packetSource := gopacket.NewPacketSource(c.handle, c.handle.LinkType())

	for packet := range packetSource.Packets() {
		// Extract UDP payload
		if udpLayer := packet.Layer(layers.LayerTypeUDP); udpLayer != nil {
			udp, _ := udpLayer.(*layers.UDP)
			if len(udp.Payload) > 0 {
				c.callback(udp.Payload)
			}
		}
	}
}

func (c *Capturer) Stop() {
	if c.handle != nil {
		c.handle.Close()
	}
}

// ListDevices lists available interfaces
func ListDevices() {
	devices, err := pcap.FindAllDevs()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Available network interfaces:")
	for _, device := range devices {
		fmt.Printf("  %s\n", device.Name)
		for _, addr := range device.Addresses {
			fmt.Printf("    IP: %s\n", addr.IP)
		}
	}
}
```

---

## Step 7: EJS Templates → html/template

### Syntax conversion

| EJS                          | Go html/template          |
|------------------------------|---------------------------|
| `<%= var %>`                 | `{{ .Var }}`              |
| `<%- include('file') %>`     | `{{ template "file" . }}` |
| `<% if (cond) { %>`          | `{{ if .Cond }}`          |
| `<% } %>`                    | `{{ end }}`               |
| `<% for (var x of arr) { %>` | `{{ range .Arr }}`        |

### Example: layout.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>OpenRadar</title>
    <link rel="stylesheet" href="/scripts/styles/index.css">
</head>
<body>
{{ template "content" . }}

<script type="module" src="/scripts/Utils/Utils.js"></script>
</body>
</html>
```

---

## Step 8: Final build

### 8.1 Build Linux

```bash
CGO_ENABLED=1 go build -o dist/OpenRadar-linux ./cmd/server
```

### 8.2 Build Windows (cross-compile)

```bash
# Install mingw-w64
sudo apt install mingw-w64

# Build
CGO_ENABLED=1 CC=x86_64-w64-mingw32-gcc \
    GOOS=windows GOARCH=amd64 \
    go build -o dist/OpenRadar.exe ./cmd/server
```

### 8.3 Windows prerequisites

- Npcap installed (https://npcap.com/)
- Or WinPcap

---

## Validation checklist

- [ ] `go run ./cmd/server` starts without error
- [ ] HTTP server responds on http://localhost:5001
- [ ] WebSocket accepts connections on ws://localhost:5002
- [ ] Captures UDP packets on port 5056
- [ ] Parses Photon packets correctly
- [ ] JSON output identical to Node.js
- [ ] Linux build works
- [ ] Windows build works

---

## Total estimation

| Phase          | Duration |
|----------------|----------|
| Go setup       | 1h       |
| HTTP Server    | 2h       |
| WebSocket      | 2h       |
| Protocol16     | 4h       |
| Photon Parser  | 2h       |
| Packet Capture | 2h       |
| Templates      | 3h       |
| Tests          | 2h       |
| **Total**      | **~18h** |

---

## CORRECTIONS CRITIQUES (2025-12-12)

> ⚠️ **IMPORTANT**: Les sections ci-dessous contiennent des corrections par rapport au code proposé plus haut.

### 1. Event 3 - Extraction positions mobs/ressources (MANQUANT)

Le code `deserializeEventData` dans Step 4 **ne gère pas** le traitement spécial de l'Event 3.

**Code actuel Node.js** (`Protocol16Deserializer.js:206-217`):
```javascript
if (code == 3) {
    var bytes = new Uint8Array(parameters[1]);
    var position0 = new DataView(bytes.buffer, 9, 4).getFloat32(0, true);  // Little-Endian!
    var position1 = new DataView(bytes.buffer, 13, 4).getFloat32(0, true); // Little-Endian!
    parameters[4] = position0;
    parameters[5] = position1;
    parameters[252] = 3;
}
```

**Code Go à ajouter dans `ReadEventData()`:**
```go
func (r *Protocol16Reader) ReadEventData() (*EventData, error) {
    code, err := r.ReadByte()
    if err != nil {
        return nil, err
    }
    params, err := r.ReadParameterTable()
    if err != nil {
        return nil, err
    }

    // ⚠️ CRITICAL: Event 3 - Extract mob/resource positions
    if code == 3 {
        if byteArray, ok := params[byte(1)].([]byte); ok && len(byteArray) >= 17 {
            // Positions are Little-Endian (unlike rest of Photon protocol!)
            pos0 := math.Float32frombits(binary.LittleEndian.Uint32(byteArray[9:13]))
            pos1 := math.Float32frombits(binary.LittleEndian.Uint32(byteArray[13:17]))
            params[byte(4)] = pos0
            params[byte(5)] = pos1
            params[byte(252)] = byte(3)
        }
    }

    return &EventData{Code: code, Parameters: params}, nil
}
```

### 2. Endianness - ATTENTION

- **Protocole Photon**: Big-Endian (tout sauf Event 3)
- **Event 3 positions**: **Little-Endian** pour les float32

### 3. deserializeParameterTable - Comportement spécifique

Le code Node.js lit `tableSize` à offset 1 sans avancer le curseur:
```javascript
const tableSize = input.readUInt16BE(1);  // Lit à offset 1
let offset = 3;  // Commence à offset 3
```

Cela suggère que le premier byte est ignoré (probablement un type code ou padding).

---

## STRATÉGIE TEMPLATES EJS (2025-12-12)

### Analyse des templates

**Découverte:** La conversion EJS → HTML statique est **SIMPLE** car:
- **Une seule ligne EJS**: `<%- include(mainContent) %>` (layout.ejs:147)
- **Aucune variable serveur** - tout est côté client (localStorage, WebSocket)
- Alpine.js gère déjà la navigation

### Décision

**SPA avec routing Alpine.js:**
- `public/index.html` = layout + toutes les pages inline avec `x-show`
- `public/radar-overlay.html` = copie directe (déjà standalone)

---

## PROGRESSION

| Itération | Status | Date | Notes |
|-----------|--------|------|-------|
| 0. EJS → HTML | **TERMINÉ** | 2025-12-12 | SPA créée, à tester |
| 1. Capture | À faire | - | - |
| 2. Photon | À faire | - | - |
| 3. Protocol16 | À faire | - | - |
| 4. WebSocket | À faire | - | - |
| 5. HTTP | À faire | - | - |

### Fichiers créés (Itération 0)

```
public/
├── index.html              # Layout + routeur Alpine.js
├── radar-overlay.html      # Page overlay standalone
└── pages/
    ├── drawing.html        # Page radar principale
    ├── players.html        # Page joueurs
    ├── enemies.html        # Page ennemis/mobs
    ├── resources.html      # Page ressources
    ├── chests.html         # Page coffres/donjons
    ├── ignorelist.html     # Page liste ignorés
    ├── settings.html       # Page paramètres
    └── map.html            # Page carte

scripts/
└── init-alpine-spa.js      # Routeur SPA Alpine.js
```
