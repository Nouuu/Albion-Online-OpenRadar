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
| HarvestablesHandler | 0 | 0 | 0 | 0 |
| MobsHandler | 0 | 0 | 0 | 0 |
| ChestsHandler | 0 | 0 | 0 | 0 |
| FishingHandler | 0 | 0 | 0 | 0 |
| DungeonsHandler | 0 | 0 | 0 | 0 |
| WispCageHandler | 0 | 0 | 0 | 0 |
| EventRouter | 11 (PR #51) | 0 | 0 | 11 |
| **Total** | **11** | **0** | **0** | **11** |

## Open `@suspect` register

None yet. See `docs/project/IMPROVEMENTS.md` for cross-links.

## Decisions log

- CP1 (T17): scenario catalog ratified against inventory. Local `EventCodes.js` stale versus upstream StatisticsAnalysis; catalog uses upstream values (issues #53, #54 already track this). Fixture corpus committed covers 16 of 19 declared scenarios. Missing: `fishing/finished`, `wispcage/spawn`, `wispcage/opened` (not observable in this capture).
