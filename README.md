<h1 align="center">
  <img src="web/images/icon.png" width="32" height="32" alt="icon">
  OpenRadar
</h1>

<p align="center">
  <strong>Real-time radar for Albion Online</strong><br>
  <sub>Passive network capture • Zero injection • Open source</sub>
</p>

<p align="center">
  <a href="https://github.com/Nouuu/Albion-Online-OpenRadar/releases">
    <img src="https://img.shields.io/github/v/release/Nouuu/Albion-Online-OpenRadar?style=flat-square&label=Download&color=7c3aed" alt="Download">
  </a>
  <img src="https://img.shields.io/badge/Windows%20%7C%20Linux-blue?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Go-1.26+-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go">
  <a href="https://github.com/Nouuu/Albion-Online-OpenRadar/stargazers">
    <img src="https://img.shields.io/github/stars/Nouuu/Albion-Online-OpenRadar?style=flat-square&color=yellow" alt="Stars">
  </a>
</p>

https://github.com/user-attachments/assets/33fe1ac7-11f2-4c3c-a91c-0ab42ebdda7d

---

Tired of farming blind in the Black Zone? OpenRadar shows you resources, mobs, and players around you, right in your
browser.

**How does it work?** The app listens to network traffic between your PC and Albion's servers, decodes the Photon
protocol, and displays everything on a web-based radar. No client modification, no memory injection. Just passive
reading.

---

## Quick Start

### Windows

1. Install **[Npcap](https://npcap.com/#download)** (required for packet capture)
2. Download `OpenRadar-windows-amd64.exe` from [Releases](https://github.com/Nouuu/Albion-Online-OpenRadar/releases)
3. Run it, pick your network adapter
4. Open **http://localhost:5001** in your browser
5. Launch Albion and start playing

### Linux

```bash
# Install libpcap
sudo apt install libpcap0.8  # Debian/Ubuntu

# Download and set permissions
chmod +x OpenRadar-linux-amd64
sudo setcap cap_net_raw=eip ./OpenRadar-linux-amd64

# Run
./OpenRadar-linux-amd64
```

### CLI Options

```bash
OpenRadar -version       # Show version
OpenRadar -ip X.X.X.X    # Skip adapter selection
OpenRadar -dev           # Development mode (read files from disk)
```

### Using ExitLag?

ExitLag's default packet redirection method (WFP) intercepts Albion's traffic
above the NDIS layer, so Npcap (and Wireshark, and OpenRadar) sees nothing.

In ExitLag, open **Settings &rarr; Advanced &rarr; Packet redirection method**
and select **NDIS (Legacy)**. The radar will then capture normally on your
physical adapter.

![ExitLag settings screenshot](docs/images/exitlag.png)

---

## What It Detects

### Production-Ready

| What          | Coverage                                                                                          |
|---------------|---------------------------------------------------------------------------------------------------|
| **Resources** | 3,698 nodes validated. T1-T8, enchanted (.1 .2 .3), static and skinnable                          |
| **Mobs**      | 4,528 catalogued. Color-coded: green (normal), purple (enchanted), orange (mini-boss), red (boss) |
| **Players**   | Faction flags, hostile detection, zone-aware alerts                                               |
| **Zones**     | 1,000+ zones mapped. Safe/Yellow/Red/Black detection drives threat logic                          |

### Player Threat Detection

| Status  | Color     | Description             |
|---------|-----------|-------------------------|
| Passive | `#00ff88` | Not flagged for PvP     |
| Faction | `#ffa500` | Faction warfare flagged |
| Hostile | `#ff0000` | Hostile (flagged 255)   |

> **Alert System**: Screen flash + sound on hostile detection

### Mists

- **Portals** (Solo, Duo) detected with rarity (Common, Uncommon, Rare, Epic, Legendary)
- **Feu follets** (wisp signs) shown before portals appear
- **Wisp cages** detected inside Mists zones

### Basic (Legacy)

Dungeons and chests are on the radar but not fully refactored. Coming in v2.3:

- **Dungeons**: per-type filter (Solo, Group, Corrupted, Hellgate, Avalonian)
- **Chests**: rarity classification once the parameter source is identified
- **Fishing**: end-of-fishing state and fishing zones

---

## Radar Controls

| Feature | Description                              |
|---------|------------------------------------------|
| Size    | 300px - 800px adjustable                 |
| Zoom    | 0.5x - 2.0x magnification                |
| Rings   | Distance indicators at 10m/20m intervals |
| Zone    | Current zone name + PvP type indicator   |
| Stats   | Player/resource/mob counts               |
| Threat  | Red pulse border on hostile detection    |
| PiP     | Picture-in-Picture floating window       |

---

## Features

### Picture-in-Picture

Playing fullscreen? Pop the radar into a floating window that stays on top. Native browser PiP, one click.

### Zone-Aware Alerts

The radar knows where you are. Safe zone? Quiet. Black Zone? Every player is a threat. Visual flash + audio alert when
hostiles appear.

### Self-Contained

Fonts, icons, everything bundled. Once Albion connects, the radar works without internet.

### Roadmap

Check [TODO.md](docs/project/TODO.md) for what's coming:

- v2.3: Dungeons database, Chests rarity, Fishing completion, Mists cluster routing
- Future: squad mode, session heatmaps

---

## Screenshots

<table>
  <tr>
    <td><img src="docs/images/radar_1.png" alt="Radar" width="400"></td>
    <td><img src="docs/images/radar_2.png" alt="Radar with entities" width="400"></td>
  </tr>
  <tr>
    <td align="center"><em>Main radar view</em></td>
    <td align="center"><em>Detecting resources and mobs</em></td>
  </tr>
  <tr>
    <td><img src="docs/images/radar_3.png" alt="Radar zoomed" width="400"></td>
    <td><img src="docs/images/pip.jpg" alt="Picture-in-Picture" width="400"></td>
  </tr>
  <tr>
    <td align="center"><em>Zoom controls</em></td>
    <td align="center"><em>PiP floating window</em></td>
  </tr>
  <tr>
    <td><img src="docs/images/settings.png" alt="Settings" width="400"></td>
    <td><img src="docs/images/resources.png" alt="Resources" width="400"></td>
  </tr>
  <tr>
    <td align="center"><em>Settings page</em></td>
    <td align="center"><em>Resource filtering</em></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><img src="docs/images/OpenRadar.gif" alt="TUI Dashboard" width="500"></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><em>Terminal dashboard (TUI)</em></td>
  </tr>
</table>

---

## What's New in v2.2

The stabilization release. Game updates that broke prior builds are caught up, the capture path survives ExitLag and VPN toggles, and the logging system finally makes sense.

### Game updates caught up

- **Protocol18 port**: deserializer rewritten with pcap-fixture-backed tests for every event the radar consumes.
- **Mists detection**: portals, feu follets, and wisp cages back on the radar. Rarity reads from `Parameters[8]`, the same slot non-Mists dungeons use (which fixes Morgana, Keeper, Undead, Royal Solo while we are at it).
- **Living harvest tier**: tier on the radar matches the in-game tooltip after a TypeID OFFSET=16 confirmation against 6469 pcap events.

### Network

- **Multi-interface capture**: listen on WiFi and Ethernet at the same time so an ExitLag or VPN toggle never silences the radar.
- **ExitLag support**: NDIS LWF positioning understood; cases A, B, C covered.
- **`network.json` config**: stable interface identifiers replace IP-keyed `ip.txt`. Migration runs once.

### LAN access

- **Dynamic WebSocket URL**: open `http://<host-ip>:5001` from a phone, the radar just works.
- **Startup banner**: prints localhost and LAN URLs side by side.
- **Mobile responsive baseline**: every page usable at 375x667 portrait without horizontal scroll.

### Logging and pcap

- **Coherent log directories**: `logs/sessions/` for backend, `logs/debug/` for frontend, `logs/errors/` always-on, `logs/captures/` for pcap recording.
- **In-process pcap recording**: gated by a UI toggle. No more `tcpdump` to debug a parser issue.
- **Unified `/api/settings/logging` endpoint**: replaces the old single-toggle endpoint.

### UI polish

- **Resource icon size slider**: dense screens stay readable.
- **Per-rarity color badges**: replaces the single-dot indicator.
- **Collapsible network panel**: in the radar overlay.
- **Mist instance pvpType**: inherits from the parent cluster, no more wrong "safe" tagging in Mists.

### Stability

- **Real-DB tests**: 351 frontend tests across 14 suites, loading `web/ao-bin-dumps/*.min.json` instead of mocks.
- **Embed safety**: production binary cannot ship test files or fixtures.
- **Shutdown reliability**: pcap close ordering reworked, no more goroutine polling a freed handle.

For the full changelog see [RELEASE_2.2.0.md](docs/releases/RELEASE_2.2.0.md).

---

## For Developers

### Requirements

| Tool    | Version | Notes                  |
|---------|---------|------------------------|
| Go      | 1.26+   | Backend                |
| Npcap   | 1.84+   | Windows packet capture |
| libpcap | Latest  | Linux packet capture   |
| Node.js | 20+     | Build scripts only     |
| Docker  | Latest  | Linux cross-compile    |

### Quick Start

```bash
git clone https://github.com/Nouuu/Albion-Online-OpenRadar.git
cd Albion-Online-OpenRadar

make run   # Run directly
# or
make dev   # Run with hot-reload (requires: make install-tools)
```

### Build

```bash
make build-win        # Windows binary
make build-linux      # Linux binary (via Docker)
make release-snapshot # Full release build (both platforms)
```

### Project Structure

```
├── cmd/radar/        # Entry point + TUI
├── internal/         # Go packages
│   ├── capture/      # Packet capture (pcap)
│   ├── photon/       # Protocol parsing
│   ├── server/       # HTTP + WebSocket
│   └── templates/    # Go templates (.gohtml)
├── web/              # Frontend (embedded in binary)
│   ├── scripts/      # JavaScript modules
│   ├── images/       # Maps, items, spells icons
│   └── ao-bin-dumps/ # Game data (minified)
├── tools/            # Build & data scripts (Node.js)
└── docs/             # Documentation
```

---

## Documentation

| Guide | Description |
|---|---|
| [DEV_GUIDE.md](docs/dev/DEV_GUIDE.md) | Development setup, build system, testing |
| [RELEASE_2.2.0.md](docs/releases/RELEASE_2.2.0.md) | What changed in v2.2 |
| [RELEASE_2.1.0.md](docs/releases/RELEASE_2.1.0.md) | Memory and performance, Picture-in-Picture |
| [RELEASE_2.0.0.md](docs/releases/RELEASE_2.0.0.md) | Go backend, UI overhaul |
| [TODO.md](docs/project/TODO.md) | Roadmap and open observations |
| [docs/](docs/) | Full documentation index |

---

## Known Limitations

- **Player positions**: Albion encrypts movement data. Players are detected but can't be shown on radar.
- **Some Black Zone maps**: Tiles for zone IDs 4000+ missing. Disable map background in settings as workaround.
- **Resource charges**: May differ from actual due to server-side harvest bonuses.

---

## Contributing

Found a bug? Want to help? [Open an issue](https://github.com/Nouuu/Albion-Online-OpenRadar/issues) or submit a PR.

---

## Credits

Built by [@Nouuu](https://github.com/Nouuu)

Based on [ZQRadar](https://github.com/Zeldruck/Albion-Online-ZQRadar) by [@Zeldruck](https://github.com/Zeldruck)

---

<p align="center">
  <sub>⚠️ For educational purposes. Use at your own risk.</sub>
</p>
