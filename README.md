# OpenRadar - Albion Online Radar Tool

[![GitHub last commit (branch)](https://img.shields.io/github/last-commit/Nouuu/Albion-Online-OpenRadar/main?style=for-the-badge&label=Last%20Commit)]()
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/Nouuu/Albion-Online-OpenRadar?style=for-the-badge&label=Latest%20Release)]()
[![GitHub pull-requests](https://img.shields.io/github/issues-pr-raw/Nouuu/Albion-Online-OpenRadar?style=for-the-badge&label=PRs)]()
[![GitHub issues](https://img.shields.io/github/issues-raw/Nouuu/Albion-Online-OpenRadar?style=for-the-badge&label=Issues)](https://github.com/Nouuu/Albion-Online-ZQRadar/issues)
[![GitHub Repo stars](https://img.shields.io/github/stars/Nouuu/Albion-Online-OpenRadar?style=for-the-badge)]()

---

## About

**OpenRadar** is a real-time radar tool for **Albion Online** that provides situational awareness without game injection. Track players, resources, enemies, and events with a clean, customizable web interface.

- **No Injection** – Lower risk of detection/banning
- **Real-time Map** – Live tracking with background map overlay
- **Overlay Mode** – Popup window for seamless gameplay (use [DeskPins](https://efotinis.neocities.org/deskpins/) to keep it on top)

---

## Features

### Player Tracking
- Real-time position and movement
- Health bars and equipment visualization
- Mount status detection
- Guild and alliance information

### Resource Detection
- **Harvestables**: Trees, ores, stone, fiber, hide (T1-T8 + enchantments)
- **Living Resources**: Animals and skinnable creatures
- **Fishing spots**: All tiers with enchantment support
- Customizable filters per resource type

### Enemy & Creature Tracking
- Mobs and enemies with health bars
- Mist beasts detection
- Type identification (aggressive, passive, boss)

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
3. Select your network adapter:

```
Please select one of the adapter that you use to connect to the internet:
  1. Ethernet adapter
  2. Wi-Fi adapter
  3. VPN adapter

input the number here:
```

4. Choose the correct adapter (NOT 127.0.0.1)
5. Authenticate with Discord (one-time setup)
6. Click **"Launch Radar"**
7. Open your browser: **http://localhost:5001**

### 4. Configure Settings

Navigate to the **Settings** page to:
- Enable debug logging categories
- Customize visual overlays
- Configure tier and enchantment filters

---

## For Developers

### Prerequisites

| Tool               | Version  | Download                                                                                     |
|--------------------|----------|----------------------------------------------------------------------------------------------|
| **Node.js**        | v24.11.1 | [Download](https://nodejs.org/dist/v24.11.1/node-v24.11.1-x64.msi)                           |
| **Npcap**          | 1.84+    | [Download](https://npcap.com/)                                                               |
| **VS Build Tools** | 2022     | [Download](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) |

### Quick Setup

```bash
git clone https://github.com/Nouuu/Albion-Online-ZQRadar.git
cd Albion-Online-ZQRadar
npm install
npm run dev
```

Web interface available at **http://localhost:5001**.

### Build

```bash
npm run build:win    # Build Windows executable
npm run release      # Build + package
```

**Troubleshooting:**
- `Cannot find module 'cap'` → Run `npm rebuild cap`
- The .exe doesn't start → Install Npcap 1.84+, run as administrator

---

## Documentation

Full documentation available in [docs/README.md](docs/README.md).

### Quick Links

| Guide | Description |
|-------|-------------|
| [DEV_GUIDE.md](docs/dev/DEV_GUIDE.md) | Development guide |
| [LOGGING.md](docs/technical/LOGGING.md) | Logging system v2.2 |

### Active Plans

| Plan | Status |
|------|--------|
| [Go Migration](docs/project/GO_MIGRATION_PLAN.md) | Backend rewrite in Go |
| [Radar Unification](docs/project/RADAR_UNIFICATION_PLAN.md) | ~80% complete |
| [Settings Migration](docs/project/SETTINGS_MIGRATION_PLAN.md) | ~50% complete |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Standards**: CommonJS modules, 2-space indentation, JSDoc comments, English only.

---

## License & Credits

**Current Maintainer**: [@Nouuu](https://github.com/Nouuu) (nospy)

**Original Project**: [ZQRadar](https://github.com/Zeldruck/Albion-Online-ZQRadar) by [@Zeldruck](https://github.com/Zeldruck)

**Based on**: [QRadar](https://github.com/FashionFlora/Albion-Online-Radar-QRadar) by [@FashionFlora](https://github.com/FashionFlora)

**Uses**: [photon-packet-parser](https://github.com/0xN0x/photon-packet-parser)

---

**Disclaimer**: This tool is for educational purposes. Use at your own risk.