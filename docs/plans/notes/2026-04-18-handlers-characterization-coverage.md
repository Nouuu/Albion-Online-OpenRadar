# Handlers Characterization Coverage

Living counter. Updated on every test commit. Archived at plan completion.

## Distribution target

| Label | Target share |
|---|---|
| `@verified` | 70-80% |
| `@characterization` | 15-20% |
| `@suspect` | 5-10% |

## Counts per handler

| Handler | `@verified` | `@characterization` | `@suspect` | Total |
|---|---:|---:|---:|---:|
| PlayersHandler | 37 | 2 | 2 | 41 |
| HarvestablesHandler | 42 | 3 | 1 | 46 |
| MobsHandler | 60 | 2 | 0 | 62 |
| ChestsHandler | 0 | 0 | 0 | 0 |
| FishingHandler | 0 | 0 | 0 | 0 |
| DungeonsHandler | 0 | 0 | 0 | 0 |
| WispCageHandler | 0 | 0 | 0 | 0 |
| EventRouter | 11 (PR #51) | 0 | 0 | 11 |
| **Total** | **150** | **7** | **3** | **160** |

## Open `@suspect` register

- **HARV-1** HarvestablesHandler.addHarvestable isLiving gate misses mobileTypeId=-1 sentinel. Current code: `isLiving = mobileTypeId !== null && mobileTypeId !== 65535`. Observed in pcap: static resources arrive with mobileTypeId=-1 (likely int16 decode of 0xFFFF). Effect: static resources routed through MobsDatabase.getResourceInfo(-1) before falling back. Pinned by `pcap-derived: static spawn with mobileTypeId=-1 is currently flagged as living` in `HarvestablesHandler.test.js`. Fix candidate: extend guard to `mobileTypeId !== -1`, or canonicalize in the Go parser.
- **PLAY-1** (issue #65) PlayersHandler.handleNewPlayerEvent does not fire alert for hostile in unknown zone. `zonesDatabase.getPvpType(unknown)` falls back to 'safe'; `isPlayerThreat(255, 'safe')` returns false; alert gate skipped. Pinned by `synthetic hostile in unknown zone: alert should fire but does not` in `PlayersHandler.test.js`. Fix lives in `2026-04-18-alerts-and-ignore-list-design.md`.
- **PLAY-2** (issue #36) PlayersHandler.triggerHostileAlert has no ignore-list check. A player in `alreadyIgnoredPlayers` still triggers the sound alert when their faction changes to 255 in a red zone. Pinned by `synthetic PLAY-2: ignored player still triggers alert on faction change in red zone` in `PlayersHandler.test.js`. Fix lives in `2026-04-18-alerts-and-ignore-list-design.md`.

## Decisions log

- CP1 (T17): scenario catalog ratified against inventory. Local `EventCodes.js` stale versus upstream StatisticsAnalysis; catalog uses upstream values (issues #53, #54 already track this). Fixture corpus committed covers 16 of 19 declared scenarios. Missing: `fishing/finished`, `wispcage/spawn`, `wispcage/opened` (not observable in this capture).
