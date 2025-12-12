# OpenRadar Development Guide (v2.0)

> Technical reference for contributors working on OpenRadar's Go backend.

---

## 1. Architecture Overview

### 1.1 High-Level Structure

OpenRadar v2.0 is a native Go application that:

- Captures Albion Online network packets (UDP 5056) using `gopacket/pcap`
- Parses Photon Protocol16 packets into events, requests, and responses
- Sends parsed data to the browser via WebSocket (`/ws`)
- Serves a static SPA using embedded assets (`//go:embed`)

### 1.2 Project Structure

```
OpenRadar/
├── cmd/radar/
│   └── main.go              # Entry point, App struct
├── internal/
│   ├── capture/
│   │   └── pcap.go          # Packet capture (gopacket)
│   ├── photon/
│   │   ├── packet.go        # Photon packet parsing
│   │   ├── command.go       # Command parsing (reliable/unreliable)
│   │   ├── protocol16.go    # Protocol16 deserializer
│   │   ├── reader.go        # Binary reader utilities
│   │   └── types.go         # Type constants
│   ├── server/
│   │   ├── http.go          # HTTP server + routes
│   │   └── websocket.go     # WebSocket handler
│   └── logger/
│       └── logger.go        # JSONL structured logging
├── web/                     # Frontend (embedded at build)
│   ├── images/
│   ├── scripts/             # JavaScript modules
│   ├── public/              # HTML, game data (ao-bin-dumps)
│   └── sounds/
├── tools/                   # Build scripts (Node.js)
├── embed.go                 # //go:embed directives
├── go.mod
└── Makefile
```

---

## 2. Getting Started

### 2.1 Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Go | 1.23+ | [Download](https://go.dev/dl/) |
| Npcap | 1.84+ | Windows only |
| libpcap | Latest | Linux: `apt install libpcap-dev` |
| Node.js | 20+ | For build scripts only |
| Docker | Latest | For Linux cross-compilation |

### 2.2 Quick Setup

```bash
git clone https://github.com/Nouuu/Albion-Online-OpenRadar.git
cd Albion-Online-OpenRadar

# Install Air for hot-reload
make install-tools

# Start development server
make dev
```

### 2.3 Useful Commands

```bash
make help          # Show all commands
make dev           # Hot-reload development
make run           # Run without hot-reload
make build-win     # Build Windows executable
make build-linux   # Build Linux (Docker)
make check         # Verify dependencies
make lint          # Go vet
```

---

## 3. Backend Architecture

### 3.1 Entry Point (`cmd/radar/main.go`)

The `App` struct centralizes all components:

```go
type App struct {
    ctx        context.Context
    cancel     context.CancelFunc
    wg         sync.WaitGroup
    logger     *logger.Logger
    httpServer *server.HTTPServer
    wsHandler  *server.WebSocketHandler
    capturer   *capture.Capturer
}
```

**Flow:**
1. Parse CLI flags (`-dev`, `-ip`, `-version`)
2. Create logger, WebSocket handler, HTTP server
3. Initialize packet capturer with IP selection
4. Register packet handler callback
5. Start servers in goroutines
6. Wait for shutdown signal (Ctrl+C)
7. Graceful shutdown with timeout

### 3.2 Packet Capture (`internal/capture/`)

Uses `gopacket/pcap` to capture UDP packets on port 5056.

**Key functions:**
- `New(ctx, appDir, ipOverride)` - Create capturer
- `Start()` - Blocking capture loop
- `OnPacket(handler)` - Register callback
- `Close()` - Stop capture

**IP Selection (priority order):**
1. `-ip` CLI flag
2. `ip.txt` file
3. Interactive prompt

### 3.3 Photon Protocol (`internal/photon/`)

Parses Photon protocol used by Albion Online.

**Files:**
- `packet.go` - 12-byte Photon packet header
- `command.go` - Command types (Reliable=6, Unreliable=7, Disconnect=4)
- `protocol16.go` - Protocol16 type deserialization
- `reader.go` - Binary reader with position tracking
- `types.go` - Type codes and structs

**Message types:**
- `MessageTypeRequest = 2`
- `MessageTypeResponse = 3`
- `MessageTypeEvent = 4`

**Special handling - Event 3 (Move):**
```go
// Positions are Little-Endian (unlike rest of protocol)
if code == 3 {
    pos0 := Float32LE(bytes[9:13])
    pos1 := Float32LE(bytes[13:17])
    params[4] = pos0  // X
    params[5] = pos1  // Y
}
```

### 3.4 HTTP Server (`internal/server/http.go`)

Single server handling HTTP and WebSocket on port 5001.

**Routes:**
- `/` `/home` `/players` ... → SPA (`index.html`)
- `/ws` → WebSocket upgrade
- `/images/` `/scripts/` `/sounds/` → Static files
- `/ao-bin-dumps/` → Game data (gzip support)
- `/api/settings/server-logs` → Logging API

**Production vs Dev mode:**
- Production: Embedded assets (`embed.FS`)
- Dev (`-dev`): Filesystem (`os.DirFS`)

### 3.5 WebSocket Handler (`internal/server/websocket.go`)

Manages client connections and broadcasts.

**Features:**
- Max 100 concurrent connections
- Two-phase broadcast (RLock for send, Lock for cleanup)
- Graceful close on shutdown

**Message format:**
```json
{
  "code": "event",
  "dictionary": "{\"code\": 3, \"parameters\": {...}}"
}
```

---

## 4. Frontend Architecture

### 4.1 Overview

Static SPA using Alpine.js for routing and state management.

**Key files:**
- `web/public/index.html` - Main SPA with all pages
- `web/scripts/Utils/Utils.js` - WebSocket, handlers, rendering
- `web/scripts/LoggerClient.js` - Client-side logging

### 4.2 WebSocket Connection

```javascript
// Connects to ws://localhost:5001/ws
socket = new WebSocket('ws://localhost:5001/ws');

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    switch (data.code) {
        case 'event': onEvent(data.dictionary.parameters); break;
        case 'request': onRequest(data.dictionary.parameters); break;
        case 'response': onResponse(data.dictionary.parameters); break;
    }
});
```

### 4.3 Handler Classes

| Handler | Purpose |
|---------|---------|
| `PlayersHandler` | Player tracking, equipment, health |
| `MobsHandler` | Mobs, living resources |
| `HarvestablesHandler` | Static resources |
| `ChestsHandler` | Treasure chests |
| `DungeonsHandler` | Dungeon entrances |
| `FishingHandler` | Fishing spots |
| `WispCageHandler` | Wisp cages (mists) |

---

## 5. Build System

### 5.1 Makefile Targets

```makefile
# Development
make dev           # Hot-reload with Air
make run           # Direct run

# Build
make build-win     # Windows executable
make build-linux   # Linux via Docker
make build-all     # Both platforms

# Release
make all-in-one    # Complete workflow:
                   #   1. Update AO data
                   #   2. Compress game data
                   #   3. Build all platforms
                   #   4. Generate README
                   #   5. Restore data
```

### 5.2 Version Management

Version is centralized in `package.json`:

```json
{
  "version": "2.0.0"
}
```

Makefile reads it and injects via ldflags:
```makefile
VERSION := $(shell node -p "require('./package.json').version")
LDFLAGS := -ldflags="-s -w -X main.Version=$(VERSION)"
```

### 5.3 Asset Embedding

`embed.go` at project root:
```go
//go:embed web/images
var Images embed.FS

//go:embed web/scripts
var Scripts embed.FS

//go:embed web/public
var Public embed.FS

//go:embed web/sounds
var Sounds embed.FS
```

### 5.4 Linux Permissions

For packet capture without root:
```bash
sudo setcap cap_net_raw,cap_net_admin=eip ./OpenRadar-linux
```

---

## 6. Testing

### 6.1 Manual Testing

1. Start dev server: `make dev`
2. Open http://localhost:5001
3. Launch Albion Online
4. Verify events appear in browser console

### 6.2 Go Tests

```bash
go test -v ./...
go test -race ./...  # Race detector
```

### 6.3 Linting

```bash
make lint           # Go vet
make lint-frontend  # ESLint
```

---

## 7. Common Tasks

### 7.1 Adding a New Event Handler

1. Add event code to `web/scripts/Utils/EventCodes.js`
2. Add handler in `onEvent()` switch in `Utils.js`
3. Create/update handler class if needed

### 7.2 Updating Game Data

```bash
make update-ao-data   # Download latest from AO dumps
```

### 7.3 Adding a New API Endpoint

In `internal/server/http.go`:
```go
func (s *HTTPServer) setupRoutes() {
    // ...
    s.mux.HandleFunc("/api/my-endpoint", s.handleMyEndpoint)
}

func (s *HTTPServer) handleMyEndpoint(w http.ResponseWriter, r *http.Request) {
    // Implementation
}
```

---

## 8. Troubleshooting

### 8.1 "No network interfaces found"

- Windows: Install Npcap from https://npcap.com
- Linux: Install libpcap-dev

### 8.2 "Permission denied" (Linux)

```bash
sudo setcap cap_net_raw,cap_net_admin=eip ./OpenRadar-linux
# Or run with sudo
```

### 8.3 WebSocket not connecting

Check browser console. Ensure connecting to `ws://localhost:5001/ws` (not port 5002).

### 8.4 Hot-reload not working

Ensure Air is installed:
```bash
go install github.com/air-verse/air@latest
```

---

## 9. Performance Notes

### 9.1 Binary Size

| Component | Size |
|-----------|------|
| Go binary | ~15 MB |
| Embedded web/ | ~80 MB |
| **Total** | **~95 MB** |

vs Node.js v1.x: ~100 MB binary + ~400 MB assets = ~500 MB

### 9.2 Memory Usage

Typical: 30-50 MB during gameplay.

### 9.3 Concurrency

- Packet processing: Single goroutine (callback)
- WebSocket broadcast: RWMutex protected
- HTTP: Go's built-in concurrency

---

*Last update: 2025-12-12 - v2.0 Go Backend*
