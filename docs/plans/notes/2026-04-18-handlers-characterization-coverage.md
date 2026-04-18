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
| HarvestablesHandler | 43 | 7 | 3 | 53 |
| MobsHandler | 60 | 2 | 0 | 62 |
| ChestsHandler | 10 | 0 | 1 | 11 |
| FishingHandler | 8 | 0 | 2 | 10 |
| DungeonsHandler | 19 | 0 | 0 | 19 |
| WispCageHandler | 9 | 0 | 0 | 9 |
| EventRouter | 36 | 12 | 1 | 49 |
| **Total** | **222** | **25** | **9** | **254** |

## Open `test.fails` register

- **HARV-1** HarvestablesHandler.addHarvestable isLiving gate misses mobileTypeId=-1 sentinel. Current code: `isLiving = mobileTypeId !== null && mobileTypeId !== 65535`. Observed in pcap: static resources arrive with mobileTypeId=-1 (likely int16 decode of 0xFFFF). Effect: static resources routed through MobsDatabase.getResourceInfo(-1) before falling back. Pinned by `test.fails('pcap-derived single-spawn: static with mobileTypeId=-1 does not trigger mobsDatabase lookup')` in `HarvestablesHandler.test.js`. Fix candidate: extend guard to `mobileTypeId !== -1`, or canonicalize in the Go parser.
- **HARV-2** (issue #30/#32) HarvestablesHandler e0-gate blocks living Fiber spawned with charges=0; subsequent event 46 enchant update cannot recover the entity. Pinned by `test.fails('issue #30/#32: living Fiber with e0 off appears after event 46 enchant update to e=2')`. After fix: entity should appear when its specific enchant setting is enabled, regardless of e0 at spawn time.
- **HARV-3** HarvestUpdateEvent re-gate uses `isLiving=false` hardcoded and `GetStringType(harvestable.type)` with static typeNumber. Living Fiber critter (typeNumber=16) resolves to HIDE, so re-gate checks static Hide settings. Entity is removed when all static settings are disabled. Pinned by `test.fails('HarvestUpdateEvent preserves living Fiber when static settings are all disabled')`. After fix: re-gate should use the stored stringType and isLiving flag, not recompute them from typeNumber.
- **PLAY-1** (issue #65) PlayersHandler.handleNewPlayerEvent does not fire alert for hostile in unknown zone. `zonesDatabase.getPvpType(unknown)` falls back to 'safe'; `isPlayerThreat(255, 'safe')` returns false; alert gate skipped. Pinned by `synthetic hostile in unknown zone: alert should fire but does not` in `PlayersHandler.test.js`. Fix lives in `2026-04-18-alerts-and-ignore-list-design.md`.
- **PLAY-2** (issue #36) PlayersHandler.triggerHostileAlert has no ignore-list check. A player in `alreadyIgnoredPlayers` still triggers the sound alert when their faction changes to 255 in a red zone. Pinned by `synthetic PLAY-2: ignored player still triggers alert on faction change in red zone` in `PlayersHandler.test.js`. Fix lives in `2026-04-18-alerts-and-ignore-list-design.md`.
- **CHEST-1** ChestsHandler.addChestEvent assumes Parameters[3] is always a string; crashes with TypeError when undefined. Pinned by `synthetic: addChestEvent with Parameters[3]=undefined throws TypeError` in `ChestsHandler.test.js`.
- **FISH-1** (issue #25) FishingHandler.newFishEvent drops events where Parameters[4] is an empty string `""` because `!type` treats `""` as falsy. In the pcap corpus 3 of 5 spawn events carry `type=""` with valid coordinates and are silently discarded. Likely root of fishpool not showing. Pinned by `pcap-derived spawn: entries with type="" are dropped by !type guard` in `FishingHandler.test.js`. Fix candidate: replace `!type` with `type === null || type === undefined`.

- **ROUTER-1** (issue #57) EventRouter.onResponse opcode 2 (JoinMap) does not extract `isBZ` from `Parameters[103]` hashtable. Post-Protocol18 the field is `{"5": ..., "7": ...}` (non-zero). Current code leaves `map.isBZ` at its prior value. Pinned by `@suspect ROUTER-1: isBZ not derived from params[103] hashtable in JoinMap response` in `EventRouter.test.js`. Fix design: `2026-04-18-protocol18-regressions-design.md`.

## Decisions log

- CP1 (T17): scenario catalog ratified against inventory. Local `EventCodes.js` stale versus upstream StatisticsAnalysis; catalog uses upstream values (issues #53, #54 already track this). Fixture corpus committed covers 16 of 19 declared scenarios. Missing: `fishing/finished`, `wispcage/spawn`, `wispcage/opened` (not observable in this capture).
