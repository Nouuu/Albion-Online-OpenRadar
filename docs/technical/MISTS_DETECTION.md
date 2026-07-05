# Mists Detection

How OpenRadar detects portals, feu follets (wisp signs), and wisp cages in the Mists biome.

*Last verified against code: 2026-07-05 (post 2026-06-29 patch, event codes shifted by +2).*

## Detection surface

The Mists has three radar-visible facets. All three are reached via the existing event pipeline. No event code is dedicated to feu follets in the way one might expect from naming.

| Facet | Source event | Handler path | Drawing |
|---|---|---|---|
| Mist portal (open) | `EventCodes.NewMob` (123) with `MISTS_<TYPE>_<COLOR>` name | `MobsHandler.NewMobEvent` -> `AddMist` -> `mobs.mistList` | `MobsDrawing.invalidate` (portal) and `MistsWispDrawing.invalidate` (feu follet view) |
| Wisp cage (interior) | `EventCodes.NewCagedObject` (532) | `WispCageHandler.newCageEvent` | `WispCageDrawing.invalidate` |
| Feu follet (pre-portal) | Same as portal: NewMob 123 with `MISTS_<TYPE>_<COLOR>` name | `MobsHandler.mistList` (shared) | `MistsWispDrawing.invalidate` reads `mobs.mistList` |

Feu follets and open portals share the same backing store. The visual difference is rendered by two separate Drawings reading the same list.

## Portal naming and rarity

Portal names follow the pattern `MISTS_<TYPE>_<COLOR>`:

- `<TYPE>` is one of `SOLO`, `DUO`.
- `<COLOR>` is the PvP zone tag: `YELLOW`, `GREEN`, `BLUE`, `PURPLE`, `RED`. **It is not the rarity.**

`MobsHandler.AddMist` reads the rarity from `Parameters[33]` and stores it as `mist.enchant`. Values 0 to 4 map to Common, Uncommon, Rare, Epic, Legendary. Live evidence from a "Peu commun" YELLOW portal confirmed the path on 2026-04-23 (green `mist_1` icon). Settings gate uses `settingMistE<enchant>`.

Pre-patch captures also carried the rarity in `Parameters[8]` (evidence behind the PR #78 dungeon enchant fix). Since the 2026-06-29 patch, `Parameters[8]` on portal NewMob events holds an `[x, y]` position instead (2026-07-05 capture, typeId 116). Only Common portals (`Parameters[33]=0`) were observed post-patch, so the rarity slot still needs confirmation against a non-Common portal.

## Feu follet rendering

`MistsWispDrawing.invalidate` iterates `mobs.mistList` and gates each entry through:

1. `settingWispSpawn` master toggle (early return when off).
2. `settingMistSolo` or `settingMistDuo` based on the portal type substring.
3. `settingMistE<rarity>` based on `mist.enchant`.
4. `settingWispSpawnDebugID` (optional overlay of the entity id for live capture work).

The image is `mist_<enchant>.webp`. The drawing reuses the portal asset rather than a dedicated `wisp_sign.webp`.

## Wisp cage indexing

`WispCageHandler.newCageEvent` maps the parameters as follows (re-verified against the 2026-07-05 capture, 9 occurrences of event 532):

| Parameter | Meaning |
|---|---|
| `Parameters[0]` | entity id |
| `Parameters[2]` | `[x, y]` position |
| `Parameters[4]` | cage name string (e.g. `SHARED_FILL_CAGE_WISP_MOR_A`) |
| `Parameters[5]` | int (1 on every live cage observed) |

The pre-patch `Parameters[1]` scalar is no longer present.

`Parameters[5]==2` may indicate an "already freed" cage that should be skipped at handler time. The current handler does not implement this check; it remains an open observation pending a Mists capture with both live and freed cages. Reference: deatheye-2pc treats `Parameters[5]=="2"` as a guard.

## Mists instance map identifier

When a player enters the Mists, the cluster id arrives via `Event 521 MistsPlayerJoinedInfo`:

- `Parameters[2]` = cluster id (`@MISTS@<guid>` for Mists, `0212` for the Royal origin state).
- `Parameters[3]` = `true` for Mists entries.
- `Parameters[4]` = origin Royal cluster id.

`EventRouter.onEvent` routes 521 and applies the map change (with `originCluster` metadata). `Event 520 NewMistsImmediateReturnExit` fires on ImmediateReturn exits and matches the op `MistsUseImmediateReturnExit` responses observed in browser logs; 520, 522 and 531 remain unrouted.

## Reference event codes

| Code | Symbol | Status |
|---|---|---|
| 123 | NewMob | Routed. Handles portals, mob spawns, feu follets via name suffix. |
| 532 | NewCagedObject | Routed. Wisp cages. |
| 533 | CagedObjectStateUpdated | Routed. Cage opened. |
| 521 | MistsPlayerJoinedInfo | Routed. Mists entry signal; applies the map change with origin cluster. |
| 520 | NewMistsImmediateReturnExit | Not routed. Mists exit signal. |
| 522 | NewMistsStaticEntrance | Not routed. |
| 531 | MistsEntranceDataChanged | Not routed. |
| 525 | NewMistsWispSpawn | Not routed. Initial design assumed this carried feu follets; runtime evidence (re-confirmed post-patch on 2026-07-05, feu follets detected live via NewMob name) shows otherwise. Payload observed x22 in the 2026-07-05 Mists capture: `Parameters[0]` id, `Parameters[1]` `[x, y]`, `Parameters[2]` in {90, 180, 270} (likely an orientation), no rarity field. Out of scope until live evidence clarifies its semantics. |

## Open observations

- Mists rarity at the cluster level (instance-wide, before portals appear) lives in the `ChangeCluster` operation response `Parameters[3]` byte array, last byte. Reaching it requires plumbing a Mists-zone capture with opcode 41 response into a fixture and a cluster-level rarity store.
- Events 520/522/525/531 are received but not consumed. A follow-up PR should route them into a Mists state surface readable by drawings.
- Post-patch portal rarity: only Common portals observed so far. A capture with a non-Common portal is needed to confirm `Parameters[33]` still carries the rarity.
