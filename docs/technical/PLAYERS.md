# Player detection and display

How OpenRadar tracks and renders other players within the limits the Albion protocol allows.

*Last verified against code: 2026-05-01.*

## Overview

Players are detected from `Event 29 NewCharacter`. Equipment, guild, alliance, faction flag, and health come from event parameters. Movement is tracked via `Event 3 Move`, with a constraint detailed in `PLAYER_POSITIONS_MITM.md`: player positions are XOR-encrypted by Albion. The radar can place player spawns based on the data the server sends, but absolute live positions during play require a Photon MITM proxy that is out of scope.

## Detection

| Source | Outcome |
|---|---|
| Event 29 NewCharacter | spawn, name, guild, alliance, equipment ids, flag, initial health |
| Event 3 Move | move signal (encrypted positions for players) |
| Event 6 / 8 HealthUpdate | current health changes |
| Event 90 EquipmentChanged | equipment id update |

## Display

| Flag id | Color | Meaning |
|---|---|---|
| 0 | green `#00ff88` | passive, not flagged for PvP |
| 1-6 | orange `#ffa500` | faction warfare flagged |
| 255 | red `#ff0000` | hostile |

Toggles: master "Show Players" plus per-flag filters (Passive, Faction, Hostile).

## Alerts

The threat alert pipeline lives in `PlayersHandler.triggerHostileAlert`. Two gates apply:

- The detected player is not in the local ignore list (matched by nickname, guild, or alliance).
- The current zone PvP type is one where the alert should fire (zone-aware). The fallback for unknown zones treats them as `safe` to avoid spurious alerts; an open observation tracks zones where the lookup misses while a hostile is actually present.

When both gates pass, the player triggers screen flash and a sound alert if both options are enabled.

## Player record shape

```javascript
{
  id: 12345,
  nickname: 'PlayerName',
  guildName: 'GuildName',
  alliance: 'Alliance',
  posX: 100.0,
  posY: 200.0,
  hX: 120.5,           // interpolated for radar
  hY: -45.2,
  currentHealth: 850,
  initialHealth: 1000,
  items: [],            // equipment item ids
  flagId: 0,            // 0 passive, 1-6 faction, 255 hostile
  mounted: false,
  lastUpdateTime: <ms>  // required for cleanup
}
```

## Files

| File | Purpose |
|---|---|
| `web/scripts/handlers/PlayersHandler.js` | detection, ignore list, alert gate, state |
| `web/scripts/drawings/PlayersDrawing.js` | radar rendering, color coding |
| `internal/templates/pages/players.gohtml` | settings UI |
| `internal/templates/pages/ignorelist.gohtml` | ignore list management |
| `internal/photon/events.go` | event 29 deserialization |
