# OpenRadar v2.0.x - Features Summary

This document summarizes the features implemented in OpenRadar v2.0.x.

---

## Backend (Go)

### Native Go Implementation
- **Single binary** (~95 MB) with all assets embedded
- **gopacket/pcap** for packet capture (replaces Node.js cap addon)
- **Protocol16** full deserialization (22+ data types)
- **Unified server** - HTTP + WebSocket on port 5001

### Server Components
- HTTP server with static asset serving
- WebSocket handler with max 100 clients
- JSONL structured logging with session files
- TUI dashboard (Bubble Tea) for monitoring

### Build System
- Makefile-based builds
- Hot-reload with Air (`make dev`)
- Docker support for Linux cross-compilation
- Version injection via ldflags

---

## UI Overhaul

### Framework Stack
- **HTMX 2.0.8** - SPA navigation without full page reload
- **Tailwind CSS v4** - Utility-first styling with dark theme
- **DaisyUI** - Component library (buttons, badges, toggles, collapse)
- **Go Templates** (.gohtml) - Server-side rendering
- **Vanilla JS** - Lightweight UI controllers

### Radar Display
- **4-layer canvas system** (map, draw, player, UI)
- **Dynamic sizing** - 300-800px adjustable
- **Zoom controls** - 0.5x to 2.0x magnification
- **Distance rings** - Visual indicators
- **Stats box** - Player/resource/mob counts by type
- **Zone indicator** - Zone name, tier, PvP type indicator
- **Threat border** - Red pulse on hostile detection

### Navigation
- Collapsible sidebar with icon-only mode
- HTMX partial rendering for smooth transitions
- Mobile-responsive design
- Active state indicators

### Picture-in-Picture Mode (v2.1.0)

- Native browser PiP via `canvas.captureStream(30)`
- 4-layer canvas compositing (map, draw, player, UI)
- PiP toggle button in header (radar page only)
- Automatic close on page navigation
- Real-time updates synced with radar rendering
- No separate window/iframe needed

---

## Detection Systems

### Resource Detection (100% Validated)
- **3,698 total detections** with 0 errors
- Static resources via HarvestablesDatabase (3,230+)
- Living resources via MobsDatabase (~2,800 types)
- Enchantment levels .0 to .3 supported
- All tiers T1-T8 validated

### Mob Classification
- **Color-coded threat levels**:
  - Green: Normal mobs
  - Purple: Enchanted/Champions
  - Orange: Mini-Bosses (VETERAN, ELITE)
  - Red: Bosses
- 4,528 mobs catalogued with metadata
- Filter categories: Normal/Enchanted/MiniBoss/Boss

### Player Detection (v2.1.0)

- **Faction-based detection** using Parameters[53]
- **Type-based color coding**:
  - Green (#00ff88): Passive (faction=0)
  - Orange (#ffa500): Faction (faction=1-6)
  - Red (#FF0000): Hostile (faction=255)
- **Zone-aware threat logic**:
  - Safe zones: no alerts
  - Yellow/Red zones: alert on hostile flagged
  - Black zones: ALL players = threat
- Equipment and spell overlay in player cards
- Alert system (screen flash, sound)
- 3-section player list (Hostile/Faction/Passive)

### Zone System (v2.1.0)

- **ZonesDatabase.js** with 1000+ zones
- PvP type detection (safe/yellow/red/black)
- Zone info display (name, tier, indicator)
- Threat logic based on zone type

---

## Performance (v2.1.0)

### WebSocket Optimization

- **Event coalescing** for Move (3), HealthUpdate (6)
- **Event throttling** with configurable intervals
- **WebSocketEventQueue** with batch processing
- Settings toggles for optimization features

### Code Cleanup

- Removed VirtualScroll (unused)
- Removed accordion.js (DaisyUI handles)
- Removed tooltips.css (DaisyUI handles)
- ESLint configured for underscore-prefixed vars

### SPA Navigation & Lifecycle (v2.1.0)

- **PageController.js** - Orchestrates page init/destroy cycles
- **WebSocketManager.js** - Robust connection handling with auto-reconnect
- **HTMX integration** - Partial page rendering, no full reloads
- **Page visibility handling** - WS pause on tab hide, resume on show
- **Database caching** - Persists across navigations (ItemsDB, MobsDB, etc.)
- **Dynamic imports** - Lazy loading for radar page (faster initial load)
- **Memory leak prevention** - Proper cleanup of handlers, drawings, WS

### Memory & Performance Analysis

- **Chrome DevTools trace analysis** with `tools/analyze_trace.py`
- Event listener leak detection and fix
- DOM node growth monitoring
- RAF budget tracking

### CDN to Local Migration (v2.1.0)

- **Lucide icons** - CDN → `/scripts/vendors/lucide.min.js`
- **HTMX** - CDN → `/scripts/vendors/htmx.min.js`
- **Google Fonts** → local woff2 in `/styles/fonts/`
    - JetBrains Mono (400, 500)
    - Space Grotesk (400, 500, 700)
- **fonts.css** with @font-face declarations
- **Offline-capable** - No external dependencies

---

## Performance Comparison

| Metric           | v1.x (Node.js)    | v2.0.x (Go)            |
|------------------|-------------------|------------------------|
| Total size       | ~500 MB           | ~95 MB                 |
| Ports            | 5001 + 5002       | 5001 only              |
| Startup          | Slow (extraction) | Instant                |
| Canvas layers    | 7                 | 4                      |
| Rendering        | 60 FPS            | 30 FPS (CPU efficient) |
| Event processing | Direct            | Coalesced + Throttled  |

---

## Known Limitations

- **Player positions** - Encrypted by Albion (dots disabled)
- **Blackzone maps** - Some tiles missing
- **Resource charges** - Server calculation differences

See [TODO.md](TODO.md) for roadmap and planned improvements.

---

*Last update: 2025-12-20 - v2.1.0*