# Handlers Characterization Coverage

Living counter. Updated on every test commit. Archived at plan completion.

> Suspects are pinned as `test.fails(...)` where the directional claim is unambiguous (CI green = bug still present; CI red = bug fixed, flip to regular `test`). Divergences where correctness is uncertain are kept as `@characterization` observations.

## Distribution target

| Label | Target share |
|---|---|
| `@verified` | 70-80% |
| `@characterization` | 15-20% |
| `test.fails` | 5-10% |

## Counts per handler

| Handler | `@verified` | `@characterization` | `test.fails` | Total |
|---|---:|---:|---:|---:|
| PlayersHandler | 37 | 2 | 2 | 41 |
| HarvestablesHandler | 47 | 7 | 1 | 55 |
| MobsHandler | 63 | 3 | 0 | 66 |
| ChestsHandler | 13 | 0 | 0 | 13 |
| FishingHandler | 9 | 0 | 1 | 10 |
| DungeonsHandler | 26 | 0 | 0 | 26 |
| WispCageHandler | 11 | 0 | 0 | 11 |
| MistsWispDrawing | 8 | 0 | 0 | 8 |
| EventRouter | 44 | 0 | 1 | 45 |
| **Total** | **258** | **12** | **5** | **275** |

## Open observations register

### MIST register (2026-04-19)

- **MIST-1** (issues #66 #69) MobsDrawing mist enchant filter was inverted: checking `settingMistE<n>` skipped the mist instead of rendering it. Fixed in this PR. Root cause of zero visible mist portals when all E0-E4 checkboxes are checked (default UI state). Flipped to `@verified` in `web/scripts/drawings/MobsDrawing.test.js`.
- **MIST-2** (closed 2026-04-23) `Parameters[33]=0` confirmed constant across live feu follet spawns (ignored). Rarity is now extracted from the `MISTS_*_<COLOR>` name suffix via the shared `extractMistsRarity` helper (YELLOW=0, GREEN=1, BLUE=2, PURPLE=3, GOLD=4). Applied in both `MobsHandler.AddMist` and `DungeonsHandler` MISTS branch.
- **MIST-6** (opened and closed 2026-04-23) `DungeonsHandler.parameters[6]` treated universally as `enchant` was wrong: live data shows MISTS_SOLO_YELLOW=2 (constant variant), CORRUPTED_SOLO=37-39 (seed), T5_PORTAL_ROYAL_SOLO=229, T6_UNDEAD=310 — none of these fit the 0-4 enchant range. For MISTS portals, `DungeonsHandler` now adds a dedicated branch that extracts rarity from the name suffix and gates by `settingMistSolo/Duo + settingMistE<rarity>` (decoupled from the standard `settingDungeon*` filters). For non-MISTS dungeons the existing behaviour is preserved; follow-up work (outside mists scope) is needed to untangle `parameters[6]` semantics for T*/CORRUPTED/ROYAL families.
- **MIST-3** (closed 2026-04-23) Runtime evidence confirmed the feu follet lives in `MobsHandler.mistList` (NewMob event 123 with `MISTS_*` name), not in event 523. `MistsWispHandler` was removed along with its test file, fixture (`ws/mists-wisp/spawn.json`), and EventRouter routing for 523. Rendering moved to `MistsWispDrawing` which reads from `MobsHandler.mistList` and applies `settingMistSolo/Duo + settingMistE0..E4 + settingWispSpawnDebugID`. Events 518/519 semantics still unknown (distinct entity, deferred).
- **MIST-4** Multi-repo cross-reference (2026-04-20) against ao-data/albiondata-client (master iota confirms 523/530/531), Triky313/AlbionOnline-StatisticsAnalysis (EventCodes.cs same), and pxlbit228/albion-radar-deatheye-2pc (offsets.json) revealed : (a) rarity for Mists zones lives in the `ChangeCluster` operation response `Parameters[3]` byte array, last byte = MistsRarity index 0-4 (Common/Uncommon/Rare/Epic/Legendary) per Triky313 `ClusterInfo.GetMistsRarity` and `ChangeClusterResponse.cs`. Requires a Mists-zone capture with opcode 41 response to fixture, then plumb into a cluster-level rarity that MistsWispDrawing could consume. (b) deatheye treats `Parameters[5]` on event 530 NewCagedObject as an "already freed" guard (skip when `=="2"`). Our capture-70 fixture has `P[5]=2` on all 3 cages, which may mean those cages were already freed at capture time and the handler adds phantoms. Needs a Mists capture with live+freed cages to resolve.
- **MIST-5** (closed 2026-04-23) Asset question moot after the MIST-3 refactor: feu follets render with `mist_<enchant>.webp` (same bubble images used previously for mist portals), matching the in-game appearance observed by the user. No distinct `wisp_sign.webp` needed; enchant-coloured bubbles are the correct visual.

### #52 tracked as `@characterization` pending ground truth

Issue #52 (living Fiber tier mismatch) is NOT a `test.fails` because direction is unresolved. Server `Parameters[7]` and DB `mob.lt` diverge for Fiber critters only (Hide agrees). Observed on radar vs in-game tooltip per #52 description does not match either value. Resolution requires #58 (typeId debug overlay) to capture the offending entity directly. Until then, two `@characterization` tests in `HarvestablesHandler.test.js` document the divergence between MobsHandler and HarvestablesHandler for mobId=529 and mobId=531.

## Open `test.fails` register

- **HARV-2** (issue #30/#32) HarvestablesHandler e0-gate blocks living Fiber spawned with charges=0; subsequent event 46 enchant update cannot recover the entity. Pinned by `test.fails('issue #30/#32: living Fiber with e0 off appears after event 46 enchant update to e=2')`. After fix: entity should appear when its specific enchant setting is enabled, regardless of e0 at spawn time.
- **PLAY-1** (issue #65) PlayersHandler.handleNewPlayerEvent does not fire alert for hostile in unknown zone. `zonesDatabase.getPvpType(unknown)` falls back to 'safe'; `isPlayerThreat(255, 'safe')` returns false; alert gate skipped. Pinned by `synthetic hostile in unknown zone: alert should fire but does not` in `PlayersHandler.test.js`. Fix lives in `2026-04-18-alerts-and-ignore-list-design.md`.
- **PLAY-2** (issue #36) PlayersHandler.triggerHostileAlert has no ignore-list check. A player in `alreadyIgnoredPlayers` still triggers the sound alert when their faction changes to 255 in a red zone. Pinned by `synthetic PLAY-2: ignored player still triggers alert on faction change in red zone` in `PlayersHandler.test.js`. Fix lives in `2026-04-18-alerts-and-ignore-list-design.md`.
- **ROUTER-1** (issue #57) EventRouter.onResponse opcode 2 (JoinMap) does not extract `isBZ` from `Parameters[103]` hashtable. Post-Protocol18 the field is `{"5": ..., "7": ...}` (non-zero). Current code leaves `map.isBZ` at its prior value. Pinned by `test.fails('ROUTER-1: onResponse JoinMap extracts isBZ from params[103] hashtable')` in `EventRouter.test.js`. Fix design: `2026-04-18-protocol18-regressions-design.md`.

## Decisions log

- 2026-04-19 mists detection restoration. Facet 1 inverts `settingMistE<n>` filter gate in MobsDrawing (1-line fix). Facet 2 corrects WispCageHandler `Parameters[1]/[2]/[4]` indexing per capture-70 evidence and flips the pre-pinned test.fails to `@verified`. Facet 3 adds MistsWispHandler + MistsWispDrawing for event 523 with generic `wisp_sign` marker (no rarity data in events 518/519/523 per pcap corpus). New settings `settingWispSpawn` and `settingWispSpawnDebugID` added to the chests.gohtml Mists panel. Rarity parsing deferred: MIST-2 (portal colour mapping) and MIST-3 (feu follet rarity location) open in the register.
- 2026-04-23 feu follet refactor after runtime evidence. User runtime check showed `mobs.mistList` populated with `MISTS_SOLO_YELLOW` while `mistsWisp.wispList` stayed empty: feu follets arrive via NewMob event 123 (name in `Parameters[31]/[32]`), not event 523. Refactor moves feu follet rendering from `MobsDrawing` to `MistsWispDrawing` reading from `mobs.mistList`, applies `settingMistSolo/Duo + settingMistE0..E4 + settingWispSpawnDebugID`. Deletes `MistsWispHandler` (class + test + fixture + EventRouter 523 routing + Leave fanout entry + Utils wiring). `settingWispSpawn` remains as master on/off gate in `MistsWispDrawing` (early-return when false, overrides all other filters); Solo/Duo + E0..E4 remain as granular filters.
- 2026-04-23 MISTS rarity extraction from name suffix. Evidence from five live MISTS_SOLO_YELLOW spawns showed `Parameters[6]=2` constant (a variant/seed, not rarity) and `Parameters[33]=0` constant on the feu follet side. Shared helper `extractMistsRarity(name)` maps `YELLOW/GREEN/BLUE/PURPLE/GOLD` → `0/1/2/3/4`. `MobsHandler.AddMist` now uses the helper instead of `Parameters[33]`, and `DungeonsHandler` detects `MISTS_*` names in a dedicated branch before `solo/corrupted/hellgate` to route them through `settingMistSolo/Duo + settingMistE<rarity>` and render with the correct `dungeon_<rarity>` or `group_<rarity>` image. Closes MIST-2 and MIST-6.
- CP1 (T17): scenario catalog ratified against inventory. Local `EventCodes.js` stale versus upstream StatisticsAnalysis; catalog uses upstream values (issues #53, #54 already track this). Fixture corpus committed covers 16 of 19 declared scenarios. Missing: `fishing/finished`, `wispcage/spawn`, `wispcage/opened` (not observable in this capture).
- 2026-04-18 EventCodes refresh: `EventCodes.js` aligned to upstream StatisticsAnalysis master fetch. 452 value mismatches updated, 15 unreferenced legacy names dropped (Carriable/Journal/AntiCheat/RedZoneCluster/DebugMobInfo families), 61 new upstream names added. ROUTER-2..9 flipped from `test.fails` to verified. Wisp cage synthetic values corrected: 531/532 (from prior vendored copy) to 530/531 (fresh upstream).
- 2026-04-18 single-source-of-truth migration: `internal/photon/eventcodes` + `internal/photon/operationcodes` Go packages generated from the JS files via `tools/gen-eventcodes`. `photon-dump/scenarios.go` and `internal/photon/events.go` now import from the packages. `EventRouter.js` imports `OperationCodes` for clean-mapping opcodes (2, 22, 41).
- 2026-04-19 capture-70 extraction: added `wispcage/spawn` fixture (WS-level JSON + anonymized pcap fragment). Confirms NewCagedObject=530 in real traffic and exposes WISP-1 handler bug (Parameters[1]/[2]/[4] indexing). Fixing gaps listed in CP1 decisions: `wispcage/spawn` now closed; `fishing/finished` and `wispcage/opened` still not observable (no end-of-fishing events in capture-70, no cage-open events either).

## Open ops-drift register (JS literals kept intentionally)

Four call sites still hardcode the numeric code because the upstream name for that value does not match the local handler semantics. Keeping the literal plus a `FIXME ops-drift` comment is more honest than substituting a misleading upstream name. Each needs pcap-backed investigation before substitution.

- **OPS-1** `EventRouter.js onEvent case 590`: upstream `UpdateEnemyWarBannerActive`, local handler logs as `key_sync`. Event, not operation, but same drift class. Dead-looking handler (only logs). Investigate what upstream 590 actually is in current game traffic.
- **OPS-2** `EventRouter.js onRequest Parameters[253] == 21`: pre-Protocol18 Move opcode. Upstream 21 is now `GetShopTilesForCategory`. Kept as legacy fallback alongside the P18 value `OperationCodes.Move = 22`. Verify whether current game traffic still sends 21 as Move.
- **OPS-3** `EventRouter.js onResponse Parameters[253] == 35`: treated as map-change response with debounce. Upstream 35 is `InventoryStack`. Needs pcap response fixture to verify the true opcode behind the map-change path.
- **OPS-4** `EventRouter.js onResponse Parameters[253] == 137`: inline comment says "Character stats response - not currently used". Upstream 137 is `ChangeGuildTax`. Probably dead branch; confirm and remove.
