# OpenRadar - Albion Online Radar Tool

[![GitHub last commit (branch)](https://img.shields.io/github/last-commit/Nouuu/Albion-Online-OpenRadar/main?style=for-the-badge&label=Last%20Commit)]()
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/Nouuu/Albion-Online-OpenRadar?style=for-the-badge&label=Latest%20Release)]()
[![GitHub pull-requests](https://img.shields.io/github/issues-pr-raw/Nouuu/Albion-Online-OpenRadar?style=for-the-badge&label=PRs)]()
[![GitHub issues](https://img.shields.io/github/issues-raw/Nouuu/Albion-Online-OpenRadar?style=for-the-badge&label=Issues)](https://github.com/Nouuu/Albion-Online-ZQRadar/issues)
[![GitHub Repo stars](https://img.shields.io/github/stars/Nouuu/Albion-Online-OpenRadar?style=for-the-badge)]()

<p align="center">
  <img src="docs/images/radar_1.png" alt="OpenRadar Main View" width="700">
</p>

---

## About

**OpenRadar** is a real-time radar tool for **Albion Online** that provides situational awareness without game injection. Track players, resources, enemies, and events with a clean, customizable web interface.

### v2.0 Highlights

#### Backend
- **Native Go Backend** - Single binary (~95 MB) with all assets embedded
- **No External Dependencies** - Just Npcap (Windows) or libpcap (Linux)
- **Massive Size Reduction** - From ~500 MB (Node.js) to ~95 MB
- **Faster Startup** - No runtime extraction needed
- **No Injection** - Lower risk of detection/banning

#### UI
- **Modern Dark Theme** - Tailwind CSS v4 with custom color palette
- **HTMX Navigation** - Seamless page transitions without reload
- **Dynamic Radar** - Adjustable size (300-800px) and zoom (0.5x-2.0x)
- **Player Color Coding** - Green (passive), Orange (faction), Red (hostile)
- **TUI Dashboard** - Real-time stats in terminal

---

## Screenshots

<table>
  <tr>
    <td><img src="docs/images/radar_2.png" alt="Radar with entities" width="400"></td>
    <td><img src="docs/images/radar_3.png" alt="Radar zoomed" width="400"></td>
  </tr>
  <tr>
    <td align="center"><em>Radar with detected entities</em></td>
    <td align="center"><em>Radar with zoom controls</em></td>
  </tr>
  <tr>
    <td><img src="docs/images/settings.png" alt="Settings page" width="400"></td>
    <td><img src="docs/images/resources.png" alt="Resources page" width="400"></td>
  </tr>
  <tr>
    <td align="center"><em>Settings page</em></td>
    <td align="center"><em>Resources filtering</em></td>
  </tr>
  <tr>
    <td><img src="docs/images/overlay.png" alt="Overlay window" width="400"></td>
    <td><img src="docs/images/OpenRadar.gif" alt="TUI Dashboard" width="400"></td>
  </tr>
  <tr>
    <td align="center"><em>Floating overlay window</em></td>
    <td align="center"><em>Terminal dashboard (TUI)</em></td>
  </tr>
</table>

---

## Features

### Player Tracking
- Real-time position and movement
- Health bars and equipment visualization
- Mount status detection
- Guild and alliance information

### Resource Detection
- **100% detection accuracy** - Validated with 3,698+ resources
- **Harvestables**: Trees, ores, stone, fiber, hide (T1-T8 + enchantments .0-.3)
- **Living Resources**: Animals and skinnable creatures (~2,800 types)
- **Fishing spots**: All tiers with enchantment support

### Enemy & Creature Tracking
- **Color-coded threat classification**: Normal | Enchanted | Mini-Boss | Boss
- 4,528 mobs catalogued with metadata
- Real-time health tracking
- Mist beasts detection

### Points of Interest
- Treasure chests (common, uncommon, rare, legendary)
- Dungeons (solo/group, static/random, corrupted)
- Mist portals with enchantment levels

---

## Quick Start

### Windows

1. **Install Npcap** (version 1.84+):
   - [Official Download](https://npcap.com/) | [Direct Link v1.84](https://npcap.com/dist/npcap-1.84.exe)

2. **Download & Run**:
   - Get the latest release from [Releases](https://github.com/Nouuu/Albion-Online-OpenRadar/releases)
   - Extract and run `OpenRadar.exe`
   - Select your network adapter (NOT 127.0.0.1)
   - Open **http://localhost:5001** in your browser

### Linux

1. **Install dependencies**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install libpcap0.8 libcap2-bin

   # Fedora/RHEL
   sudo dnf install libpcap libcap

   # Arch Linux
   sudo pacman -S libpcap libcap
   ```

2. **Download & Make executable**:
   ```bash
   chmod +x OpenRadar-linux
   ```

3. **Grant capture permissions** (choose ONE option):

   **Option A** - Run as root (simple):
   ```bash
   sudo ./OpenRadar-linux
   ```

   **Option B** - Grant capabilities (recommended, allows running as normal user):
   ```bash
   # Grant network capture capabilities to the executable
   sudo setcap cap_net_raw,cap_net_admin=eip ./OpenRadar-linux

   # Verify capabilities were applied (optional)
   getcap ./OpenRadar-linux

   # Run as normal user
   ./OpenRadar-linux
   ```
   > **Note**: Capabilities are removed if the file is modified or moved. Re-run `setcap` after updates.

4. Open **http://localhost:5001** in your browser

### Command-line Options

```bash
OpenRadar -version       # Show version
OpenRadar -ip X.X.X.X    # Skip adapter selection
OpenRadar -dev           # Development mode (read files from disk)
```

---

## For Developers

### Prerequisites

| Tool       | Version | Notes                          |
|------------|---------|--------------------------------|
| **Go**     | 1.23+   | [Download](https://go.dev/dl/) |
| **Npcap**  | 1.84+   | Windows only                   |
| **libpcap**| Latest  | Linux only                     |
| **Node.js**| 20+     | For data/build scripts only    |
| **Docker** | Latest  | For Linux cross-compilation    |

### Quick Setup

```bash
git clone https://github.com/Nouuu/Albion-Online-OpenRadar.git
cd Albion-Online-OpenRadar

# Install Air for hot-reload (one time)
make install-tools

# Start development server
make dev
```

Web interface available at **http://localhost:5001**.

### Build Commands

```bash
make build-win        # Build Windows executable
make build-linux      # Build Linux via Docker
make build-all        # Build all platforms
make all-in-one       # Complete release workflow
```

### Project Structure

```
OpenRadar/
├── cmd/radar/        # Go entry point
├── internal/         # Go packages
│   ├── capture/      # Packet capture (pcap)
│   ├── photon/       # Protocol parsing
│   ├── server/       # HTTP & WebSocket servers
│   └── logger/       # Structured logging
├── web/              # Frontend assets (embedded)
│   ├── images/
│   ├── public/       # HTML, game data
│   ├── scripts/      # JavaScript
│   └── sounds/
├── tools/            # Build & data scripts (Node.js)
├── docs/             # Documentation
├── embed.go          # Asset embedding
├── go.mod            # Go modules
└── Makefile          # Build system
```

### Useful Commands

```bash
make help             # Show all commands
make check            # Verify dependencies
make update-ao-data   # Update Albion game data
make clean            # Clean build artifacts
make lint             # Lint Go code
```

---

## Technical Details

### Architecture

- **Backend**: Native Go with embedded assets
- **Frontend**: HTMX + Alpine.js + Tailwind CSS v4
- **Templates**: Go html/template with SSR
- **Protocol**: Photon Protocol16 deserialization
- **Capture**: gopacket/pcap for packet capture

### Ports

| Port | Service   |
|------|-----------|
| 5001 | HTTP + WebSocket (`/ws`) |
| 5056 | UDP (Albion traffic - captured) |

### Performance Comparison

| Metric | v1.x (Node.js) | v2.0 (Go) |
|--------|----------------|-----------|
| Binary size | ~100 MB | ~95 MB |
| Assets | ~400 MB (separate) | Embedded |
| Total | ~500 MB | ~95 MB |
| Startup | Slower (extraction) | Instant |

---

## Documentation

Full documentation available in [docs/README.md](docs/README.md).

| Guide | Description |
|-------|-------------|
| [RELEASE_NOTES.md](RELEASE_NOTES.md) | Version 2.0 changes |
| [DEV_GUIDE.md](docs/dev/DEV_GUIDE.md) | Development guide |
| [LOGGING.md](docs/technical/LOGGING.md) | Logging system |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Standards**: ES modules (ESM), 2-space indentation, JSDoc comments, English only.

---

## License & Credits

**Current Maintainer**: [@Nouuu](https://github.com/Nouuu) (nospy)

**Original Project**: [ZQRadar](https://github.com/Zeldruck/Albion-Online-ZQRadar) by [@Zeldruck](https://github.com/Zeldruck)

**Based on**: [QRadar](https://github.com/FashionFlora/Albion-Online-Radar-QRadar) by [@FashionFlora](https://github.com/FashionFlora)

---

**Disclaimer**: This tool is for educational purposes. Use at your own risk.