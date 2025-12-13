# OpenRadar Roadmap

**Version**: 2.0.0 (Go Backend)
**Last Update**: 2025-12-13

---

## v2.0.0 - Current Release

### Completed

#### Backend
- [x] Native Go backend (single binary ~95 MB)
- [x] gopacket/pcap packet capture
- [x] Protocol16 full deserialization (22+ types)
- [x] Unified HTTP + WebSocket on port 5001
- [x] TUI dashboard with Bubble Tea
- [x] JSONL structured logging
- [x] Cross-platform builds (Windows, Linux via Docker)

#### UI
- [x] Modern dark theme (Tailwind CSS v4)
- [x] HTMX SPA navigation
- [x] Alpine.js reactive components
- [x] 4-layer canvas system
- [x] Dynamic radar size (300-800px)
- [x] Zoom controls (0.5x-2.0x)
- [x] Player color coding (passive/faction/hostile)
- [x] Collapsible sidebar navigation
- [x] Floating overlay window with sync

#### Detection
- [x] Resource detection 100% validated (3,698 detections)
- [x] Mob classification (Normal/Enchanted/MiniBoss/Boss)
- [x] Living resources via MobsDatabase (~2,800 types)
- [x] Static resources via HarvestablesDatabase (3,230+ types)
- [x] Enchantment detection (.0 to .3)

---

## v2.1 - Map & Stability (Next)

### Priority: Map Improvements
- [ ] Blackzone map tiles extraction from Albion client
- [ ] Map tile size normalization (fix stretching on small zones)
- [ ] Map background loading optimization

### Priority: Bug Fixes & Stability
- [ ] Player movement reliability improvements
- [ ] WebSocket reconnection handling
- [ ] Memory usage optimization for long sessions

---

## v2.2+ - Future (Backlog)

### Player Enhancements
- [ ] Nickname display option
- [ ] Health bar overlay
- [ ] Distance indicator (meters)
- [ ] Guild/Alliance tags
- [ ] Mount status indicator

### Other Improvements
- [ ] Quality metrics dashboard
- [ ] Feature flags system
- [ ] Configuration file support

---

## Known Limitations

### Player Movement
- Movement tracking limited due to Albion's encryption
- See [PLAYER_POSITIONS_MITM.md](../technical/PLAYER_POSITIONS_MITM.md) for technical details

### Blackzone Maps
- Some blackzone map tiles missing (4000+, 5000+ IDs)
- Workaround: Disable "Show Map Background" in Settings
- Solution: Extract tiles from Albion client

### Resource Charges
- Remaining charges display may be inaccurate
- Server counts harvest bonus differently
- No fix possible (missing server-side data)

---

## Documentation

| Document | Description |
|----------|-------------|
| [DEV_GUIDE.md](../dev/DEV_GUIDE.md) | Development setup |
| [LOGGING.md](../technical/LOGGING.md) | Logging system |
| [PLAYERS.md](../technical/PLAYERS.md) | Player detection |
| [DEATHEYE_ANALYSIS.md](../technical/DEATHEYE_ANALYSIS.md) | Upgrade reference |

### Archived (Completed Plans)
See [docs/archive/](../archive/) for completed migration and refactoring plans.

---

*End of Roadmap*
