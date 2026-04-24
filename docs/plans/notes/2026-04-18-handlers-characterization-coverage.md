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
| PlayersHandler | 37 | 2 | 0 | 41 |
| HarvestablesHandler | 56 | 4 | 0 | 60 |
| MobsHandler | 77 | 1 | 0 | 78 |
| ChestsHandler | 13 | 0 | 0 | 13 |
| FishingHandler | 10 | 0 | 0 | 10 |
| DungeonsHandler | 28 | 0 | 0 | 28 |
| WispCageHandler | 11 | 0 | 0 | 11 |
| MistsWispDrawing | 9 | 0 | 0 | 9 |
| EventRouter | 49 | 3 | 1 | 53 |
| **Total** | **290** | **10** | **1** | **303** |

## Open observations register

### MIST register (2026-04-19)

- **MIST-1** (issues #66 #69) MobsDrawing mist enchant filter was inverted: checking `settingMistE<n>` skipped the mist instead of rendering it. Fixed in this PR. Root cause of zero visible mist portals when all E0-E4 checkboxes are checked (default UI state). Flipped to `@verified` in `web/scripts/drawings/MobsDrawing.test.js`.
- **MIST-2** (reopened 2026-04-23) User live check on a "Peu commun" MISTS_SOLO_YELLOW feu follet confirmed MobsHandler path already renders the correct mist_1 (green) image, so `Parameters[33]` does carry the rarity at live time even though every pcap fixture sample is Common (0). No MobsHandler fix needed; the first `extractMistsRarity` attempt (colour-suffix mapping) was based on a false reading and has been reverted.
- **MIST-6** (closed 2026-04-23) Dungeon enchant source corrected from `Parameters[6]` (a dungeon type/variant id: 2 for MISTS_SOLO_YELLOW, 37-39 for CORRUPTED, 229 for T5_PORTAL_ROYAL_SOLO, 276 for T6_KEEPER, 310 for T6_UNDEAD, 327 for T6_MORGANA) to `Parameters[8]` (universal enchant 0-4). Live evidence: MISTS_SOLO_YELLOW with Parameters[8]=0 matched the in-game "Commun" tooltip, Parameters[8]=1 matched "Peu commun"; T6_MORGANA with Parameters[8]=2 correctly maps to an E2 dungeon. Side benefit: this unblocks every non-MISTS group dungeon (T6_MORGANA/T6_UNDEAD/T6_KEEPER/T5_PORTAL_ROYAL_SOLO) which was silently filtered out because `settingDungeonE<big-number>` never exists. The MISTS-specific branch in `DungeonsHandler.addDungeon` is still needed to route MISTS portals through the Mists settings (`settingMistSolo/Duo + settingMistE<enchant>`) instead of the Dungeon settings.
- **MIST-3** (closed 2026-04-23) Runtime evidence confirmed the feu follet lives in `MobsHandler.mistList` (NewMob event 123 with `MISTS_*` name), not in event 523. `MistsWispHandler` was removed along with its test file, fixture (`ws/mists-wisp/spawn.json`), and EventRouter routing for 523. Rendering moved to `MistsWispDrawing` which reads from `MobsHandler.mistList` and applies `settingMistSolo/Duo + settingMistE0..E4 + settingWispSpawnDebugID`. Events 518/519 semantics still unknown (distinct entity, deferred).
- **MIST-4** Multi-repo cross-reference (2026-04-20) against ao-data/albiondata-client (master iota confirms 523/530/531), Triky313/AlbionOnline-StatisticsAnalysis (EventCodes.cs same), and pxlbit228/albion-radar-deatheye-2pc (offsets.json) revealed : (a) rarity for Mists zones lives in the `ChangeCluster` operation response `Parameters[3]` byte array, last byte = MistsRarity index 0-4 (Common/Uncommon/Rare/Epic/Legendary) per Triky313 `ClusterInfo.GetMistsRarity` and `ChangeClusterResponse.cs`. Requires a Mists-zone capture with opcode 41 response to fixture, then plumb into a cluster-level rarity that MistsWispDrawing could consume. (b) deatheye treats `Parameters[5]` on event 530 NewCagedObject as an "already freed" guard (skip when `=="2"`). Our capture-70 fixture has `P[5]=2` on all 3 cages, which may mean those cages were already freed at capture time and the handler adds phantoms. Needs a Mists capture with live+freed cages to resolve.
- **MIST-5** (closed 2026-04-23) Asset question moot after the MIST-3 refactor: feu follets render with `mist_<enchant>.webp` (same bubble images used previously for mist portals), matching the in-game appearance observed by the user. No distinct `wisp_sign.webp` needed; enchant-coloured bubbles are the correct visual.
- **MIST-7** (opened 2026-04-23) Mists instance map not detected. Live diagnostic logs showed `EventRouter.onResponse` never receives an op 2 Join nor an op 41 ChangeCluster when entering a Mists (confirmed across several entries at 23:36-23:42 in a fresh session). Extracting events from `capture_78.pcap` with a temporary scenario bump revealed:
    - Event 519 `MistsPlayerJoinedInfo` fires on every Mists entry: `Parameters[2]` = cluster id (`"@MISTS@<guid>"` for Mists, `"0212"` for Royal origin state), `Parameters[3]=true` for Mists entries, `Parameters[4]` = origin Royal cluster.
    - Event 518 `NewMistsImmediateReturnExit` fires on ImmediateReturn exits. Matches the op 472 `MistsUseImmediateReturnExit` responses observed in the live browser logs.
    - `EventRouter.onEvent` has no case for 518, 519, 520 (`NewMistsStaticEntrance`) or 529 (`MistsEntranceDataChanged`). The Mists instance identifier reaches the frontend but nothing consumes it.
    Out of scope for PR #78 (detection layer). Follow-up PR required. Extraction done with `photon-dump` + ad-hoc scenarios for codes 518/519/520/529 over `capture_78.pcap` (not committed as fixture yet).

### CHEST register (2026-04-23)

- **CHEST-1** (issue #29 reopened) `ChestsHandler.addChestEvent` reads `Parameters[5]` as rarity but the observed values do not match the upstream `lootchests.xml` rarity range (-1 to 3, standard=0/uncommon=1/rare=2/legendary=3). Runtime evidence:

    | Chest name | Parameters[5] | Parameters[23] | paramCount |
    |---|---:|---:|---:|
    | `MISTS_GREEN_LOOTCHEST_TREASURE_MOBCAMP_02` (chestId 2149) | 4 | 4 | 18 |
    | `MISTS_GREEN_LOOTCHEST_TREASURE_MOBCAMP_02` (chestId 1955) | 4 | 4 | 18 |
    | `SWAMP_RED_LOOTCHEST_DYNAMIC_CAMP_KEEPER_SMALL` (fixture) | 4 | 4 | 18 |
    | `LOOTCHEST_FACTIONWARFARE_SMALL` (chestId 238706) | 8 | 8 | 23 |

    Parameters[5] varies by chest family (4 for dungeon/mists-treasure, 8 for FactionWarfare) and never lands in 0-3. FACTION chests carry extra fields that the other families do not: `Parameters[8]` Buffer (416 bytes, probably loot table), `Parameters[13]` future timestamp (despawn?), `Parameters[16]=200000` (silver value?), `Parameters[15]=1.5295` float (multiplier?).

    Additionally, `ChestsDrawing.invalidate` does not consume the stored rarity at all. It branches on substring matches in `chestName` (`green`/`blue`/`rare`/`legendary`). For MISTS chests the substring `GREEN` is the PvP zone tag (same confusion resolved in MIST-6 for mist portals), not the rarity. Two bugs stacked: a rarity field read from the wrong parameter AND a drawing that ignores the field.

    Next step: pcap capture covering the four rarity levels across the main chest families (Mists, Avalon, FactionWarfare, open world dungeon) to identify the real rarity parameter index. Out of scope for PR #78.

## Open `test.fails` register

- **PLAY-1** (issue #65) PlayersHandler.handleNewPlayerEvent does not fire alert for hostile in unknown zone. `zonesDatabase.getPvpType(unknown)` falls back to 'safe'; `isPlayerThreat(255, 'safe')` returns false; alert gate skipped. Pinned by `synthetic hostile in unknown zone: alert should fire but does not` in `PlayersHandler.test.js`. Fix lives in `2026-04-18-alerts-and-ignore-list-design.md`.
- **PLAY-2** (issue #36) PlayersHandler.triggerHostileAlert has no ignore-list check. A player in `alreadyIgnoredPlayers` still triggers the sound alert when their faction changes to 255 in a red zone. Pinned by `synthetic PLAY-2: ignored player still triggers alert on faction change in red zone` in `PlayersHandler.test.js`. Fix lives in `2026-04-18-alerts-and-ignore-list-design.md`.
- **ROUTER-1** (issue #57) EventRouter.onResponse opcode 2 (JoinMap) does not extract `isBZ` from `Parameters[103]` hashtable. Post-Protocol18 the field is `{"5": ..., "7": ...}` (non-zero). Current code leaves `map.isBZ` at its prior value. Pinned by `test.fails('ROUTER-1: onResponse JoinMap extracts isBZ from params[103] hashtable')` in `EventRouter.test.js`. Fix design: `2026-04-18-protocol18-regressions-design.md`.

## Decisions log

- 2026-04-19 mists detection restoration. Facet 1 inverts `settingMistE<n>` filter gate in MobsDrawing (1-line fix). Facet 2 corrects WispCageHandler `Parameters[1]/[2]/[4]` indexing per capture-70 evidence and flips the pre-pinned test.fails to `@verified`. Facet 3 adds MistsWispHandler + MistsWispDrawing for event 523 with generic `wisp_sign` marker (no rarity data in events 518/519/523 per pcap corpus). New settings `settingWispSpawn` and `settingWispSpawnDebugID` added to the chests.gohtml Mists panel. Rarity parsing deferred: MIST-2 (portal colour mapping) and MIST-3 (feu follet rarity location) open in the register.
- 2026-04-23 feu follet refactor after runtime evidence. User runtime check showed `mobs.mistList` populated with `MISTS_SOLO_YELLOW` while `mistsWisp.wispList` stayed empty: feu follets arrive via NewMob event 123 (name in `Parameters[31]/[32]`), not event 523. Refactor moves feu follet rendering from `MobsDrawing` to `MistsWispDrawing` reading from `mobs.mistList`, applies `settingMistSolo/Duo + settingMistE0..E4 + settingWispSpawnDebugID`. Deletes `MistsWispHandler` (class + test + fixture + EventRouter 523 routing + Leave fanout entry + Utils wiring). `settingWispSpawn` remains as master on/off gate in `MistsWispDrawing` (early-return when false, overrides all other filters); Solo/Duo + E0..E4 remain as granular filters.
- 2026-04-23 MISTS rarity extraction (first attempt, reverted). First read of the evidence pushed the theory that the colour suffix (`_YELLOW/_GREEN/...`) encoded the rarity. A later live log on a Peu commun MISTS_SOLO_YELLOW (still `_YELLOW`, `Parameters[8]=1`) refuted that: the suffix is the PvP zone type, not the rarity. The `extractMistsRarity` helper and its usage in MobsHandler/DungeonsHandler have been removed.
- 2026-04-23 Dungeon enchant source corrected to Parameters[8]. Live logs across seven dungeon name families showed Parameters[6] is a type/variant id outside the 0-4 enchant range (2/37-39/229/276/310/327) while Parameters[8] consistently matches the rarity/enchant (0-4) both for MISTS (matching the in-game tooltip) and for non-MISTS dungeons (T6_MORGANA with Parameters[8]=2 = group_2). `DungeonsHandler.dungeonEvent` now reads `Parameters[8]` as enchant for every dungeon family. The MISTS-specific branch in `addDungeon` is preserved to route MISTS portals through `settingMistSolo/Duo + settingMistE<enchant>` (Mists UI settings) instead of `settingDungeon*`. This fix also unblocks the silent filter-out of every non-MISTS group dungeon (Morgana/Keeper/Undead/Royal Solo) that had been hidden because `settingDungeonE229/276/310/327` never exists.
- CP1 (T17): scenario catalog ratified against inventory. Local `EventCodes.js` stale versus upstream StatisticsAnalysis; catalog uses upstream values (issues #53, #54 already track this). Fixture corpus committed covers 16 of 19 declared scenarios. Missing: `fishing/finished`, `wispcage/spawn`, `wispcage/opened` (not observable in this capture).
- 2026-04-18 EventCodes refresh: `EventCodes.js` aligned to upstream StatisticsAnalysis master fetch. 452 value mismatches updated, 15 unreferenced legacy names dropped (Carriable/Journal/AntiCheat/RedZoneCluster/DebugMobInfo families), 61 new upstream names added. ROUTER-2..9 flipped from `test.fails` to verified. Wisp cage synthetic values corrected: 531/532 (from prior vendored copy) to 530/531 (fresh upstream).
- 2026-04-18 single-source-of-truth migration: `internal/photon/eventcodes` + `internal/photon/operationcodes` Go packages generated from the JS files via `tools/gen-eventcodes`. `photon-dump/scenarios.go` and `internal/photon/events.go` now import from the packages. `EventRouter.js` imports `OperationCodes` for clean-mapping opcodes (2, 22, 41).
- 2026-04-19 capture-70 extraction: added `wispcage/spawn` fixture (WS-level JSON + anonymized pcap fragment). Confirms NewCagedObject=530 in real traffic and exposes WISP-1 handler bug (Parameters[1]/[2]/[4] indexing). Fixing gaps listed in CP1 decisions: `wispcage/spawn` now closed; `fishing/finished` and `wispcage/opened` still not observable (no end-of-fishing events in capture-70, no cage-open events either).
- 2026-04-19 #32 living resource enchant filter moved from spawn to render time. MobsHandler and HarvestablesHandler no longer drop living resources at spawn when the user has the corresponding e<n>[tier-1] setting off. Pure function `shouldRenderLivingResource` in `web/scripts/utils/LivingResourceFilter.js` is called by `MobsDrawing.invalidate` and `HarvestablesDrawing.invalidate` to filter per-frame. Dead scaffolding `MobsHandler.harvestablesNotGood` removed (4 reads, 0 writes). HARV-2 closed. Issues #30 and #32 resolved. Superseded design doc `2026-01-15-living-harvestables-fix-design.md` moved to `docs/archive/completed-plans/`.
- 2026-04-19 #52 living resource tier mismatch resolved. Root-cause investigation on capture-70 showed server `Parameters[7]` in event 40 (NewHarvestableObject) matches the game tooltip exactly for all 9 observed living resource cases. Upstream `@tier` in `mobs.json` is the combat tier, distinct from the harvest tier the game displays. Derived rule: for LIVING non-DYNAMIC/non-DEAD mobs, `harvest_tier = max(min_tier[Loot.Harvestable.@type], combat_tier - 1)`. For DYNAMIC and DEAD variants, preserve combat tier. Implemented as pure function `getLivingHarvestTier` in `web/scripts/utils/LivingResourceTier.js` with hardcoded 20-entry min-tier map, wired into `MobsHandler.AddEnemy` via adapter. 20 unit tests + 7 MobsHandler integration tests + 2 flipped HarvestablesHandler convergence tests (mobIds 529, 531 now agree across both handlers). Fixes #52.
- 2026-04-24 #32 taxonomy extension. HARV-3: DEAD critter carcasses (uniqueName matches `/_DEAD$/`) were gated by `settingLiving{Family}Enchants` which surfaced the moment the user had Living e0 off and Static e0 on. HARV-4: Hide carcasses and batch-spawn harvestables in harvestableList had no render-time filter (mobileTypeId!=null entries were early-returned as always-visible, mobileTypeId=null was filtered at spawn). Unified under "any static physical object on the map uses Static filter" principle. `LivingResourceFilter.js` gained `shouldRenderStaticResource` and a shared `resolveSettingsCell`. `Mob.uniqueName` is now propagated from dbInfo. `MobsDrawing.invalidate` picks static when `/_DEAD$/` matches. `HarvestablesHandler` lost its spawn-time filter (`shouldDisplayHarvestable` helper and call sites removed). `HarvestablesDrawing.invalidate` always applies static. +33 tests across LivingResourceFilter, MobsHandler, MobsDrawing, HarvestablesHandler, HarvestablesDrawing. Closes HARV-3 and HARV-4.

## Open ops-drift register (JS literals kept intentionally)

Four call sites still hardcode the numeric code because the upstream name for that value does not match the local handler semantics. Keeping the literal plus a `FIXME ops-drift` comment is more honest than substituting a misleading upstream name. Each needs pcap-backed investigation before substitution.

- **OPS-1** `EventRouter.js onEvent case 590`: upstream `UpdateEnemyWarBannerActive`, local handler logs as `key_sync`. Event, not operation, but same drift class. Dead-looking handler (only logs). Investigate what upstream 590 actually is in current game traffic.
- **OPS-2** `EventRouter.js onRequest Parameters[253] == 21`: pre-Protocol18 Move opcode. Upstream 21 is now `GetShopTilesForCategory`. Kept as legacy fallback alongside the P18 value `OperationCodes.Move = 22`. Verify whether current game traffic still sends 21 as Move.
- **OPS-3** `EventRouter.js onResponse Parameters[253] == 35`: treated as map-change response with debounce. Upstream 35 is `InventoryStack`. Needs pcap response fixture to verify the true opcode behind the map-change path.
- **OPS-4** `EventRouter.js onResponse Parameters[253] == 137`: inline comment says "Character stats response - not currently used". Upstream 137 is `ChangeGuildTax`. Probably dead branch; confirm and remove.
