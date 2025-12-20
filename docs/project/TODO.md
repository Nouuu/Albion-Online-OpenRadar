# OpenRadar Roadmap

**Version**: 2.0.1 (Go Backend)
**Last Update**: 2025-12-20

---

## v2.0.1 - Current Development

### Completed (since v2.0.0)

#### Picture-in-Picture Mode (2025-12-20)

- [x] PiP implementation using `canvas.captureStream(30)`
- [x] 4-layer canvas compositing for PiP window
- [x] PiP toggle button in header (radar page only)
- [x] Automatic PiP close on page navigation
- [x] Event listener cleanup (stored refs + proper removal in destroy())
- [x] Removed legacy iframe-based overlay (radar-overlay.gohtml deleted)

#### Performance & Memory (2025-12-20)

- [x] Fix event listener leak in PictureInPictureManager
- [x] Trace analysis tooling (tools/analyze_trace.py)
- [x] Verified: 47% reduction in event listener accumulation
- [x] Verified: 30% reduction in DOM node growth

#### CDN to Local Migration (2025-12-20)

- [x] Lucide icons: CDN → `/scripts/vendors/lucide.min.js`
- [x] HTMX: CDN → `/scripts/vendors/htmx.min.js`
- [x] Google Fonts → local woff2 files in `/styles/fonts/`
    - JetBrains Mono (400, 500)
    - Space Grotesk (400, 500, 700)
- [x] fonts.css with @font-face declarations
- [x] Removed external CDN dependencies (offline-capable)

#### SPA Navigation & Lifecycle (2025-12-19)

- [x] PageController.js for page init/destroy orchestration
- [x] WebSocketManager.js for robust WS connection handling
- [x] HTMX integration for partial page rendering
- [x] Page visibility handling (WS pause/resume)
- [x] Resource page lifecycle with memory leak prevention
- [x] Database caching across navigations
- [x] Settings restoration on F5 refresh
- [x] Dynamic imports for lazy loading (radar page)

#### Player Detection Overhaul

- [x] Fix faction detection using Parameters[53] (not Parameters[11])
- [x] Create FactionConstants.js (Faction enum, helpers)
- [x] Add Player methods: isHostile(), isPassive(), isFactionPlayer()
- [x] Implement Event 359 (ChangeFlaggingFinished) handler
- [x] Player list UI with 3 sections (Hostile/Faction/Passive)
- [x] Zone-aware threat detection

#### Zone System

- [x] Create ZonesDatabase.js with PvP type detection
- [x] Add zones.json generation from ao-bin-dumps
- [x] Zone-based alert logic (black zone = all players hostile)
- [x] Enhanced zone info display (name, tier, PvP indicator)

#### UI/UX Improvements

- [x] DaisyUI components integration
- [x] Tailwind CSS v4 with DaisyUI theming
- [x] Player cards with threat-based color coding
- [x] Stats component with player counts by type
- [x] Responsive player list sections

#### Performance

- [x] WebSocketEventQueue with coalescing & throttling
- [x] Event batching (Move, HealthUpdate events)
- [x] Settings-controlled optimization toggles
- [x] Dead code cleanup

#### Technical Debt

- [x] Remove VirtualScroll (unused)
- [x] Remove accordion.js (DaisyUI handles collapse)
- [x] Remove tooltips.css (DaisyUI handles tooltips)
- [x] ESLint config for underscore-prefixed unused vars

---

## v2.1 - Detection Refactoring (Next)

### Priority: Complete Detection Systems

The following systems need refactoring like Resources/Mobs/Players:
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
- Player dots on radar disabled (would render at 0,0)

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

| System    | Status     | Refactored | Notes                                                                         |
|-----------|------------|------------|-------------------------------------------------------------------------------|
| Resources | ✅ Working  | ✅ Yes      | Database-driven, cleanup, filtering                                           |
| Mobs      | ✅ Working  | ✅ Yes      | Database-driven, 9 classifications                                            |
| Players   | ✅ Working  | ✅ Yes      | Faction detection, zone-aware alerts, positions encrypted (Albion limitation) |
| Zones     | ✅ Working  | ✅ Yes      | PvP type detection, threat logic                                              |
| Dungeons  | ⚠️ Basic   | ❌ No       | No cleanup, no database                                                       |
| Chests    | ⚠️ Basic   | ❌ No       | Minimal implementation                                                        |
| Mists     | ❌ Broken   | ❌ No       | 19 events defined but not implemented                                         |
| Fishing   | ⚠️ Partial | ❌ No       | TODOs in code, incomplete                                                     |

---

## Documentation

| Document | Description |
|----------|-------------|
| [DEV_GUIDE.md](../dev/DEV_GUIDE.md) | Development setup |
| [LOGGING.md](../technical/LOGGING.md) | Logging system |
| [PLAYERS.md](../technical/PLAYERS.md) | Player detection |

### Archived (Completed Plans)
See [docs/archive/](../archive/) for completed migration and refactoring plans.

---

*End of Roadmap*