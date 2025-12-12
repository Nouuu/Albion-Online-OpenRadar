# OpenRadar - Albion Online Radar Tool

[![GitHub last commit (branch)](https://img.shields.io/github/last-commit/Nouuu/Albion-Online-OpenRadar/main?style=for-the-badge&label=Last%20Commit)]()
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/Nouuu/Albion-Online-OpenRadar?style=for-the-badge&label=Latest%20Release)]()
[![GitHub pull-requests](https://img.shields.io/github/issues-pr-raw/Nouuu/Albion-Online-OpenRadar?style=for-the-badge&label=PRs)]()
[![GitHub issues](https://img.shields.io/github/issues-raw/Nouuu/Albion-Online-OpenRadar?style=for-the-badge&label=Issues)](https://github.com/Nouuu/Albion-Online-ZQRadar/issues)
[![GitHub Repo stars](https://img.shields.io/github/stars/Nouuu/Albion-Online-OpenRadar?style=for-the-badge)]()

---

## About

**OpenRadar** is a real-time radar tool for **Albion Online** that provides situational awareness without game injection. Track players, resources, enemies, and events with a clean, customizable web interface.

- **No Injection** - Lower risk of detection/banning
- **Real-time Map** - Live tracking with background map overlay
- **Overlay Mode** - Popup window for seamless gameplay (use [DeskPins](https://efotinis.neocities.org/deskpins/) to keep it on top)
- **Single-file Distribution** - All assets embedded in one executable (v2.0+)

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
- **Smart validation** for type, tier, and enchantment combinations

### Enemy & Creature Tracking
- **Color-coded threat classification**:
  - Normal | Enchanted | Mini-Boss | Boss
- 4,528 mobs catalogued with metadata
- Real-time health tracking (spawn, regen, damage)
- Filter by category: Normal, Enchanted, Mini-Boss, Boss
- Mist beasts detection

### Points of Interest
- Treasure chests (common, uncommon, rare, legendary)
- Dungeons (solo/group, static/random, corrupted)
- Mist portals with enchantment levels

### Advanced Features
- Background Maps for visual context
- Smart Filters by tier, enchantment, and category
- Settings Persistence saved locally
- Web Interface at `http://localhost:5001`

---

## Quick Start (Windows)

### 1. Prerequisites

Download and install **Npcap** (version **1.84** or newer):
- [Official Npcap Download Page](https://npcap.com/)
- [Direct Link: Npcap 1.84](https://npcap.com/dist/npcap-1.84.exe)

### 2. Download OpenRadar

Get the latest release from:
- [Releases Page](https://github.com/Nouuu/Albion-Online-OpenRadar/releases)

### 3. Run the Application

1. Extract the ZIP file
2. Run `OpenRadar.exe`
3. Select your network adapter (NOT 127.0.0.1)
4. Open your browser: **http://localhost:5001**

### 4. Check Version

```bash
OpenRadar.exe -version
```

---

## For Developers

### Prerequisites

| Tool       | Version | Notes                          |
|------------|---------|--------------------------------|
| **Go**     | 1.24+   | [Download](https://go.dev/dl/) |
| **Npcap**  | 1.84+   | Windows only                   |
| **Node.js**| 20+     | For data scripts only          |
| **Docker** | Latest  | For Linux builds               |

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

### Build

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
│   ├── capture/      # Packet capture
│   ├── photon/       # Protocol parsing
│   ├── server/       # HTTP & WebSocket
│   └── logger/       # Structured logging
├── web/              # Frontend assets
│   ├── images/
│   ├── public/       # HTML, game data
│   ├── scripts/      # JavaScript
│   └── sounds/
├── tools/            # Build & data scripts
├── docs/             # Documentation
├── embed.go          # Asset embedding
└── Makefile          # Build system
```

### Useful Commands

```bash
make help             # Show all commands
make check            # Verify Go installation
make update-ao-data   # Update Albion game data
make clean            # Clean build artifacts
```

---

## Documentation

Full documentation available in [docs/README.md](docs/README.md).

### Quick Links

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
