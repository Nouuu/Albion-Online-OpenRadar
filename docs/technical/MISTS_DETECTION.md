# Mists Detection

How OpenRadar detects portals, feu follets (wisp signs), and wisp cages in the Mists biome.

*Last verified against code: 2026-05-01.*

## Detection surface

The Mists has three radar-visible facets. All three are reached via the existing event pipeline. No event code is dedicated to feu follets in the way one might expect from naming.

| Facet | Source event | Handler path | Drawing |
|---|---|---|---|
| Mist portal (open) | `EventCodes.NewMob` (123) with `MISTS_<TYPE>_<COLOR>` name | `MobsHandler.NewMobEvent` -> `AddMist` -> `mobs.mistList` | `MobsDrawing.invalidate` (portal) and `MistsWispDrawing.invalidate` (feu follet view) |
| Wisp cage (interior) | `EventCodes.NewCagedObject` (530) | `WispCageHandler.newCageEvent` | `WispCageDrawing.invalidate` |
| Feu follet (pre-portal) | Same as portal: NewMob 123 with `MISTS_<TYPE>_<COLOR>` name | `MobsHandler.mistList` (shared) | `MistsWispDrawing.invalidate` reads `mobs.mistList` |

Feu follets and open portals share the same backing store. The visual difference is rendered by two separate Drawings reading the same list.

## Portal naming and rarity

Portal names follow the pattern `MISTS_<TYPE>_<COLOR>`:

- `<TYPE>` is one of `SOLO`, `DUO`.
- `<COLOR>` is the PvP zone tag: `YELLOW`, `GREEN`, `BLUE`, `PURPLE`, `RED`. **It is not the rarity.**

Rarity is carried in `Parameters[8]` on the NewMob event for Mists. Values 0 to 4 map to Common, Uncommon, Rare, Epic, Legendary. Live evidence from a "Peu commun" YELLOW portal confirmed `Parameters[8]=1`. The same `Parameters[8]` slot is used for non-Mists dungeons (e.g. T6_MORGANA), which is why the dungeon enchant fix that came with PR #78 unblocked every group dungeon family at the same time.

`MobsHandler.AddMist` stores the rarity as `mist.enchant`. Settings gate uses `settingMistE<enchant>`.

## Feu follet rendering

`MistsWispDrawing.invalidate` iterates `mobs.mistList` and gates each entry through:

1. `settingWispSpawn` master toggle (early return when off).
2. `settingMistSolo` or `settingMistDuo` based on the portal type substring.
3. `settingMistE<rarity>` based on `mist.enchant`.
4. `settingWispSpawnDebugID` (optional overlay of the entity id for live capture work).

The image is `mist_<enchant>.webp`. The drawing reuses the portal asset rather than a dedicated `wisp_sign.webp`.

## Wisp cage indexing

`WispCageHandler.newCageEvent` maps the parameters as follows (verified against capture-70 corpus, 13 occurrences of event 530):

| Parameter | Meaning |
|---|---|
| `Parameters[0]` | entity id |
| `Parameters[1]` | scalar int (ignored) |
| `Parameters[2]` | `[x, y]` position |
| `Parameters[4]` | cage name string |
| `Parameters[5]` | int |

`Parameters[5]==2` may indicate an "already freed" cage that should be skipped at handler time. The current handler does not implement this check; it remains an open observation pending a Mists capture with both live and freed cages. Reference: deatheye-2pc treats `Parameters[5]=="2"` as a guard.

## Mists instance map identifier

When a player enters the Mists, the cluster id arrives via `Event 519 MistsPlayerJoinedInfo`:

- `Parameters[2]` = cluster id (`@MISTS@<guid>` for Mists, `0212` for the Royal origin state).
- `Parameters[3]` = `true` for Mists entries.
- `Parameters[4]` = origin Royal cluster id.

`Event 518 NewMistsImmediateReturnExit` fires on ImmediateReturn exits and matches the op 472 `MistsUseImmediateReturnExit` responses observed in browser logs.

`EventRouter.onEvent` does not yet have cases for 518, 519, 520, or 529. The Mists instance identifier reaches the frontend payload but no handler consumes it. Resolving this requires a downstream change to map cluster id to readable zone metadata.

## Reference event codes

| Code | Symbol | Status |
|---|---|---|
| 123 | NewMob | Routed. Handles portals, mob spawns, feu follets via name suffix. |
| 530 | NewCagedObject | Routed. Wisp cages. |
| 518 | NewMistsImmediateReturnExit | Not routed. Mists exit signal. |
| 519 | MistsPlayerJoinedInfo | Not routed. Mists entry signal with cluster id. |
| 520 | NewMistsStaticEntrance | Not routed. |
| 529 | MistsEntranceDataChanged | Not routed. |
| 523 | NewMistsWispSpawn | Not routed. Initial design assumed this carried feu follets; runtime evidence showed feu follets arrive via NewMob 123 instead. The 523 stream is a separate spawn class with no rarity field in the captured corpus. Out of scope until live evidence clarifies its semantics. |

## Open observations

- Mists rarity at the cluster level (instance-wide, before portals appear) lives in the `ChangeCluster` operation response `Parameters[3]` byte array, last byte. Reaching it requires plumbing a Mists-zone capture with opcode 41 response into a fixture and a cluster-level rarity store.
- Events 518/519/520/529 are received but not consumed. A follow-up PR should route them into a Mists state surface readable by drawings.
