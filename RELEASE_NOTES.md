# Release Notes

## Version 2.0.0 - Go Backend Migration

**Release Date:** December 2024

### Breaking Changes

- Complete backend rewrite from Node.js to Go
- New build system via Makefile (replaces npm scripts for backend)
- Requires Go 1.24+ for development
- Project structure reorganized:
  - Frontend assets moved to `web/` (images, scripts, public, sounds)
  - Build tools moved to `tools/` (formerly scripts-shell)

### New Features

- **Single-file Distribution**: All assets embedded in the executable - no external files needed
- **Dual Server Architecture**: HTTP server (port 5001) + WebSocket server (port 5002)
- **Development Mode**: Use `-dev` flag for hot-reload with Air tool
- **Cross-platform Builds**: Native Windows build, Linux via Docker
- **Pre-compressed Game Data**: Gzip compression for faster loading
- **Intelligent Caching**: Images cached 24h, game data 7 days
- **Structured Logging**: JSONL format with session management
- **Version Info**: `OpenRadar.exe -version` to check version

### Technical Stack

- **Go 1.24+** with gopacket for packet capture
- **Gorilla WebSocket** for real-time updates
- **Native embed.FS** for asset bundling
- **Protocol16** full deserialization (22+ data types)

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
├── internal/         # Go packages (capture, photon, server, logger)
├── web/              # Frontend assets
│   ├── images/
│   ├── public/       # HTML, game data
│   ├── scripts/      # JavaScript
│   └── sounds/
├── tools/            # Build & data scripts
├── docs/             # Documentation
├── embed.go          # Asset embedding
├── Makefile          # Build system
└── Dockerfile.build  # Linux cross-compilation
```

### Migration from v1.x

If upgrading from Node.js version:

1. Install Go 1.24+ and Npcap (Windows) or libpcap (Linux)
2. Run `make install-tools` to install Air for hot-reload
3. Use `make dev` instead of `npm run dev`
4. Use `make build-win` instead of `npm run build:win`

### Requirements

- **Windows**: Npcap 1.84+ (download from npcap.com)
- **Linux**: libpcap-dev (`apt install libpcap-dev`)
- **Development**: Go 1.24+, Node.js 20+ (for data scripts only)

### Known Issues

- macOS builds not currently supported (requires osxcross setup)

---

For detailed documentation, see the `docs/` folder.
