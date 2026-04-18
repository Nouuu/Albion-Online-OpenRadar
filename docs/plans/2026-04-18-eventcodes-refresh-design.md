# EventCodes.js Refresh Design

| Field | Value |
|---|---|
| Status | Active, top of queue (blocker for multiple downstream plans) |
| Created | 2026-04-18 |
| Priority | Critical (5 production handler paths dead) |
| Depends on | `feat/handlers-characterization` merged (ROUTER-2 through ROUTER-9 pinned as `test.fails` against real fixture codes) |
| Blocks | `2026-04-18-alerts-and-ignore-list-design.md` (PLAY-2 secondary alert path dead until ChangeFlaggingFinished dispatches). Chests, Dungeons, Fishing, Mounted, WispCage features all inoperative in prod until refresh. |
| User action required | No |
| GitHub interaction | Fix lands on a short-lived branch; a simple PR after merge. |

## Context

Issue #53 and #54 already track that the local `web/scripts/utils/EventCodes.js` enum is stale. The handlers-characterization work on 2026-04-18 quantified the drift: eight late-enum constants diverge from the upstream StatisticsAnalysis reference and from the actual wire values observed in the 2026-04-18 pcap capture. The EventRouter switches on the local stale constants, so the cases never match the real traffic.

Pinned by `test.fails` in `web/scripts/core/EventRouter.test.js`:

| Constant | Local value | Real value | Handler path dead in prod |
|---|---:|---:|---|
| `ChangeFlaggingFinished` | 359 | 363 | `playersHandler.updatePlayerFaction` (feeds PLAY-2 secondary alert) |
| `Mounted` | 209 | 211 | `playersHandler.handleMountedPlayerEvent` (mounted icon) |
| `NewRandomDungeonExit` | 319 | 323 | `dungeonsHandler.dungeonEvent` (dungeon detection) |
| `NewFishingZoneObject` | 355 | 359 | `fishingHandler.newFishEvent` (fishpool detection) |
| `FishingFinished` | 352 | 356 | `fishingHandler.fishingEnd` (fishing cleanup) |
| `NewLootChest` | 387 | 391 | `chestsHandler.addChestEvent` (chest detection) |
| `NewCagedObject` | 525 | 531 | `wispCageHandler.newCageEvent` (wisp cage detection) |
| `CagedObjectStateUpdated` | 526 | 532 | `wispCageHandler.cageOpenedEvent` (wisp cage cleanup) |

## Goals

- Update the eight stale constants to match the upstream reference.
- Flip ROUTER-2 through ROUTER-9 from `test.fails` to regular `test`.
- No behavior change beyond the enum values. No handler edits.

## Non goals

- No centralized enum source across frontend and backend (issue #53 proper: that is a larger refactor, out of scope here).
- No other constant updates beyond the eight confirmed stale. Any other drift gets its own ticket.
- No new features depending on the refreshed dispatch (they belong in follow-up plans).

## Source of truth

`work/data/AlbionOnline-StatisticsAnalysis/src/StatisticsAnalysisTool/Network/EventCodes.cs` is the local vendored copy. Cross-check against the upstream GitHub master branch (`https://raw.githubusercontent.com/Triky313/AlbionOnline-StatisticsAnalysis/master/src/StatisticsAnalysisTool/Network/EventCodes.cs`) to confirm no further drift since the local copy was fetched. If the vendored copy lags upstream for these eight constants, use upstream values.

A throwaway diagnostic already confirmed the eight values on 2026-04-18 against the pcap capture: every fixture message's `Parameters[252]` matches the upstream enum position.

## Execution

### Step 1: Cross-check upstream

Pull the latest upstream StatisticsAnalysis `EventCodes.cs` and enumerate the eight constants. Confirm they match the values in the table above. If any new drift appears, expand the patch to cover it.

### Step 2: Patch `web/scripts/utils/EventCodes.js`

Single edit session updating the eight constants to their real values. No other changes to the file.

### Step 3: Run the Vitest suite

```
npm test
```

Expected: the eight ROUTER-* `test.fails` now fail (the inner assertion passes, `test.fails` inverts to failure). The CI becomes red. This is the signal to flip them.

### Step 4: Flip `test.fails` to `test`

In `web/scripts/core/EventRouter.test.js`, change each of the eight affected `test.fails(...)` blocks to regular `test(...)` with a `@verified 2026-<date>: dispatch verified after EventCodes refresh` label. Remove the ROUTER-2 through ROUTER-9 entries from the open suspect register in `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`.

### Step 5: Run the suite again

```
npm test
```

Expected: all green. No more `test.fails` for dispatch codes.

### Step 6: Commit and PR

Commit messages:
- `fix(event-codes): refresh 8 stale constants to match upstream StatisticsAnalysis (#53)`
- `test(router): flip ROUTER-2..9 from test.fails to verified after EventCodes refresh`
- `docs(coverage): remove ROUTER-2..9 from suspect register`

Single PR: `fix(event-codes): refresh stale Protocol18 enum values (closes #53)`.

Note that this does not close #53 in its full scope (centralized enum source across frontend and backend). The close should reference "partial fix for the stale-values symptom; full centralization deferred". Adjust the issue title or open a follow-up before closing.

## Files touched

| File | Action |
|---|---|
| `web/scripts/utils/EventCodes.js` | Update eight constant values |
| `web/scripts/core/EventRouter.test.js` | Flip ROUTER-2..9 `test.fails` to regular `test` with verified label |
| `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md` | Remove ROUTER-2..9 from register, update counts |

## Verification

1. `npm test` green, no remaining ROUTER-* `test.fails`.
2. `npm run lint` exit 0.
3. Quick diff review on `EventCodes.js` confirms only eight lines changed.
4. In a live session, a loot chest spawn now produces a detectable chest on the radar (cross-check with a chest-rich zone).
5. In a live session, mounting the character shows the mount icon on the local player.
6. In a live session, a faction change (flag toggle) triggers the player-faction alert path when in a PvP zone.

## Risks

- **Upstream drift again**: if a future Albion patch shifts the enum, this plan must be re-run. Mitigation: add a periodic check to `make update-ao-data` or rely on the test suite to reveal new drift via future captures.
- **Cascade of bugs revealed by working dispatch**: once the five handler paths come back online, previously masked bugs may surface (e.g., CHEST-2 rarity loss becomes visible once chests render). Mitigation: the small bug cluster plan covers those.
- **Stale vendored StatisticsAnalysis**: the local copy at `work/data/AlbionOnline-StatisticsAnalysis/` may itself lag upstream. Always cross-check upstream before patching.

## Handoff

After this plan lands:

- `2026-04-18-alerts-and-ignore-list-design.md` can validate PLAY-2 (ignore list) end-to-end because faction-change now dispatches.
- Chests, Dungeons, Fishing, Mounted, WispCage reappear on the radar. Any handler-level defects revealed (e.g., CHEST-2 rarity) are pinned by `test.fails` and scoped by the small bug cluster plan.
- Issue #53 remains open in its full scope (centralized enum source). A smaller PR may close a partial-fix issue if filed separately.
