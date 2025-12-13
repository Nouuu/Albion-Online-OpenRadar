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
- [x] Vanilla JS UI controllers (sidebar, accordions)
- [x] 4-layer canvas system
- [x] Dynamic radar size (300-800px)
- [x] Zoom controls (0.5x-2.0x)
- [x] Player color coding (passive/faction/hostile)
- [x] Collapsible sidebar navigation
- [x] Floating overlay window with sync

#### Detection (Refactored)
- [x] Resource detection 100% validated (3,698 detections)
- [x] Mob classification (Normal/Enchanted/MiniBoss/Boss)
- [x] Living resources via MobsDatabase (~2,800 types)
- [x] Static resources via HarvestablesDatabase (3,230+ types)
- [x] Enchantment detection (.0 to .3)
- [x] Player detection (nicknames, guild, alliance, equipment, spells)

---

## v2.1 - Detection Refactoring (Next)

### Priority: Complete Detection Systems

The following systems need to be refactored like Resources/Mobs/Players:
- Database-driven detection
- Proper event handlers
- Stale entity cleanup
- Settings-based filtering
- Classification system

#### Dungeons
- [ ] Create DungeonsDatabase.js (types, tiers, difficulties)
- [ ] Add stale entity cleanup
- [ ] Improve classification (Solo/Group/Corrupted/Hellgate/Avalonian)
- [ ] Add filtering by type in settings

#### Chests
- [ ] Create ChestsDatabase.js (rarities, types)
- [ ] Add stale entity cleanup
- [ ] Classification by rarity (Common/Uncommon/Rare/Legendary)
- [ ] Add filtering in settings

#### Mists
- [ ] Implement 19 event handlers (events 513-531)
- [ ] Add missing event codes in EventCodes.js
- [ ] Create proper MistsHandler.js
- [ ] Track Mists entrances/exits
- [ ] Wisp cages detection

#### Fishing
- [ ] Complete FishingHandler.js (TODOs in code)
- [ ] Add fishing zones on radar
- [ ] Fishing state tracking

### Priority: Map Improvements
- [ ] Blackzone map tiles extraction from Albion client
- [ ] Map tile size normalization (fix stretching on small zones)
- [ ] Map centering optimization (background alignment)
- [ ] Map scaling for different zone sizes

---

## v2.2+ - Future (Backlog)

### Stability & Performance
- [ ] WebSocket reconnection handling
- [ ] Memory usage optimization for long sessions
- [ ] BZ portal transitions fix

### Other Improvements
- [ ] Quality metrics dashboard
- [ ] Configuration file support

---

## Known Limitations

### Player Positions (Permanent)
- Position tracking impossible - Albion encrypts movement data
- Players detected but coordinates unavailable
- No fix possible - this is by design from Albion
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

## Detection Systems Status

| System | Status | Refactored | Notes |
|--------|--------|------------|-------|
| Resources | ✅ Working | ✅ Yes | Database-driven, cleanup, filtering |
| Mobs | ✅ Working | ✅ Yes | Database-driven, 9 classifications |
| Players | ⚠️ Partial | ✅ Yes | Positions encrypted (Albion limitation) |
| Dungeons | ⚠️ Basic | ❌ No | No cleanup, no database |
| Chests | ⚠️ Basic | ❌ No | Minimal implementation (57 lines) |
| Mists | ❌ Broken | ❌ No | 19 events defined but not implemented |
| Fishing | ⚠️ Partial | ❌ No | TODOs in code, incomplete |

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
