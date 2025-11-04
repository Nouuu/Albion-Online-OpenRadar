[![Discord](https://img.shields.io/discord/1191823969167352039?style=for-the-badge&logo=discord&label=Discord)](https://discord.gg/XAWjmzeaD3)
[![GitHub last commit (branch)](https://img.shields.io/github/last-commit/Zeldruck/Albion-Online-ZQRadar/main?style=for-the-badge&label=Last%20Commit)]()
[![GitHub issues](https://img.shields.io/github/issues-raw/Zeldruck/Albion-Online-ZQRadar?style=for-the-badge&label=Issue)](https://github.com/Zeldruck/Albion-Online-ZQRadar/issues)
[![GitHub Repo stars](https://img.shields.io/github/stars/Zeldruck/Albion-Online-ZQRadar?style=for-the-badge)]()

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/F1F1VMA9G)

## ❓ What is ZQRadar?

ZQRadar is a radar type tool for the game Albion Online.
\
Albion ZQRadar provides a real-time map, helping players detect other players, creatures, resources and more, nearby.

## 🎯 Features

- No injections, less risk of banning
- Display a lot of information about other players (health, items, mounted or not, ...)
- Display customizable resources (select tiers and enchantments for each)
- Display customizable living resources (select tiers and enchantments for each)
- Display customizable enemies
- Display mist beasts
- Display chests (types)
- Display mist portals (solo/duo, enchantments)
- Display dungeons (solo/duo, enchantments)
- Display background map on radar
- **🆕 Overlay mode**: Open radar in a separate popup window with custom drag handle and controls

> 💡 **Tip**: Use [DeskPins](https://efotinis.neocities.org/deskpins/) (free) to keep the overlay window always on top

And much more to come!
\
Join the [Discord](https://discord.gg/XAWjmzeaD3) to look at the to-do list and be informed when a new version is released.

## 🔰 How to run (Windows)

1. Download Npcap (version 1.84 or newer):
- [Npcap Download Page](https://npcap.com/)
- Direct link: [Npcap 1.84](https://npcap.com/dist/npcap-1.84.exe) (minimum version)
2. Download the the latest release
- [Releases](https://github.com/Zeldruck/Albion-Online-ZQRadar/releases)
3. Open the radar and wait for the line:
```
Please select one of the adapter that you use to connect to the internet:
  1. ******
  2. ******
  3. ******

input the number here:
```
4. Choose the right adapter and enter the number (do not choose 127.0.0.1). 
5. Authenticate yourself with discord.
6. Click on the "Launch radar" button.
7. You can now access the radar features by going to `http://localhost:5001` in your browser.

## 👨‍💻 For Developers

### Prerequisites
1. **Node.js v18.18.2**: [Download](https://nodejs.org/dist/v18.18.2/node-v18.18.2-x64.msi)
2. **Npcap 1.84 or newer**: [Download Page](https://npcap.com/)
3. **Python 3.10.2**: [Download](https://www.python.org/ftp/python/3.10.2/python-3.10.2-amd64.exe)
4. **Windows Build Tools**: [Download](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) - Select "Desktop development with C++"

### Quick Start
```bash
# Clone the repository
git clone https://github.com/Zeldruck/Albion-Online-ZQRadar.git
cd Albion-Online-ZQRadar

# Install dependencies
npm install

# Run in development mode
npm start
# or with auto-reload
npm run dev
```

### Building Windows Executable

```bash
# With Makefile (WSL/Git Bash)
make build          # Build ZQRadar.exe
make release        # Build + create release ZIP

# Without Make (Windows CMD)
build.bat build
build.bat release

# With npm
npm run build:win
npm run release
```

See [BUILD.md](BUILD.md) for detailed build instructions and all available commands
8. You should see this:
```
Please select one of the adapter that you use to connect to the internet:
  1. ******
  2. ******
  3. ******

input the number here:
```
9. Choose the right adapter and enter the number. 
10. You can now access the radar features by going to `http://localhost:5001` in your browser.

## ✨ Image Packs
**⚠️(This is not mandatory for the radar to work)⚠️**
\
You can download the Image Packs to enhance the radar.
\
\
**Packs:**
- **Ressource Pack v1.0**: Installed by default
- **Items Pack v1.2**: [Link](https://github.com/Zeldruck/Albion-Online-ZQRadar/releases/tag/item-pack-v1.1)
- **~~Animals & Harvestables Pack v0.0~~**: [Link](https://github.com/Zeldruck/Albion-Online-ZQRadar/releases/)
- **~~Enemies Pack v0.0~~**: [Link](https://github.com/Zeldruck/Albion-Online-ZQRadar/releases/)
- **Maps Pack v0.1**: [Link](https://github.com/Zeldruck/Albion-Online-ZQRadar/releases/tag/map-pack-v0.1)

\
Once downloaded, exitract the folder into `Albion-Online-ZQRadar/images/`.
\
\
Example:
\
If you have downloaded the Map Pack, you should have `Albion-Online-ZQRadar/images/Maps/*.png`.


## Credits
[@Zeldruck](https://github.com/Zeldruck)
\
Based on [QRadar](https://github.com/FashionFlora/Albion-Online-Radar-QRadar) by [@FashionFlora](https://github.com/FashionFlora?)
\
Use of [photon-packet-parser](https://github.com/0xN0x/photon-packet-parser) to parse packets.