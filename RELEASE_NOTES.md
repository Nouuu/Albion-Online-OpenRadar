# Release Notes

## Version 2.0.0 - Native Go Backend & Modern UI

**Release Date:** December 2024

### Highlights

#### Backend
- **5x Smaller**: ~95 MB single binary vs ~500 MB (Node.js + assets)
- **Zero Dependencies**: Just Npcap (Windows) or libpcap (Linux)
- **Instant Startup**: No extraction or runtime needed
- **Single Port**: HTTP + WebSocket on port 5001

#### UI Overhaul
- **Modern SPA**: HTMX-powered navigation with smooth transitions
- **Dark Theme**: Tailwind CSS v4 with custom color palette
- **Dynamic Radar**: Adjustable size (300-800px) and zoom (0.5x-2.0x)
- **Player Colors**: Green (passive), Orange (faction), Red (hostile)
- **TUI Dashboard**: Real-time stats in terminal

---

### Breaking Changes

- Complete backend rewrite from Node.js to Go
- WebSocket endpoint changed: `ws://localhost:5001/ws` (was port 5002)
- Project structure reorganized:
  - Frontend assets in `web/` (images, scripts, public, sounds)
  - Build tools in `tools/`
- Requires Go 1.23+ for development

### New Features

#### Backend Features
- **Single Binary Distribution**: All assets embedded - no external files
- **Unified Server**: HTTP and WebSocket on single port (5001)
- **Graceful Shutdown**: Clean resource cleanup on Ctrl+C
- **Development Mode**: `-dev` flag for hot-reload with Air
- **Cross-platform Builds**: Native Windows, Linux via Docker
- **Pre-compressed Game Data**: Gzip for faster loading
- **Intelligent Caching**: Images 24h, game data 7 days
- **Connection Limits**: Max 100 WebSocket clients
- **Structured Logging**: JSONL with streaming line count

#### UI Features
- **HTMX SPA Navigation**: Seamless page transitions without full reload
- **Go Templates (.gohtml)**: Server-side rendering with custom functions
- **Tailwind CSS v4**: Utility-first styling with dark theme
- **Alpine.js**: Lightweight reactive components
- **4-Layer Canvas System**: Optimized rendering pipeline
  - Map layer (background)
  - Draw layer (resources, mobs, players)
  - Player layer (local player indicator)
  - UI layer (zone info, stats, threat border)

#### Radar Controls
- **Dynamic Sizing**: 300-800px adjustable via slider
- **Zoom Controls**: 0.5x to 2.0x magnification
- **Distance Rings**: Visual indicators at 10m, 20m intervals
- **Zone Indicator**: Current zone with Black Zone status
- **Stats Box**: Real-time player/resource/mob counts
- **Threat Border**: Red pulsing border on hostile player detection

#### Player Display
- **Type-Based Color Coding**:
  - Green (#00ff88) = Passive (not flagged)
  - Orange (#ffa500) = Faction (flagged 1-6)
  - Red (#FF0000) = Hostile (flagged 255)
- **Configurable Display**: Nicknames, equipment icons, health bars
- **Spell Indicators**: Active and passive spell overlays
- **Alert System**: Screen flash and sound on hostile detection

#### Navigation & Layout
- **Collapsible Sidebar**: Icon-only mode with hover expansion
- **Mobile Responsive**: Full-width overlay on smaller screens
- **Page Transitions**: Fade animations (150ms)
- **Active State Indication**: Accent color with left border

#### Overlay Window
- **Floating Radar**: Standalone window with transparent background
- **Settings Sync**: BroadcastChannel API for instant synchronization
- **Auto-hiding Controls**: Fade to 20% opacity after 2 seconds
- **Keyboard Shortcuts**: ESC to close

### Performance Improvements

| Metric | v1.x (Node.js) | v2.0 (Go) |
|--------|----------------|-----------|
| Binary | ~100 MB | ~95 MB |
| Assets | ~400 MB (separate) | Embedded |
| **Total** | **~500 MB** | **~95 MB** |
| Ports | 5001 + 5002 | 5001 only |
| Startup | Slow (extraction) | Instant |
| Canvas layers | 7 | 4 (optimized) |
| Rendering | 60 FPS | 30 FPS (CPU efficient) |
| Templates | EJS (runtime) | Go (compiled) |
| Navigation | Full reload | HTMX (partial) |

### Technical Stack

#### Backend
- **Go 1.25** with gopacket for packet capture
- **Gorilla WebSocket** for real-time updates
- **Native embed.FS** for asset bundling
- **Protocol16** full deserialization (22+ data types)
- **Bubble Tea** TUI framework for terminal dashboard
- **Air** hot-reload for development

#### Frontend
- **HTMX 2.0.8** for SPA-like navigation
- **Alpine.js** for reactive components
- **Tailwind CSS v4** with custom theme
- **Canvas API** multi-layer rendering
- **BroadcastChannel** for cross-window sync
- **Lucide Icons** for UI elements

---

### Build Commands

```bash
# Development
make dev              # Hot-reload with Air
make run              # Run without hot-reload

# Production
make build-win        # Windows executable
make build-linux      # Linux via Docker
make build-all        # Both platforms

# Complete release
make all-in-one       # Update data + build + package
```

### Project Structure

```
OpenRadar/
├── cmd/radar/        # Go entry point
├── internal/         # Go packages
│   ├── capture/      # Packet capture (gopacket)
│   ├── photon/       # Protocol parsing
│   ├── server/       # HTTP + WebSocket
│   └── logger/       # JSONL logging
├── web/              # Frontend (embedded)
│   ├── images/
│   ├── public/       # HTML, game data
│   ├── scripts/      # JavaScript
│   └── sounds/
├── tools/            # Build scripts
├── embed.go          # Asset embedding
└── Makefile          # Build system
```

---

### Installation

#### Windows

1. Install **Npcap 1.84+** from [npcap.com](https://npcap.com)
2. Run `OpenRadar.exe`
3. Select network adapter
4. Open http://localhost:5001

#### Linux

1. Install libpcap: `sudo apt install libpcap-dev`
2. Grant permissions: `sudo setcap cap_net_raw,cap_net_admin=eip ./OpenRadar-linux`
3. Run `./OpenRadar-linux`
4. Open http://localhost:5001

### Command-line Options

```bash
OpenRadar -version      # Show version
OpenRadar -ip X.X.X.X   # Skip adapter selection
OpenRadar -dev          # Development mode (read files from disk)
```

---

### Migration from v1.x

If upgrading from Node.js version:

1. **Install Go 1.23+** and Npcap/libpcap
2. Run `make install-tools` for Air (hot-reload)
3. Use `make dev` instead of `npm run dev`
4. Use `make build-win` instead of `npm run build:win`
5. **Update WebSocket URL** to `ws://localhost:5001/ws`

### Requirements

| Platform | Requirement |
|----------|-------------|
| Windows | Npcap 1.84+ |
| Linux | libpcap-dev + setcap |
| Development | Go 1.23+, Node.js 20+ (tools only) |

---

### Code Quality Improvements (v2.0.1)

- Fixed race condition in WebSocket broadcast
- Graceful shutdown with context cancellation
- Reduced cognitive complexity (extracted functions)
- Memory optimization in logger (streaming line count)
- Error handling improvements throughout
- ESLint config updated for new structure

---

For detailed documentation, see [docs/README.md](docs/README.md).
