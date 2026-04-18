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
| MobsHandler | 59 | 3 | 0 | 62 |
| ChestsHandler | 13 | 0 | 0 | 13 |
| FishingHandler | 9 | 0 | 1 | 10 |
| DungeonsHandler | 19 | 0 | 0 | 19 |
| WispCageHandler | 9 | 0 | 0 | 9 |
| EventRouter | 46 | 0 | 1 | 47 |
| **Total** | **238** | **14** | **6** | **258** |

## Open observations register

### #52 tracked as `@characterization` pending ground truth

Issue #52 (living Fiber tier mismatch) is NOT a `test.fails` because direction is unresolved. Server `Parameters[7]` and DB `mob.lt` diverge for Fiber critters only (Hide agrees). Observed on radar vs in-game tooltip per #52 description does not match either value. Resolution requires #58 (typeId debug overlay) to capture the offending entity directly. Until then, two `@characterization` tests in `HarvestablesHandler.test.js` document the divergence between MobsHandler and HarvestablesHandler for mobId=529 and mobId=531.

## Open `test.fails` register

- **HARV-2** (issue #30/#32) HarvestablesHandler e0-gate blocks living Fiber spawned with charges=0; subsequent event 46 enchant update cannot recover the entity. Pinned by `test.fails('issue #30/#32: living Fiber with e0 off appears after event 46 enchant update to e=2')`. After fix: entity should appear when its specific enchant setting is enabled, regardless of e0 at spawn time.
- **PLAY-1** (issue #65) PlayersHandler.handleNewPlayerEvent does not fire alert for hostile in unknown zone. `zonesDatabase.getPvpType(unknown)` falls back to 'safe'; `isPlayerThreat(255, 'safe')` returns false; alert gate skipped. Pinned by `synthetic hostile in unknown zone: alert should fire but does not` in `PlayersHandler.test.js`. Fix lives in `2026-04-18-alerts-and-ignore-list-design.md`.
- **PLAY-2** (issue #36) PlayersHandler.triggerHostileAlert has no ignore-list check. A player in `alreadyIgnoredPlayers` still triggers the sound alert when their faction changes to 255 in a red zone. Pinned by `synthetic PLAY-2: ignored player still triggers alert on faction change in red zone` in `PlayersHandler.test.js`. Fix lives in `2026-04-18-alerts-and-ignore-list-design.md`.
- **ROUTER-1** (issue #57) EventRouter.onResponse opcode 2 (JoinMap) does not extract `isBZ` from `Parameters[103]` hashtable. Post-Protocol18 the field is `{"5": ..., "7": ...}` (non-zero). Current code leaves `map.isBZ` at its prior value. Pinned by `test.fails('ROUTER-1: onResponse JoinMap extracts isBZ from params[103] hashtable')` in `EventRouter.test.js`. Fix design: `2026-04-18-protocol18-regressions-design.md`.

## Decisions log

- CP1 (T17): scenario catalog ratified against inventory. Local `EventCodes.js` stale versus upstream StatisticsAnalysis; catalog uses upstream values (issues #53, #54 already track this). Fixture corpus committed covers 16 of 19 declared scenarios. Missing: `fishing/finished`, `wispcage/spawn`, `wispcage/opened` (not observable in this capture).
- 2026-04-18 EventCodes refresh: `EventCodes.js` aligned to upstream StatisticsAnalysis master fetch. 452 value mismatches updated, 15 unreferenced legacy names dropped (Carriable/Journal/AntiCheat/RedZoneCluster/DebugMobInfo families), 61 new upstream names added. ROUTER-2..9 flipped from `test.fails` to verified. Wisp cage synthetic values corrected: 531/532 (from prior vendored copy) to 530/531 (fresh upstream).
- 2026-04-18 single-source-of-truth migration: `internal/photon/eventcodes` + `internal/photon/operationcodes` Go packages generated from the JS files via `tools/gen-eventcodes`. `photon-dump/scenarios.go` and `internal/photon/events.go` now import from the packages. `EventRouter.js` imports `OperationCodes` for clean-mapping opcodes (2, 22, 41).

## Open ops-drift register (JS literals kept intentionally)

Four call sites still hardcode the numeric code because the upstream name for that value does not match the local handler semantics. Keeping the literal plus a `FIXME ops-drift` comment is more honest than substituting a misleading upstream name. Each needs pcap-backed investigation before substitution.

- **OPS-1** `EventRouter.js onEvent case 590`: upstream `UpdateEnemyWarBannerActive`, local handler logs as `key_sync`. Event, not operation, but same drift class. Dead-looking handler (only logs). Investigate what upstream 590 actually is in current game traffic.
- **OPS-2** `EventRouter.js onRequest Parameters[253] == 21`: pre-Protocol18 Move opcode. Upstream 21 is now `GetShopTilesForCategory`. Kept as legacy fallback alongside the P18 value `OperationCodes.Move = 22`. Verify whether current game traffic still sends 21 as Move.
- **OPS-3** `EventRouter.js onResponse Parameters[253] == 35`: treated as map-change response with debounce. Upstream 35 is `InventoryStack`. Needs pcap response fixture to verify the true opcode behind the map-change path.
- **OPS-4** `EventRouter.js onResponse Parameters[253] == 137`: inline comment says "Character stats response - not currently used". Upstream 137 is `ChangeGuildTax`. Probably dead branch; confirm and remove.
