# Player detection and display

How OpenRadar tracks and shows other players within the limits the Albion protocol allows.

*Last verified against code: 2026-09-25.*

## Overview

Players are detected from `Event 29 NewCharacter`. Nickname, guild, alliance, faction flag, equipment ids, spell ids and
health all come from event parameters.

Live positions do not. They are XOR-encrypted on the wire, so `PlayersDrawing.invalidate` is a deliberate no-op and
players surface in the players list instead, through `PlayerListRenderer.js`. See
[PLAYER_POSITIONS_MITM.md](./PLAYER_POSITIONS_MITM.md) for why. The radar only shows where a player just acted, from the
plaintext positions a few events carry. See [Action markers](#action-markers).

## Detection

| Source | Code | Outcome |
|---|---|---|
| `NewCharacter` | 29 | spawn, nickname, guild, alliance, equipment ids, spell ids, faction flag, initial health |
| `Move` | 3 | move signal. Player coordinates in the blob are encrypted |
| `HealthUpdate` | 6 | current health, single target |
| `HealthUpdates` | 7 | current health, bulk |
| `CharacterEquipmentChanged` | 90 | equipment id update |
| `Leave` | 1 | despawn |

## Display

The faction flag drives both the list badge and the threat decision.

| `faction` | List badge | Meaning |
|---|---|---|
| 0 | `Passive`, success colour | not flagged for PvP |
| 1-6 | faction city name, info colour | faction warfare flagged, the value is the city |
| 255 | `Hostile`, error colour | hostile |

Colours are DaisyUI semantic tokens, not fixed hex values, so they follow the active theme.

Toggles on the players settings page: `settingShowPlayers` master switch, plus `settingPassivePlayers`,
`settingFactionPlayers` and `settingDangerousPlayers` per flag. `settingItems`, `settingShowSpells` and
`settingShowPlayerHealthBar` control what each card carries, `settingMaxPlayersDisplay` caps the list.
`settingShowPlayerActions` turns the action markers on. It is off until ticked.

## Alerts

`PlayersHandler.triggerHostileAlert` fires on two paths: a spawn that is already hostile, and a faction change that
turns a known player hostile. Both apply the same two gates.

**Ignore gate.** `isIgnored` reads the `ignoreList` setting the ignore list page writes and matches on nickname, guild
or alliance, trimmed and case insensitive. Blank entries never match, so a stray empty line cannot mute every threat.
Ignored players still render in the list. Only the alert is suppressed.

**Zone gate.** `isPlayerThreat(faction, pvpType)`:

| `pvpType` | Threat |
|---|---|
| `safe` | never |
| `yellow`, `red` | only `faction === 255` |
| `black` | every player |

An unknown zone resolves to `safe` through `zonesDatabase.getPvpType`, so a hostile in an unmapped zone fires nothing.
That behaviour is asserted as-is in `_PlayersHandler.test.js` and tracked in
[TODO.md](../project/TODO.md).

When both gates pass, the alert flashes the screen and plays a sound, each behind its own setting. A blocked sound
raises a visible warning rather than a silent debug log.

## Action markers

A few events carry a plaintext position for the player they name. `ActionsHandler` turns them into one marker per
player, kept 10 seconds. A newer action of the same player replaces its marker. Only players in the players list get
a marker, so in a crowd past `settingMaxPlayersDisplay` the players left out of the list act unseen.

| Source | Code | Position | Family |
|---|---|---|---|
| `CastSpell` | 19 | `[2]`, the target's position | self-cast: presence. On another known player: combat or presence |
| `CastSpells` | 20 | pair i of `[2]` for target i of `[1]` | as `CastSpell` |
| `CastStart` | 14 | `[2]`, only when a target `[7]` is present | as `CastSpell` |
| `ForcedMovement` | 141 | first pair of `[5]`, before the push | mobility |
| `Teleport` | 4 | `[2]` | presence |
| `Respawn` | 88 | `[2]` | presence |
| `Mounted` | 211 | none | turns a self-cast presence marker younger than 2 s into mount |

A cast from a known player on another known player marks the target: combat when either one passes the alert gate
(`isDangerous`) and neither healed the other in the zone, presence otherwise. A cast from a mob, on a mob, on the
ground or on the local player marks nothing, and a cast of the local player is dropped before any rule.

Every index is a named constant:

| Constant | File | Event | Index | Meaning | Pinned by |
|---|---|---|---|---|---|
| `CAST_CASTER` | `ActionsHandler.js` | CastSpell 19, CastSpells 20, CastStart 14 | 0 | caster | `web/scripts/__fixtures__/_actions.test.js`, CastStart caster test |
| `CAST_TARGET` | `ActionsHandler.js` | CastSpell 19; CastSpells 20 (list) | 1 | target | `actions/cast-between-players.json`, `actions/cast-spells.json` |
| `CAST_POSITION` | `ActionsHandler.js` | CastSpell 19, CastStart 14; CastSpells 20 (pairs) | 2 | target position | `actions/self-cast.json`, `actions/cast-spells.json` |
| `CAST_START_TARGET` | `ActionsHandler.js` | CastStart 14 | 7 | target, absent for a ground cast | `actions/cast-start-target.json`, `actions/ground-cast.json` |
| `EVENT_PLAYER` | `ActionsHandler.js` | Teleport 4, Respawn 88, ForcedMovement 141 | 0 | player | `actions/teleport.json`, `actions/respawn.json`, `actions/forced-movement.json` |
| `EVENT_POSITION` | `ActionsHandler.js` | Teleport 4, Respawn 88 | 2 | destination, respawn point | `actions/teleport.json`, `actions/respawn.json` |
| `FORCED_PATH` | `ActionsHandler.js` | ForcedMovement 141 | 5 | path, first pair before the push | `actions/forced-movement.json` |
| `ATTACK_ATTACKER` | `ActionsHandler.js` | Attack 13 | 0 | attacker | `web/scripts/__fixtures__/_actions.test.js`, attack-between-players test |
| `ATTACK_TARGET` | `ActionsHandler.js` | Attack 13 | 2 | target | same, and `actions/mob-attack-on-local.json` |
| `HEALTH_TARGET` | `ActionsHandler.js` | HealthUpdate 6, HealthUpdates 7 | 0 | target | `actions/health-update.json`, `actions/health-updates.json` |
| `HEALTH_CHANGE` | `ActionsHandler.js` | HealthUpdate 6; HealthUpdates 7 (list) | 2 | signed change, absent means 0 | `actions/heal.json`, `actions/attack-between-players.json` |
| `HEALTH_CAUSER` | `ActionsHandler.js` | HealthUpdate 6; HealthUpdates 7 (list, plain or byte array) | 6 | causer, absent means 0 | `actions/health-update.json`, `actions/health-updates.json` |
| `JOIN_LOCAL_ID` | `EventRouter.js` | Join response, operation 2 | 0 | local player id | `router/join-finished.json`, `actions/local-self-cast.json` |

`ActionsDrawing` draws each marker as a diamond in the class colour (hostile `#ef4444`, faction `#3b82f6`, passive
`#22c55e`), the family emoji at its top right (presence ✨, mount 🐎, combat ⚔️, mobility 💨) and `Nickname · 3.4s`
under it. Alpha falls linearly from 1 to 0 over the 10 seconds. The drawing reads the buckets of `getPlayersByType`,
so the class filters and the zone rule apply as in the list. Markers draw only while `settingShowPlayers` and
`settingShowPlayerActions` are both on.

Markers are purged by age every frame (`getMarkers(now)`), removed on `Leave`, and cleared with every handler on a map
change or the clear button. No timer and no listener, so the page teardown has nothing to release.

## Attack flag

The Join response `[0]` gives the local player id. Until one is seen, nothing is flagged. The id is kept in
`sessionStorage` (`localPlayerId`), so a page change keeps it until the next Join response. A Join that happens while
the radar page is closed is never seen, so the saved id can then name another entity. `Move`, `NewCharacter` and
`NewMob` never carry the local id, so one that names it drops the saved id. An entity that neither moves nor spawns
after the return keeps it.

A known player that targets the local player marks nothing on the radar. Three triggers count: a targeted cast, an
auto attack (`Attack` 13, attacker `[0]`, target `[2]`) and damage (`HealthUpdate` 6 or an entry of `HealthUpdates` 7
with a negative change `[2]` and that player as causer `[6]`). When the player passes the alert gate and has not
healed the local player in the zone, `flagAttacker` sets `attackingUntil` 10 seconds ahead. Its card then shows an
`Attacking you` badge next to `Mounted` and a red ring, and moves to the top of its section.

`WebSocketEventQueue` keeps one `HealthUpdate` per target per frame and drops one that follows the last kept within
50 ms, so a heal and a hit that land together reach the handler as one. `HealthUpdates`, `Attack` and the casts are
not throttled.

**Heal memory.** Every `HealthUpdate` or `HealthUpdates` entry with a positive change and a causer other than the
target records the pair of ids. A recorded pair never yields a combat marker or a flag. The heal cast arrives before
its `HealthUpdate`, so recording the pair also lifts the healer's flag on the local player and turns the target's
combat marker from that healer into presence. It keeps a party healer quiet in a black zone, where the zone rule makes
every player dangerous. A support that only buffs is still flagged there.

**List order.** Every marker, mount change and flag sets `lastActionAt`. Each section of the list is ordered by it,
newest first. Players with no action keep their order after them.

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
  lastActionAt: 0,        // last marker, mount change or flag, orders the list
  attackingUntil: 0,      // Date.now() + 10000 at each hit on the local player
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
| `web/scripts/handlers/ActionsHandler.js` | action markers, local id, attack triggers, heal memory |
| `web/scripts/drawings/ActionsDrawing.js` | action markers on the radar |
| `web/scripts/utils/AlertSound.js` | asks the Go process to play the threat sound |
| `internal/audio/player.go` | native playback, one sound at a time |
| `internal/templates/pages/players.gohtml` | settings UI |
| `internal/templates/pages/ignorelist.gohtml` | ignore list management |
| `internal/photon/events.go` | event 29 deserialization |
