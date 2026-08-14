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

Tired of farming blind in the Black Zone? OpenRadar shows the resources, mobs and players around you, in your browser.

It reads the network traffic between your PC and Albion's servers, decodes the Photon protocol, and draws what it finds.
No client modification, no memory injection, no proxy. Passive listening only.

---

## Quick Start

### Windows

1. Install [Npcap](https://npcap.com/#download).
2. Download `OpenRadar-windows-amd64.exe` from
   [Releases](https://github.com/Nouuu/Albion-Online-OpenRadar/releases/latest).
3. Run it. The startup banner prints a localhost URL and, when available, a `http://<your-lan-ip>:5001 (LAN)` one.
4. Open **http://localhost:5001**, or the LAN URL from a phone on the same network.
5. Launch Albion.

Interfaces are auto-selected. Change them from **Settings -> Network** in the browser.

### Linux

```bash
# 1. libpcap
sudo apt install libpcap0.8   # Debian, Ubuntu
sudo pacman -S libpcap        # Arch

# 2. Download
mkdir ~/albion-radar && cd ~/albion-radar
curl -L -o OpenRadar-linux-amd64 \
  https://github.com/Nouuu/Albion-Online-OpenRadar/releases/latest/download/OpenRadar-linux-amd64
chmod +x OpenRadar-linux-amd64

# 3. Capture without root
sudo setcap cap_net_raw=eip ./OpenRadar-linux-amd64

# 4. Run
./OpenRadar-linux-amd64
```

<details>
<summary><code>libpcap.so.0.8: cannot open shared object file</code></summary>

Your distribution ships a different soname. Link it:

```bash
sudo ln -s /usr/lib/libpcap.so.1 /usr/lib/libpcap.so.0.8
# or, if that file does not exist
sudo ln -s /usr/lib/libpcap.so /usr/lib/libpcap.so.0.8
```

</details>

### CLI options

```bash
OpenRadar -version       # print version and exit
OpenRadar -ip X.X.X.X    # one-shot interface override by IP (does not write network.json)
OpenRadar -dev           # development mode (read assets from disk)
```

Interface selection persists in `network.json` next to the binary. Edit it from **Settings -> Network**, or by hand for
headless setups.

### Using ExitLag?

ExitLag's default redirection method (WFP) intercepts Albion's traffic above the NDIS layer, so Npcap sees nothing.
Wireshark sees nothing either. In ExitLag, open **Settings -> Advanced -> Packet redirection method** and pick
**NDIS (Legacy)**.

![ExitLag settings screenshot](docs/images/exitlag.png)

---

## Common Questions

### Other players do not appear on the radar

Expected, and the question asked most often. Albion encrypts live player positions, so no passive tool can place them
on the map. The radar still detects them: open the **Players** page to see who is around, their guild, alliance, gear
and item power. Threat alerts run off that detection. Details in
[PLAYER_POSITIONS_MITM.md](docs/technical/PLAYER_POSITIONS_MITM.md).

### Nothing is detected at all

Work down this list:

1. Npcap (Windows) or libpcap (Linux) installed, radar restarted afterwards.
2. **Settings -> Network**: at least one interface ticked and marked active.
3. ExitLag, a VPN or a proxy in the way. See the section above.
4. On Linux, `setcap` applied, or running as root.

### It worked yesterday and now it detects nothing

Albion patches shift the wire protocol. When that happens every build stops decoding until the parser catches up. Check
[Releases](https://github.com/Nouuu/Albion-Online-OpenRadar/releases) for a newer version before opening an issue, and
hard-refresh the page (Ctrl+F5) after upgrading.

### Can two PCs share one radar?

Yes. Run the binary on the PC that plays Albion, then open the `(LAN)` URL from the startup banner on the other device.
Capture settings stay locked to the host for safety, so the second device gets a read-only view.

### Is there a macOS build?

No official build. It might compile from source, nobody has tested it. Tracked in
[#151](https://github.com/Nouuu/Albion-Online-OpenRadar/issues/151).

### Is there a Discord?

No. Use [Issues](https://github.com/Nouuu/Albion-Online-OpenRadar/issues) or
[Discussions](https://github.com/Nouuu/Albion-Online-OpenRadar/discussions).

### Is it safe?

The radar only reads network traffic. It never modifies the game client, never injects into its memory, and never
touches the connection. That said, it is still a third-party tool for an online game, and whether you use one is your
call and your risk.

---

## What It Detects

| What          | Coverage                                                                                       |
|---------------|------------------------------------------------------------------------------------------------|
| **Resources** | Wood, Rock, Fiber, Hide, Ore. T1-T8, enchanted `.1 .2 .3`, static and living                   |
| **Mobs**      | 5,186 catalogued, 9 danger classes colour-coded from green (normal) to red (boss)              |
| **Players**   | Faction flag, guild, alliance, equipment, item power, zone-aware threat alerts                  |
| **Zones**     | 1,418 zones. Safe / Yellow / Red / Black drives the alert gate                                  |
| **Mists**     | Solo and Duo portals with rarity, feu follets (wisp signs), wisp cages, Knightfall Abbey        |
| **Dungeons**  | Solo, Group, Corrupted, Hellgate, with per-enchant filters E0-E4                                |
| **Fishing**   | Spawns detected and drawn                                                                       |
| **Chests**    | Drawn on the radar. Rarity is stored but not yet colour-coded (#29)                             |

### Threat alerts

The alert gate depends on where you are:

| Zone type      | Alerts on                                     |
|----------------|-----------------------------------------------|
| Safe           | nothing                                       |
| Yellow, Red    | PvP-flagged players only                      |
| Black          | every player                                  |

Roads of Avalon always count as Black. A Mist counts as Black when you entered it through a lethal entrance or from a
red zone, Yellow otherwise, which is what the game does. A triggered alert flashes the screen, pulses the radar border
and plays a sound. Players on your ignore list never trigger it.

Players appear in the players list with their gear and item power. They are **not** drawn on the radar itself: Albion
encrypts live positions, see [Known limitations](#known-limitations).

---

## Radar Controls

| Control    | Range                                     |
|------------|-------------------------------------------|
| Size       | 300px to 800px                            |
| Zoom       | 0.1x to 3x                                |
| Icon size  | 0.5x to 2x                                |
| Rings      | distance markers at 10m and 20m           |
| Zone       | current zone name and PvP type            |
| Stats      | player, resource and mob counts           |
| PiP        | Picture-in-Picture floating window        |

**Picture-in-Picture**: playing fullscreen? Pop the radar into a floating always-on-top window. One click, native
browser PiP. Alerts mirror onto it.

**Self-contained**: fonts, icons and game data are bundled in the binary. Once Albion connects, the radar needs no
internet.

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

## Releases

| Version                                            | Headline                                                             |
|----------------------------------------------------|----------------------------------------------------------------------|
| [v2.2.3](docs/releases/RELEASE_2.2.3.md)           | Fresh game data on upgrade, equipment ids, alert gate                |
| [v2.2.2](docs/releases/RELEASE_2.2.2.md)           | 2026-06-29 patch resync: event codes and mob table                   |
| [v2.2.1](docs/releases/RELEASE_2.2.1.md)           | Mists threat detection, Knightfall Abbey, sub-zone maps              |
| [v2.2.0](docs/releases/RELEASE_2.2.0.md)           | Protocol18 stabilization, multi-interface capture, LAN access        |
| [v2.1.0](docs/releases/RELEASE_2.1.0.md)           | Memory and performance, Picture-in-Picture                           |
| [v2.0.0](docs/releases/RELEASE_2.0.0.md)           | Go backend, UI overhaul                                              |

Albion patches shift the wire protocol regularly. When detection breaks after a game update, that is usually why, and
the fix ships as a patch release.

---

## Known Limitations

- **Player positions**: Albion encrypts movement data. Players are detected and listed, but their live positions cannot
  be placed on the radar without a Photon MITM proxy, which is out of scope. See
  [PLAYER_POSITIONS_MITM.md](docs/technical/PLAYER_POSITIONS_MITM.md).
- **Some Black Zone maps**: background tiles are missing for zone IDs 4000+. Turn the map background off in settings.
- **Event 46 timing**: `HarvestableChangeState` can skip sizes or arrive late depending on server batching. The radar
  shows what the wire delivers. States the server skipped are unrecoverable.

Open bugs and feature requests live in [Issues](https://github.com/Nouuu/Albion-Online-OpenRadar/issues), the roadmap in
[TODO.md](docs/project/TODO.md).

---

## For Developers

| Tool    | Version | Purpose                |
|---------|---------|------------------------|
| Go      | 1.26+   | backend                |
| Npcap   | 1.87+   | Windows packet capture |
| libpcap | latest  | Linux packet capture   |
| Node.js | 20+     | asset and data tooling |
| Docker  | latest  | Linux cross-compile    |

```bash
git clone https://github.com/Nouuu/Albion-Online-OpenRadar.git
cd Albion-Online-OpenRadar

make run              # run
make dev              # hot-reload (needs: make install-tools)
make test             # Go tests + Vitest
make build-windows    # Windows binary
make build-linux      # Linux binary, via Docker
make all-in-one       # both binaries + READMEs + checksums
```

```
├── cmd/radar/        # entry point, flags, app wiring
├── internal/
│   ├── capture/      # multi-interface manager + libpcap workers
│   ├── photon/       # Protocol18 parser, event/op codes, pcap fixtures
│   ├── photonscan/   # shared decode walk used by the pcap tools
│   ├── server/       # HTTP routes, WebSocket, network and settings APIs
│   ├── templates/    # Go templates + HTMX pages
│   ├── ui/           # Bubble Tea TUI dashboard
│   └── logger/       # JSONL structured logging
├── web/              # frontend, embedded in the binary
│   ├── scripts/      # JS modules (core, handlers, drawings, utils)
│   ├── styles/       # Tailwind + DaisyUI, fonts
│   ├── images/       # maps, item and spell icons
│   ├── sounds/       # alert audio
│   └── ao-bin-dumps/ # game data, minified JSON
├── tools/            # Go tools (anonymize-pcap, photon-dump, photon-strings,
│                     # gen-eventcodes, offset-validate) + TS asset scripts
└── docs/             # documentation
```

Full setup, build system and test strategy: [DEV_GUIDE.md](docs/dev/DEV_GUIDE.md).

---

## Documentation

| Guide                                                | Description                                     |
|------------------------------------------------------|-------------------------------------------------|
| [docs/](docs/)                                       | documentation index                             |
| [DEV_GUIDE.md](docs/dev/DEV_GUIDE.md)                | development setup, build system, testing        |
| [docs/technical/](docs/technical/)                   | subsystem deep-dives                            |
| [TODO.md](docs/project/TODO.md)                      | roadmap and open observations                   |

---

## Contributing

Found a bug? [Open an issue](https://github.com/Nouuu/Albion-Online-OpenRadar/issues). A network capture helps but is
not required: a clear description of where you were and what you expected is already enough to aim the search.

---

## Credits

Built by [@Nouuu](https://github.com/Nouuu)

Based on [ZQRadar](https://github.com/Zeldruck/Albion-Online-ZQRadar) by [@Zeldruck](https://github.com/Zeldruck)

## Star History

<a href="https://www.star-history.com/?repos=Nouuu%2FAlbion-Online-OpenRadar&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Nouuu/Albion-Online-OpenRadar&type=date&theme=dark&legend=top-left&sealed_token=-zvDWixqs2Y0r6AOQJOgDNlG_rBSGs6zqrR73XaDp2RDVLfWoszgZRlN9HAsYIpvUrKAUQroGJQn3W19DGkymdop7jRTWjcz4mBq_Rq_48xe_dCRpUpjISHC6pAKuEMY8eBwqraA0-IXuWp82Pq5vz6QVSk-R3CBEdLSgBLADpdcspkMHzsaz4K9yGq5" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Nouuu/Albion-Online-OpenRadar&type=date&legend=top-left&sealed_token=-zvDWixqs2Y0r6AOQJOgDNlG_rBSGs6zqrR73XaDp2RDVLfWoszgZRlN9HAsYIpvUrKAUQroGJQn3W19DGkymdop7jRTWjcz4mBq_Rq_48xe_dCRpUpjISHC6pAKuEMY8eBwqraA0-IXuWp82Pq5vz6QVSk-R3CBEdLSgBLADpdcspkMHzsaz4K9yGq5" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Nouuu/Albion-Online-OpenRadar&type=date&legend=top-left&sealed_token=-zvDWixqs2Y0r6AOQJOgDNlG_rBSGs6zqrR73XaDp2RDVLfWoszgZRlN9HAsYIpvUrKAUQroGJQn3W19DGkymdop7jRTWjcz4mBq_Rq_48xe_dCRpUpjISHC6pAKuEMY8eBwqraA0-IXuWp82Pq5vz6QVSk-R3CBEdLSgBLADpdcspkMHzsaz4K9yGq5" />
 </picture>
</a>

---

<p align="center">
  <sub>⚠️ For educational purposes. Use at your own risk.</sub>
</p>
