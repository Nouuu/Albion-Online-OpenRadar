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
| PlayersHandler | 0 | 0 | 0 | 0 |
| HarvestablesHandler | 42 | 3 | 1 | 46 |
| MobsHandler | 60 | 2 | 0 | 62 |
| ChestsHandler | 0 | 0 | 0 | 0 |
| FishingHandler | 0 | 0 | 0 | 0 |
| DungeonsHandler | 0 | 0 | 0 | 0 |
| WispCageHandler | 0 | 0 | 0 | 0 |
| EventRouter | 11 (PR #51) | 0 | 0 | 11 |
| **Total** | **113** | **5** | **1** | **119** |

## Open `@suspect` register

- **HARV-1** HarvestablesHandler.addHarvestable isLiving gate misses mobileTypeId=-1 sentinel. Current code: `isLiving = mobileTypeId !== null && mobileTypeId !== 65535`. Observed in pcap: static resources arrive with mobileTypeId=-1 (likely int16 decode of 0xFFFF). Effect: static resources routed through MobsDatabase.getResourceInfo(-1) before falling back. Pinned by `pcap-derived: static spawn with mobileTypeId=-1 is currently flagged as living` in `HarvestablesHandler.test.js`. Fix candidate: extend guard to `mobileTypeId !== -1`, or canonicalize in the Go parser.

## Decisions log

- CP1 (T17): scenario catalog ratified against inventory. Local `EventCodes.js` stale versus upstream StatisticsAnalysis; catalog uses upstream values (issues #53, #54 already track this). Fixture corpus committed covers 16 of 19 declared scenarios. Missing: `fishing/finished`, `wispcage/spawn`, `wispcage/opened` (not observable in this capture).
