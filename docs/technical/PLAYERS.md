# Player detection and display

How OpenRadar tracks and shows other players within the limits the Albion protocol allows.

*Last verified against code: 2026-09-25.*

## Overview

Players are detected from `Event 29 NewCharacter`. Nickname, guild, alliance, faction flag, equipment ids and
spell ids come from its parameters; no health field is read at spawn.

Live positions do not. They are XOR-encrypted on the wire, so `PlayersDrawing.invalidate` is a deliberate no-op and no
player is ever drawn on the radar canvas. Players surface in the players list instead, through
`PlayerListRenderer.js`. See [PLAYER_POSITIONS_MITM.md](./PLAYER_POSITIONS_MITM.md) for why.

## Detection

| Source | Code | Outcome |
|---|---|---|
| `NewCharacter` | 29 | spawn, nickname, guild, alliance, equipment ids, spell ids, faction flag, no health read |
| `Leave` | 1 | despawn |
| `HealthUpdate` | 6 | current HP at `Parameters[3]` |
| `CharacterEquipmentChanged` | 90 | equipment update |
| `RegenerationHealthChanged` | 91 | current and max HP at `Parameters[2]` and `Parameters[3]` |
| `Mounted` | 211 | mounted flag |
| `ChangeFlaggingFinished` | 365 | faction change, id at `Parameters[0]`, new faction at `Parameters[1]` |

`Move` (3) and `HealthUpdates` (7) are routed but not used for players: both only update mobs. Player coordinates in
the `Move` blob are encrypted anyway, so the radar has nothing to read from it.

## Display

The faction flag drives both the list badge and the threat decision.

| `faction` | List badge | Meaning |
|---|---|---|
| 0 | `Passive`, success colour | not flagged for PvP |
| 1-6 | faction city name, info colour | faction warfare flagged, the value is the city |
| 255 | `Hostile`, error colour | hostile |

Colours are DaisyUI semantic tokens, not fixed hex values, so they follow the active theme.

Toggles on the players settings page: `settingPlayersDetect` master switch, plus `settingPlayersPassive`,
`settingPlayersFaction` and `settingPlayersHostile` per flag. `settingPlayersShowEquipment`, `settingPlayersShowSpells`
and `settingPlayersShowHealthBars` control what each card carries, `settingPlayersMaxDisplayed` caps the list.

`PlayersHandler` tracks players up to a fixed cap of 100 regardless of `settingPlayersDetect`: turning detection off
stops the list, the counts, and every alert, but the handler keeps building state underneath so nothing needs to
re-sync when detection comes back on.

## Alerts

`PlayersHandler.triggerHostileAlert` fires on two paths: a spawn that is already hostile, and a faction change that
turns a known player hostile. Both paths go through the same gate, which also requires `settingPlayersDetect` to be
on; turning detection on does not retroactively alert on players already tracked.

**Ignore gate.** `isIgnored` reads the `settingIgnoreList` setting the ignore list page writes and matches on
nickname, guild or alliance, trimmed and case insensitive. Blank entries never match, so a stray empty line cannot
mute every threat. Ignored players still render in the list. Only the alert, and the border pulse, are suppressed:
`getThreatPlayers` excludes ignored players, so ignored players also do not pulse the border.

**Zone gate.** `isPlayerThreat(faction, pvpType)`:

| `pvpType` | Threat |
|---|---|
| `safe` | never |
| `yellow`, `red` | only `faction === 255` |
| `black` | every player |

An unknown zone resolves to `safe` through `zonesDatabase.getPvpType`, so a hostile in an unmapped zone fires nothing.
That behaviour is asserted as-is in `_PlayersHandler.test.js` and tracked in
[TODO.md](../project/TODO.md).

`getThreatPlayers` stays independent of the Passive, Faction and Hostile display filters: a player can be filtered
out of the list and still trigger the flash, sound and border.

When both gates pass, the alert flashes the screen and plays a sound, each behind its own setting. A blocked sound
raises a visible warning rather than a silent debug log.

## Player record shape

```javascript
{
  id: 12345,
  nickname: 'PlayerName',
  guildName: 'GuildName',
  allianceName: 'Alliance',
  faction: 0,             // 0 passive, 1-6 faction city, 255 hostile
  posX: 100.0,            // spawn position, not live
  posY: 200.0,
  hX: 0,                  // interpolation target, unused while drawing is disabled
  hY: 0,
  currentHealth: 850,
  initialHealth: 1000,
  equipments: [],         // item ids, resolved through itemsDatabase
  spells: [],             // spell ids
  mounted: false,
  detectedAt: <ms>,
  lastUpdateTime: <ms>    // required for cleanup
}
```

`getAverageItemPower` averages the item power of the slots it keeps (`index <= 4 || index === 8`).

## Files

| File | Purpose |
|---|---|
| `web/scripts/handlers/PlayersHandler.js` | detection, ignore list, alert gate, state |
| `web/scripts/core/PlayerListRenderer.js` | player cards, badges, gear and spell icons |
| `web/scripts/drawings/PlayersDrawing.js` | interpolation only, `invalidate` is a no-op |
| `web/scripts/utils/AlertSound.js` | asks the Go process to play the threat sound |
| `internal/audio/player.go` | native playback, one sound at a time |
| `internal/templates/pages/players.gohtml` | settings UI |
| `internal/templates/pages/ignorelist.gohtml` | ignore list management |
| `internal/photon/events.go` | event 29 deserialization |
