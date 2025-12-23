# Release 2.0.0 - Native Go Backend & Modern UI

Major release delivering a **complete backend rewrite to Go** and a **fully modernized UI**. This is the biggest update since the project's inception.

---

## Highlights

### Native Go Backend
- **5x Smaller**: ~95 MB single binary vs ~500 MB (Node.js + assets)
- **Zero Dependencies**: Just Npcap (Windows) or libpcap (Linux)
- **Instant Startup**: No extraction or runtime needed
- **Single Port**: HTTP + WebSocket unified on port 5001

### Modern UI Overhaul
- **HTMX SPA Navigation**: Seamless page transitions without reload
- **Tailwind CSS v4**: Dark theme with custom color palette
- **Vanilla JS**: Lightweight UI controllers (sidebar, accordions)
- **Dynamic Radar**: Adjustable size (300-800px) and zoom (0.5x-2.0x)
- **Player Color Coding**: Green (passive), Orange (faction), Red (hostile)
- **TUI Dashboard**: Real-time stats in terminal

---

## What's New

### For Users
- Faster downloads and startup (~95 MB total vs ~500 MB)
- Modern dark UI with smooth animations
- Adjustable radar size and zoom level
- Instant visual identification of player threats by color
- Floating overlay window with settings sync
- Mobile-responsive interface
- Zone indicator with Black Zone status

### Radar Improvements
- **4-Layer Canvas System**: Optimized rendering pipeline
- **Dynamic Sizing**: 300-800px adjustable via slider
- **Zoom Controls**: 0.5x to 2.0x magnification
- **Distance Rings**: Visual indicators at 10m, 20m intervals
- **Stats Box**: Real-time player/resource/mob counts
- **Threat Border**: Red pulsing border on hostile detection

### Player Display
- **Type-Based Color Coding**:
  - Green (#00ff88) = Passive (not flagged)
  - Orange (#ffa500) = Faction (flagged 1-6)
  - Red (#FF0000) = Hostile (flagged 255)
- Configurable display options (nicknames, equipment, health bars)
- Spell indicators (active and passive)
- Alert system with screen flash and sound

---

## Technical Improvements

<details>
<summary>Click to expand technical details</summary>

### Backend Stack
- **Go 1.25** with gopacket for packet capture
- **Gorilla WebSocket** for real-time updates
- **Native embed.FS** for asset bundling
- **Protocol16** full deserialization (22+ data types)
- **Bubble Tea** TUI framework for terminal dashboard
- **Air** hot-reload for development

### Frontend Stack
- **HTMX 2.0.8** for SPA-like navigation
- **Tailwind CSS v4** with custom dark theme
- **Vanilla JS** for UI state management
- **Canvas API** multi-layer rendering
- **BroadcastChannel** for cross-window sync
- **Lucide Icons** for UI elements

### Performance Comparison

| Metric | v1.x (Node.js) | v2.0 (Go) |
|--------|----------------|-----------|
| Binary | ~100 MB | ~95 MB |
| Assets | ~400 MB (separate) | Embedded |
| **Total** | **~500 MB** | **~95 MB** |
| Ports | 5001 + 5002 | 5001 only |
| Startup | Slow (extraction) | Instant |
| Canvas layers | 7 | 4 (optimized) |
| Rendering | 60 FPS | 30 FPS (CPU efficient) |

### New Architecture

```
cmd/radar/main.go           # Entry point with TUI
internal/
├── capture/pcap.go         # Packet capture (gopacket)
├── photon/                  # Protocol parsing
│   ├── packet.go
│   ├── command.go
│   ├── protocol16.go
│   └── types.go
├── server/
│   ├── http.go             # HTTP + WebSocket
│   └── websocket.go
├── templates/              # Go templates (.gohtml)
│   ├── layouts/
│   ├── pages/
│   └── partials/
├── logger/                 # JSONL logging
└── ui/                     # Bubble Tea dashboard
```

</details>

---

## Breaking Changes

- **WebSocket URL changed**: `ws://localhost:5001/ws` (was port 5002)
- **Build system**: `make dev` replaces `npm run dev`
- **Go 1.23+ required** for development
- **Node.js only needed** for data update scripts
- **Project structure reorganized**:
  - Frontend assets in `web/` (images, scripts, public, sounds)
  - Build tools in `tools/`

---

## Requirements

| Platform | Requirement |
|----------|-------------|
| Windows | Npcap 1.84+ |
| Linux | libpcap + setcap |
| Development | Go 1.23+, Node.js 20+ (optional) |

---

## Installation

### Windows

1. Install **Npcap 1.84+** from [npcap.com](https://npcap.com) ([direct link](https://npcap.com/dist/npcap-1.84.exe))
2. Download and extract the release
3. Run `OpenRadar.exe`
4. Select network adapter (NOT localhost/127.0.0.1)
5. Open http://localhost:5001

### Linux

1. Install dependencies:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install libpcap0.8 libcap2-bin

   # Fedora/RHEL
   sudo dnf install libpcap libcap

   # Arch Linux
   sudo pacman -S libpcap libcap
   ```

2. Grant capture permissions:
   ```bash
   sudo setcap cap_net_raw,cap_net_admin=eip ./OpenRadar-linux
   ```

3. Run `./OpenRadar-linux`
4. Open http://localhost:5001

### Command-line Options

```bash
OpenRadar -version       # Show version
OpenRadar -ip X.X.X.X    # Skip adapter selection
OpenRadar -dev           # Development mode (read files from disk)
```

---

## Migration from v1.x

If upgrading from the Node.js version:

1. Install **Go 1.23+** and Npcap/libpcap
2. Run `make install-tools` for Air (hot-reload)
3. Use `make dev` instead of `npm run dev`
4. Use `make build-win` instead of `npm run build:win`
5. **Update WebSocket URL** to `ws://localhost:5001/ws`

---

## Build from Source

```bash
# Development (hot-reload)
make dev

# Production builds
make build-win        # Windows executable
make build-linux      # Linux via Docker
make build-all        # Both platforms

# Complete release
make all-in-one       # Update data + build + package
```

---

## Documentation

- [RELEASE_NOTES.md](../../RELEASE_NOTES.md) - Full changelog
- [DEV_GUIDE.md](../dev/DEV_GUIDE.md) - Development guide
- [GO_MIGRATION_PLAN.md](../project/GO_MIGRATION_PLAN.md) - Migration details

---

**Full Changelog**: https://github.com/Nouuu/Albion-Online-OpenRadar/compare/1.3.0...2.0.0
