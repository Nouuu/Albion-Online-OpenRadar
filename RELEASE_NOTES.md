# Release Notes

## Version 2.0.0 - Native Go Backend

**Release Date:** December 2024

### Highlights

- **5x Smaller**: ~95 MB single binary vs ~500 MB (Node.js + assets)
- **Zero Dependencies**: Just Npcap (Windows) or libpcap (Linux)
- **Instant Startup**: No extraction or runtime needed
- **Single Port**: HTTP + WebSocket on port 5001

---

### Breaking Changes

- Complete backend rewrite from Node.js to Go
- WebSocket endpoint changed: `ws://localhost:5001/ws` (was port 5002)
- Project structure reorganized:
  - Frontend assets in `web/` (images, scripts, public, sounds)
  - Build tools in `tools/`
- Requires Go 1.23+ for development

### New Features

- **Single Binary Distribution**: All assets embedded - no external files
- **Unified Server**: HTTP and WebSocket on single port (5001)
- **Graceful Shutdown**: Clean resource cleanup on Ctrl+C
- **Development Mode**: `-dev` flag for hot-reload with Air
- **Cross-platform Builds**: Native Windows, Linux via Docker
- **Pre-compressed Game Data**: Gzip for faster loading
- **Intelligent Caching**: Images 24h, game data 7 days
- **Connection Limits**: Max 100 WebSocket clients
- **Structured Logging**: JSONL with streaming line count

### Performance Improvements

| Metric | v1.x (Node.js) | v2.0 (Go) |
|--------|----------------|-----------|
| Binary | ~100 MB | ~95 MB |
| Assets | ~400 MB (separate) | Embedded |
| **Total** | **~500 MB** | **~95 MB** |
| Ports | 5001 + 5002 | 5001 only |
| Startup | Slow (extraction) | Instant |

### Technical Stack

- **Go 1.23+** with gopacket for packet capture
- **Gorilla WebSocket** for real-time updates
- **Native embed.FS** for asset bundling
- **Protocol16** full deserialization (22+ data types)

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
