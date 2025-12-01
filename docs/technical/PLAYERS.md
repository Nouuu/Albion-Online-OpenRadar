# 👥 Player Detection & Display System

*Last updated: 2025-12-01*

## 🧭 Scope & Related Docs

This document describes the **architecture and stable behavior** of the player detection & display system.

For up‑to‑date investigation status and protocol details, see:
- `docs/work/PLAYER_DETECTION_STATUS.md` → **current status & timeline of investigations** (detection & movement)
- `docs/PLAYER_POSITIONS_MITM.md` → **protocol & encryption limits** (Photon AES + XOR, MITM, why precise positions are out of scope)
- `docs/ANALYSIS_DEATHEYE_VS_CURRENT.md` → detailed **technical comparison with DEATHEYE** (equipment, XML DB, etc.)

---

## ⚠️ Historical Issues & Known Limitations

> This section summarizes past issues and the **current constraints**. For the full, dated timeline, always refer to `docs/work/PLAYER_DETECTION_STATUS.md`.

### Historical state (before 2025‑11‑10)

- ✅ Player **detection** worked (NewCharacter events captured)
- ✅ Local player position (lpX/lpY) worked
- ❌ Other players either didn’t display or all appeared at (0, 0)
- ❌ Move events for players had corrupted/unused coordinates
- ✅ Buffer decoding at offsets 12–19 worked **for mobs only**, not players

### Current functional scope (post‑2025‑11‑17)

- ✅ Players are **detected** and can be displayed on the radar when the feature is enabled
- ✅ Mobs and resources are fully functional (spawn + movement) – see `PLAYER_DETECTION_STATUS.md`
- ⚠️ Player movement is still under investigation:
  - Event 29 (NewCharacter) position buffer for players is not fully deserialized on server
  - Event 3 (Move) works perfectly for mobs, but players can still exhibit incorrect/laggy positions depending on state
- ❗ **Precise, reliable absolute positions for other players are out of scope without a Photon MITM proxy** → see `PLAYER_POSITIONS_MITM.md` for details

In short:
- Architecture and rendering are stable.
- Detection works.
- Movement and exact positions for other players are limited by both protocol investigations and encryption constraints.

---

## 📋 Table of Contents

- [Scope & Related Docs](#-scope--related-docs)
- [Historical Issues & Known Limitations](#-historical-issues--known-limitations)
- [Overview](#overview)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Implementation Status](#implementation-status)
- [Usage](#usage)
- [Debug & Logging](#debug--logging)
- [Future Improvements](#future-improvements)

---

## Overview

The player detection system tracks and displays enemy players on the radar in real time **within the limits of the protocol and encryption**.

Players are detected through Photon network packet analysis. Display and movement rely on:
- server‑side deserialization (`Protocol16Deserializer.js`),
- client‑side handlers (`PlayersHandler.js`),
- and drawing logic (`PlayersDrawing.js`).

For encryption / MITM constraints, always refer to `PLAYER_POSITIONS_MITM.md`.

### Current Features ✅

- **Player Detection**: NewCharacter events captured successfully
- **Type Filtering**: Separate toggles for Passive/Faction/Dangerous players
- **Debug Logging**: Detailed logs for detection and movement events
- **Master Toggle**: `settingShowPlayers` to enable/disable all player detection
- **Equipment IDs**: Player items captured from NewCharacter

### Not Guaranteed / Limited ❌

- **Precise player positions**: limited by protocol + encryption; see `PLAYER_POSITIONS_MITM.md`
- **Smooth movement for all players**: current behavior depends on ongoing work in `PLAYER_DETECTION_STATUS.md`

### Planned Features 🚧

- Nickname display on hover
- Health bar overlay
- Distance indicator
- Guild/Alliance tags
- Color‑coded dots by faction status
- Mount status indicator

---

## Architecture

### File Structure

```
scripts/
├── Handlers/
│   └── PlayersHandler.js       # Detection, filtering, storage
├── Drawings/
│   └── PlayersDrawing.js       # Rendering on radar canvas
└── Utils/
    ├── Settings.js             # Settings management
    └── ItemsPage.js            # Items display (requires settingShowPlayers)

views/main/
└── home.ejs                    # UI controls for player settings
```

### Data Flow

```
Network Packet (Photon)
    ↓
PlayersHandler.handleNewPlayerEvent(parameters)
    ├─ Check: settings.settingShowPlayers enabled?
    ├─ Check: Player type filter enabled? (Passive/Faction/Dangerous)
    ├─ Check: Ignore list (players/guilds/alliances)
    └─ Add to playersInRange[] array
    ↓
Render Loop (scripts/Utils/Utils.js)
    ├─ PlayersDrawing.interpolate(players, lpX, lpY, t)
    │   └─ Calculate smooth positions (hX, hY) using lerp
    └─ PlayersDrawing.invalidate(context, players)
        └─ Draw red circles for each player
```

---

## Configuration

### Required Settings

1. **`settingShowPlayers`** (Master Toggle) ⭐
   - Location: `views/main/home.ejs` - Show section
   - Default: `false`
   - **Must be enabled** for any player detection

2. **At least ONE type filter:**
   - `settingPassivePlayers` - Non-flagged players (flagId = 0)
   - `settingFactionPlayers` - Faction warfare players (flagId = 1-6)
   - `settingDangerousPlayers` - Hostile players (flagId = 255 or Black Zone)

### Optional Settings

| Setting | Description | Location | Default |
|---------|-------------|----------|---------|
| `settingItems` | Show player equipment | home.ejs | `false` |
| `settingItemsDev` | Show item IDs (dev) | home.ejs | `false` |
| `settingSound` | Play sound on detection | home.ejs | `false` |
| `settingFlash` | Red flash on detection | home.ejs | `false` |
| `settingNickname` | Show nickname* | - | `false` |
| `settingHealth` | Show health bar* | - | `false` |
| `settingDistance` | Show distance* | - | `false` |
| `settingGuild` | Show guild name* | - | `false` |
| `settingMounted` | Show mount status* | - | `false` |

*Not yet implemented in UI or drawing logic*

### Ignore Lists

Players can be filtered out by:
- **Player nickname** (exact match, case-insensitive)
- **Guild name** (exact match, case-insensitive)
- **Alliance name** (exact match, case-insensitive)

Managed in `views/main/ignorelist.ejs`

---

## Implementation Status

### ✅ Completed (as of 2025‑11‑09)

- Core drawing system (`scripts/Drawings/PlayersDrawing.js`)
- Handler logic (`scripts/Handlers/PlayersHandler.js`)
- Settings system (`scripts/Utils/Settings.js`, `views/main/home.ejs`)
- Debug logging categories (`CATEGORIES.PLAYER`, `CATEGORIES.PLAYER_HEALTH`)

See the existing sections below for full details of each change and file.

### 🚧 Under Active Investigation (see `PLAYER_DETECTION_STATUS.md`)

- Server‑side deserialization of Event 29 (NewCharacter) position buffer for players
- Behavior of Event 3 (Move) for players vs mobs
- Edge cases where players appear frozen or jumpy

> **Do not rely on this file alone for the latest investigation status.**
> Always cross‑check with `docs/work/PLAYER_DETECTION_STATUS.md`.

### ❌ Not Implemented Yet

- Advanced radar overlays (nickname, health bar, distance, guild tag, mount icon) on the radar itself
- Full UI wiring for `settingNickname`, `settingHealth`, `settingDistance`, `settingGuild`, `settingMounted`

---

## Usage

### For Users

#### Enable Player Detection

1. Launch the app: `npm start`
2. Open browser: `http://localhost:5001`
3. Navigate to **Players** page (`/home`)
4. **Show Section**:
   - ✅ Check **"Show Players on Radar"**
5. **Types Section** (check at least one):
   - Passive Players (safe zones)
   - Faction Players (faction warfare)
   - Dangerous Players (red/black flagged)
6. Launch Albion Online and play
7. Players will appear as **red dots** 🔴 on the radar

#### Optional: Enable Debug Logs

1. Go to **Settings** page (`/settings`)
2. **Debug & Logging** section
3. ✅ Check **"Debug Players"**
4. Open browser console (F12) to see logs

### For Developers

#### Reading Player Data

```javascript
// Access players in range
const players = playersHandler.playersInRange;

// Player object structure
{
  id: number,           // Unique player ID
  nickname: string,     // Player name
  guildName: string,    // Guild name
  posX: number,         // World X position
  posY: number,         // Radar X (interpolated)
  hX: number,           // Radar X (interpolated)
  hY: number,           // Radar Y (interpolated)
  currentHealth: number,
  initialHealth: number,
  items: Array,         // Equipment items
  flagId: number,       // Faction status (0=passive, 1-6=faction, 255=hostile)
  mounted: boolean      // Mount status
}
```

#### Extending Drawing Logic

To add new visual elements in `PlayersDrawing.invalidate()`:

```javascript
invalidate(context, players) {
  for (const playerOne of players) {
    const point = this.transformPoint(playerOne.hX, playerOne.hY);

    // Draw red dot (existing)
    this.drawFilledCircle(context, point.x, point.y, 10, '#FF0000');

    // Example: Add nickname (NEW)
    if (this.settings.settingNickname) {
      this.drawText(point.x, point.y + 20, playerOne.nickname, context);
    }

    // Example: Add health bar (NEW)
    if (this.settings.settingHealth) {
      const percent = playerOne.currentHealth / playerOne.initialHealth;
      this.drawHealthBar(context, point.x, point.y,
                        playerOne.currentHealth,
                        playerOne.initialHealth, 60, 10);
    }
  }
}
```

---

## Debug & Logging

### Enable Logging

**Via UI** (Recommended):
- Settings → Debug & Logging → ✅ Debug Players

**Via Console**:
```javascript
localStorage.setItem('settingDebugPlayers', 'true');
location.reload();
```

### Log Categories

#### `CATEGORIES.PLAYER`
- **NewPlayerEvent_ALL_PARAMS**: Full detection event
  ```javascript
  {
    playerId: 12345,
    nickname: "PlayerName",
    guildName: "GuildName",
    alliance: "AllianceName",
    health: 1000,
    flagId: 0,
    allParameters: {...},  // All 50+ parameters
    parameterCount: 54
  }
  ```

- **PlayerDebugInfo**: Drawing details
  ```javascript
  // Count log (once per frame if players exist)
  {
    playersCount: 3,
    playerIds: [12345, 67890, 11111],
    playerNicknames: ["Player1", "Player2", "Player3"]
  }

  // Per-player log (once per player)
  {
    id: 12345,
    nickname: "PlayerName",
    hX: 120.5,
    hY: -45.2,
    pointX: 250,  // Canvas X
    pointY: 250,  // Canvas Y
    flagId: 0
  }
  ```

#### `CATEGORIES.PLAYER_HEALTH`
- **PlayerHealthUpdate_DETAIL**: Health changes
  ```javascript
  {
    playerId: 12345,
    params2_currentHP: 850,
    params3_maxHP: 1000,
    hpPercentage: "85%",
    allParameters: {...},
    parameterCount: 5
  }
  ```

### Log Settings Map

From `scripts/constants/LoggerConstants.js`:

```javascript
CATEGORY_SETTINGS_MAP = {
  PLAYER: 'debugPlayers',          // Toggle in Settings
  PLAYER_HEALTH: 'debugPlayers',   // Same toggle
  // ...
}
```

---

## Future Improvements

At high level, future work on the player system splits into two tracks:

1. **UI / UX improvements** (safe, no protocol assumptions):
   - Use existing settings: nickname, health, distance, guild, mount status
   - Improve visual representation on radar (colors, shapes, clustering)

2. **Protocol‑level investigations** (must follow rules in `PLAYER_DETECTION_STATUS.md`):
   - Any change to server‑side deserialization must be documented and validated there
   - No attempt to bypass encryption or reimplement MITM in this project

Always document protocol experiments in `docs/work/PLAYER_DETECTION_STATUS.md`, not here.

---

## Code References

### Key Files

- **PlayersHandler.js:116** - `settingShowPlayers` check
- **PlayersDrawing.js:20** - `settingShowPlayers` check (items)
- **PlayersDrawing.js:88-103** - `interpolate()` method
- **PlayersDrawing.js:109-140** - `invalidate()` method
- **Settings.js:17** - Settings definition
- **Settings.js:393** - Settings update from localStorage
- **home.ejs:21** - UI checkbox
- **LoggerConstants.js:20** - `CATEGORIES.PLAYER`
- **LoggerConstants.js:160** - `CATEGORY_SETTINGS_MAP`

### Patterns to Follow

For consistency, follow these existing patterns:

1. **Drawing Pattern**: See `MobsDrawing.js:invalidate()`
2. **Health Bar**: See `DrawingUtils.drawHealthBar()`
3. **Color Coding**: See `MobsDrawing.getEnemyColor()`
4. **Custom Images**: See `DrawingUtils.DrawCustomImage()`
5. **Distance Calc**: See `DrawingUtils.calculateDistance()`

---

## Troubleshooting

### Players Not Showing on Radar

1. ✅ Check `settingShowPlayers` is enabled
2. ✅ Check at least one type filter is enabled
3. ✅ Check player isn't in ignore list
4. 🐛 Enable `debugPlayers` and check console logs
5. 🔍 Verify `NewPlayerEvent_ALL_PARAMS` logs appear

### Players Showing But No Visual

1. Check `playersInRange` array has data
2. Check `interpolate()` is calculating hX/hY
3. Check `invalidate()` is being called
4. Look for `PlayerDebugInfo` logs with positions

### Settings Not Saving

1. Check browser localStorage isn't disabled
2. Check for errors in browser console
3. Verify localStorage keys: `settingShowPlayers`, etc.

---

## Contributing

When adding new player features:

1. ✅ Follow existing naming patterns (`setting*`)
2. ✅ Add UI checkbox in `home.ejs`
3. ✅ Add setting to `Settings.js` (constructor + update)
4. ✅ Add debug logging with appropriate CATEGORY/EVENT
5. ✅ Update this documentation
6. ✅ Test with `debugPlayers` enabled

---

*For more information, see:*
- [LOGGING.md](./LOGGING.md) - Logging system details
- [SETTINGS.md](./SETTINGS.md) - Settings system overview
- [DEV_GUIDE.md](../dev/DEV_GUIDE.md) - Development guidelines
