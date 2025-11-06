# 🎯 ZQRadar - Albion Online Radar Tool

[![Discord](https://img.shields.io/discord/1191823969167352039?style=for-the-badge&logo=discord&label=Discord)](https://discord.gg/XAWjmzeaD3)
[![GitHub last commit (branch)](https://img.shields.io/github/last-commit/Nouuu/Albion-Online-ZQRadar/main?style=for-the-badge&label=Last%20Commit)]()
[![GitHub issues](https://img.shields.io/github/issues-raw/Nouuu/Albion-Online-ZQRadar?style=for-the-badge&label=Issues)](https://github.com/Nouuu/Albion-Online-ZQRadar/issues)
[![GitHub Repo stars](https://img.shields.io/github/stars/Nouuu/Albion-Online-ZQRadar?style=for-the-badge)]()

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/F1F1VMA9G)

---

## 📖 About

**ZQRadar** is a powerful real-time radar tool for **Albion Online** that provides comprehensive situational awareness without game injection. Built with modern web technologies, it offers a clean, customizable interface for tracking players, resources, enemies, and events.

### Key Highlights

- ✅ **No Injection** - Lower risk of detection/banning
- 🗺️ **Real-time Map** - Live tracking with background map overlay
- 🎨 **Fully Customizable** - Filter by tier, enchantment, and type
- 📊 **Advanced Logging v2.1** - Centralized debug system with granular control
- 🪟 **Overlay Mode** - Popup window with drag handle for seamless gameplay

> 💡 **Pro Tip**: Use [DeskPins](https://efotinis.neocities.org/deskpins/) (free) to keep the overlay window always on top

---

## 🎯 Features

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
- 📍 **Background Maps**: Visual context for radar positioning
- 🔍 **Smart Filters**: Tier, enchantment, and category-based
- 📊 **Logging System v2.1**: Centralized debug with 6 customizable categories
- 🎛️ **Settings Persistence**: All preferences saved locally
- 🌐 **Web Interface**: Access from any browser at `http://localhost:5001`
- 🪟 **Overlay Mode**: Draggable popup window for multi-monitor setups

---

## 🚀 Quick Start (Windows)

### 1. Prerequisites

Download and install **Npcap** (version **1.84** or newer):
- [Official Npcap Download Page](https://npcap.com/)
- [Direct Link: Npcap 1.84](https://npcap.com/dist/npcap-1.84.exe)

### 2. Download ZQRadar

Get the latest release from:
- [📦 Releases Page](https://github.com/Nouuu/Albion-Online-ZQRadar/releases)

### 3. Run the Application

1. Extract the ZIP file
2. Run `ZQRadar.exe`
3. Select your network adapter:
```
Please select one of the adapter that you use to connect to the internet:
  1. Ethernet adapter
  2. Wi-Fi adapter
  3. VPN adapter

input the number here:
```
4. Choose the correct adapter (⚠️ **NOT** 127.0.0.1)
5. Authenticate with Discord (one-time setup)
6. Click **"Launch Radar"**
7. Open your browser and go to: **http://localhost:5001**

### 4. Configure Settings

Navigate to **Settings** page to:
- Enable debug logging categories (Enemies, Players, Harvestables, etc.)
- Customize visual overlays
- Configure tier and enchantment filters
- Export debug logs for troubleshooting

---

## 👨‍💻 For Developers

### Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | v18.18.2 | [Download](https://nodejs.org/dist/v18.18.2/node-v18.18.2-x64.msi) |
| **Python** | 3.10.2 | [Download](https://www.python.org/ftp/python/3.10.2/python-3.10.2-amd64.exe) |
| **Npcap** | 1.84+ | [Download](https://npcap.com/) |
| **VS Build Tools** | 2022 | [Download](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) |

> ℹ️ For **VS Build Tools**, select **"Desktop development with C++"** during installation

### Setup & Development

```bash
# Clone the repository
git clone https://github.com/Nouuu/Albion-Online-ZQRadar.git
cd Albion-Online-ZQRadar

# Install dependencies
npm install

# Run in development mode (auto-reload)
npm run dev

# Or standard mode
npm start
```

The web interface will be available at **http://localhost:5001**

### Building for Production

```bash
# Build Windows executable
npm run build:win

# Build all platforms
npm run build:all

# Create release package (build + ZIP)
npm run release
```

**Alternative build methods:**
```bash
# Windows (CMD/PowerShell)
build.bat build      # Build executable
build.bat release    # Build + package

# Unix/Linux/macOS
make build           # Build executable
make release         # Build + package
```

📖 See [BUILD.md](BUILD.md) for detailed build instructions.

---

## 🎨 Image Packs (Optional)

Enhance the radar with visual assets:

| Pack | Status | Link |
|------|--------|------|
| **Resource Pack** | ✅ Installed by default | - |
| **Items Pack** | v1.2 | [Download](https://github.com/Zeldruck/Albion-Online-ZQRadar/releases/tag/item-pack-v1.1) |
| **Maps Pack** | v0.1 | [Download](https://github.com/Zeldruck/Albion-Online-ZQRadar/releases/tag/map-pack-v0.1) |
| **Animals & Harvestables Pack** | 🚧 Coming Soon | - |
| **Enemies Pack** | 🚧 Coming Soon | - |

### Installation

1. Download the desired pack(s)
2. Extract the folder into `Albion-Online-ZQRadar/images/`
3. Restart the radar

**Example:** For Maps Pack, you should have `Albion-Online-ZQRadar/images/Maps/*.png`

---

## 🏗️ Architecture

### Technologies

- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: EJS templates, Alpine.js v2 (CDN), Tailwind CSS
- **Packet Capture**: Npcap + photon-packet-parser
- **Build**: pkg (executable packaging)

### Key Components

```
Albion-Online-ZQRadar/
├── scripts/              # Client-side JavaScript
│   ├── Handlers/         # Event handlers (Mobs, Players, Harvestables)
│   ├── Drawings/         # Canvas rendering logic
│   └── Utils/            # Utilities & Settings
├── views/                # EJS templates
│   ├── main/             # Main pages (Drawing, Settings, Stats)
│   └── layout.ejs        # Shared layout
├── docs/                 # Documentation
│   ├── technical/        # LOGGING.md, SETTINGS.md
│   └── project/          # DEBUG_LOGGING_GUIDE.md
├── server-scripts/       # Server-side Node.js
└── images/               # Visual assets
```

### Logging System v2.1

ZQRadar features a centralized logging system with:
- ✅ **6 Debug Categories**: Enemies, Players, Chests, Dungeons, Fishing, Harvestables
- ✅ **Dynamic Updates**: Changes apply instantly without reload
- ✅ **Strict Filtering Rules**: DEBUG filtered, INFO/WARN/ERROR always logged
- ✅ **Console & Server Logging**: Dual output with independent controls
- ✅ **RAW Packet Debug**: Optional verbose packet inspection

📖 See [docs/technical/LOGGING.md](docs/technical/LOGGING.md) for complete logging documentation.

---

## 📚 Documentation

### User Guides
- **[SETUP.md](SETUP.md)** - Complete setup guide
- **[BUILD.md](BUILD.md)** - Build and packaging instructions

### Developer Documentation
- **[docs/technical/LOGGING.md](docs/technical/LOGGING.md)** - Logging System v2.1 (technical reference)
- **[work/DEBUG_LOGGING_GUIDE.md](work/DEBUG_LOGGING_GUIDE.md)** - Debug & Logging Guide (developer guide)
- **[docs/dev/ARCHITECTURE.md](docs/dev/ARCHITECTURE.md)** - System architecture
- **[docs/README.md](docs/README.md)** - Documentation index

### AI Agent Guides
- **[docs/ai/AI_AGENT_GUIDE.md](docs/ai/AI_AGENT_GUIDE.md)** - For AI-assisted development

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Coding Standards

- Use **CommonJS** module system (not ESM)
- Follow **existing code style** (2-space indentation)
- Add **JSDoc comments** for new functions
- Update **documentation** for significant changes
- Test with **Node.js v18.18.2**

---

## 📜 License

This project is distributed under the terms specified by the original authors.

## 🙏 Credits

**Fork Maintainer**: [@Nouuu](https://github.com/Nouuu) (nospy)

**Original ZQRadar**: [ZQRadar](https://github.com/Zeldruck/Albion-Online-ZQRadar) by [@Zeldruck](https://github.com/Zeldruck)

**Based on**: [QRadar](https://github.com/FashionFlora/Albion-Online-Radar-QRadar) by [@FashionFlora](https://github.com/FashionFlora)

**Uses**: [photon-packet-parser](https://github.com/0xN0x/photon-packet-parser) for packet parsing

---

## 🔗 Links

- 💬 [Discord Community](https://discord.gg/XAWjmzeaD3)
- 🐛 [Report Issues](https://github.com/Nouuu/Albion-Online-ZQRadar/issues)
- 📦 [Latest Releases](https://github.com/Nouuu/Albion-Online-ZQRadar/releases)
- ☕ [Support on Ko-fi](https://ko-fi.com/F1F1VMA9G)

---

**⚠️ Disclaimer**: This tool is for educational purposes. Use at your own risk. The authors are not responsible for any consequences resulting from its use.