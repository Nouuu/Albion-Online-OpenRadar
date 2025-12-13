# Player Detection & Display System

*Last updated: 2025-12-13 (v2.0)*

## Overview

The player detection system tracks and displays other players on the radar in real time within the limits of the Albion protocol.

### Related Documentation
- [PLAYER_POSITIONS_MITM.md](./PLAYER_POSITIONS_MITM.md) - Protocol encryption limits
- [DEATHEYE_ANALYSIS.md](./DEATHEYE_ANALYSIS.md) - Technical comparison with DEATHEYE

---

## Current Features (v2.0)

### Detection
- Player detection via NewCharacter events (Event 29)
- Equipment IDs captured from event parameters
- Guild and alliance information

### Display
- **Color-coded dots by type**:
  - Green (#00ff88): Passive (flagId = 0)
  - Orange (#ffa500): Faction (flagId = 1-6)
  - Red (#FF0000): Hostile (flagId = 255)
- Type filtering toggles (Passive/Faction/Hostile)
- Master toggle to enable/disable all player display
- Position interpolation for smooth movement

### Alerts
- Screen flash on hostile detection
- Sound alert option

---

## Known Limitations

### Player Movement
- Movement tracking is limited due to Albion's encryption
- Event 3 (Move) works reliably for mobs but can be inconsistent for players
- Precise absolute positions require MITM proxy (out of scope)

See [PLAYER_POSITIONS_MITM.md](./PLAYER_POSITIONS_MITM.md) for technical details.

---

## Architecture (v2.0 - Go Backend)

### File Structure

```
web/scripts/
├── Handlers/
│   └── PlayersHandler.js       # Detection, filtering, storage
├── Drawings/
│   └── PlayersDrawing.js       # Rendering on radar canvas
└── Utils/
    ├── SettingsSync.js         # Settings management
    └── DrawingUtils.js         # Drawing utilities

internal/templates/pages/
└── players.gohtml              # UI controls for player settings
```

### Data Flow

```
Network Packet (Photon - port 5056)
    ↓
Go Backend (internal/photon/)
    ├─ ParsePhotonPacket()
    ├─ ProcessCommand()
    └─ BroadcastEvent() via WebSocket
    ↓
WebSocket (ws://localhost:5001/ws)
    ↓
PlayersHandler.handleNewPlayerEvent(parameters)
    ├─ Check: settings enabled?
    ├─ Check: Player type filter?
    ├─ Check: Ignore list?
    └─ Add to playersInRange[]
    ↓
RadarRenderer (30 FPS)
    ├─ PlayersDrawing.interpolate()
    └─ PlayersDrawing.draw()
```

---

## Configuration

### Settings (players.gohtml)

| Setting | Description | Default |
|---------|-------------|---------|
| Show Players | Master toggle | `false` |
| Passive Players | Non-flagged (flagId=0) | `true` |
| Faction Players | Faction warfare (1-6) | `true` |
| Hostile Players | Red/hostile (255) | `true` |
| Sound Alert | Play sound on detection | `false` |
| Screen Flash | Red flash on detection | `false` |

### Ignore Lists

Players can be filtered by:
- Player nickname (exact match)
- Guild name (exact match)
- Alliance name (exact match)

Managed in the Ignore List page (`/ignorelist`).

---

## Player Data Structure

```javascript
const player = {
  id: 12345,              // Unique player ID
  nickname: 'PlayerName',  // Display name
  guildName: 'GuildName',  // Guild (may be empty)
  alliance: 'Alliance',    // Alliance (may be empty)
  posX: 100.0,            // World X position
  posY: 200.0,            // World Y position
  hX: 120.5,              // Interpolated X (for radar)
  hY: -45.2,              // Interpolated Y (for radar)
  currentHealth: 850,
  initialHealth: 1000,
  items: [],              // Equipment item IDs
  flagId: 0,              // 0=passive, 1-6=faction, 255=hostile
  mounted: false          // Mount status
};
```

---

## Future Improvements (Backlog)

These features are planned but not yet implemented:

- [ ] Nickname display option
- [ ] Health bar overlay
- [ ] Distance indicator (meters)
- [ ] Guild/Alliance tags
- [ ] Mount status indicator

See [TODO.md](../project/TODO.md) for the full roadmap.

---

## Troubleshooting

### Players Not Showing

1. Check "Show Players" is enabled in settings
2. Check at least one type filter is enabled
3. Check player isn't in ignore list
4. Open browser console (F12) for debug logs

### Players at Wrong Position

1. This is a known limitation due to encryption
2. Position data from Event 29 may be incomplete
3. Movement updates (Event 3) can be inconsistent for players
4. See [PLAYER_POSITIONS_MITM.md](./PLAYER_POSITIONS_MITM.md)

---

## Code References

### Key Files

| File | Purpose |
|------|---------|
| `web/scripts/Handlers/PlayersHandler.js` | Detection and filtering |
| `web/scripts/Drawings/PlayersDrawing.js` | Radar rendering |
| `internal/templates/pages/players.gohtml` | Settings UI |
| `internal/photon/protocol16.go` | Event deserialization |

### Drawing Patterns

Follow existing patterns in:
- `MobsDrawing.js` - Color coding by type
- `DrawingUtils.js` - Health bars, distance calculation
- `HarvestablesDrawing.js` - Icon rendering

---

*For more information:*
- [LOGGING.md](./LOGGING.md) - Debug logging system
- [DEV_GUIDE.md](../dev/DEV_GUIDE.md) - Development setup
