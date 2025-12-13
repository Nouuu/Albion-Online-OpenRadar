# OpenRadar v2.0 - Features Summary

This document summarizes the features implemented in OpenRadar v2.0.

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
- **Alpine.js** - Reactive components
- **Tailwind CSS v4** - Utility-first styling with dark theme
- **Go Templates** (.gohtml) - Server-side rendering

### Radar Display
- **4-layer canvas system** (map, draw, player, UI)
- **Dynamic sizing** - 300-800px adjustable
- **Zoom controls** - 0.5x to 2.0x magnification
- **Distance rings** - Visual indicators
- **Stats box** - Player/resource/mob counts
- **Zone indicator** - Current zone with BZ status
- **Threat border** - Red pulse on hostile detection

### Navigation
- Collapsible sidebar with icon-only mode
- HTMX partial rendering for smooth transitions
- Mobile-responsive design
- Active state indicators

### Overlay Window
- Floating radar window
- BroadcastChannel settings sync
- Auto-hiding controls
- Transparent background option

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

### Player Detection
- Real-time position tracking
- **Type-based color coding**:
  - Green (#00ff88): Passive
  - Orange (#ffa500): Faction
  - Red (#FF0000): Hostile
- Equipment and spell overlay options
- Alert system (screen flash, sound)

---

## Performance

| Metric | v1.x (Node.js) | v2.0 (Go) |
|--------|----------------|-----------|
| Total size | ~500 MB | ~95 MB |
| Ports | 5001 + 5002 | 5001 only |
| Startup | Slow (extraction) | Instant |
| Canvas layers | 7 | 4 |
| Rendering | 60 FPS | 30 FPS (CPU efficient) |

---

## Known Limitations

- **Player movement** - Limited due to Albion encryption
- **Blackzone maps** - Some tiles missing
- **Resource charges** - Server calculation differences

See [TODO.md](TODO.md) for roadmap and planned improvements.

---

*Last update: 2025-12-13 - v2.0.0 Release*
