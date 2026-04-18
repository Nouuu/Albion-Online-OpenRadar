# EventCodes.js Refresh Design

| Field | Value |
|---|---|
| Status | Active, top of queue (blocker for multiple downstream plans) |
| Created | 2026-04-18 |
| Revised | 2026-04-18 after full upstream diff |
| Priority | Critical (5 production handler paths dead) |
| Depends on | `feat/handlers-characterization` merged (PR #68). ROUTER-2..9 pinned as `test.fails` against real fixture codes. |
| Blocks | `2026-04-18-alerts-and-ignore-list-design.md` (PLAY-2 secondary alert path dead until `ChangeFlaggingFinished` dispatches). Chests, Dungeons, Fishing, Mounted, WispCage features all inoperative in prod until refresh. |
| User action required | No |
| GitHub interaction | Fix lands on `feat/eventcodes-refresh` branch; PR after tests green. |

## Context

Issue #53 and #54 track that `web/scripts/utils/EventCodes.js` is stale against the upstream reference `StatisticsAnalysisTool/Network/EventCodes.cs`. The handlers-characterization work pinned 8 known-broken constants via `test.fails` in `EventRouter.test.js` (ROUTER-2..9).

A full line-by-line diff on 2026-04-18 showed the drift is wider than 8:

- **452 value mismatches** (same name, different value)
- **15 names local-only** (removed or renamed upstream)
- **61 names upstream-only** (added upstream since last sync)

The drift is systemic because the upstream C# enum is positional (auto-incremented from `Unused=0`). New entries inserted upstream shift every downstream value by one. Accumulated shifts of +2 to +5 across the enum from index ~172 to the end.

## Goals

- Converge `EventCodes.js` exactly to the upstream reference (683 entries including `Unused=0`).
- Flip ROUTER-2..9 from `test.fails` to regular `test` with `@verified` label.
- No handler code edits. No router code edits.

## Non goals

- No centralized enum source across frontend and backend (issue #53 proper: larger refactor, out of scope).
- No new handler logic built on the now-working dispatch (belongs in follow-up plans).

## Source of truth

`work/data/AlbionOnline-StatisticsAnalysis/src/StatisticsAnalysisTool/Network/EventCodes.cs` is the local vendored copy. Cross-checked on 2026-04-18 against upstream `https://raw.githubusercontent.com/Triky313/AlbionOnline-StatisticsAnalysis/master/src/StatisticsAnalysisTool/Network/EventCodes.cs`. The vendored copy currently matches upstream for all 683 entries.

## Approach

Approach 3 from the brainstorming phase (Values refresh + dead-code pruning + new additions). Triage of the 15 local-only names:

| Local-only name | Grep result | Decision | Rationale |
|---|---|---|---|
| `DebugMobInfo` (124) | Only in EventCodes.js | Drop | Upstream renamed to `DebugAggroInfo=124`. No consumer references. |
| `DeliverCarriableObjectStart` (331) | Only in EventCodes.js | Drop | Upstream removed. |
| `DeliverCarriableObjectCancel` (332) | Only in EventCodes.js | Drop | Upstream removed. |
| `DeliverCarriableObjectReset` (333) | Only in EventCodes.js | Drop | Upstream removed. |
| `DeliverCarriableObjectFinished` (334) | Only in EventCodes.js | Drop | Upstream removed. |
| `ReceiveCarriableObjectStart` (340) | Only in EventCodes.js | Drop | Upstream removed. |
| `ReceiveCarriableObjectFinished` (341) | Only in EventCodes.js | Drop | Upstream removed. |
| `AlbionJournalAchievementCompleted` (357) | Only in EventCodes.js | Drop | Upstream removed. |
| `AntiCheatKick` (401) | Only in EventCodes.js | Drop | Upstream renamed to `EasyAntiCheatKick`. No consumer references. |
| `RedZoneEventClusterStatus` (470) | Only in EventCodes.js | Drop | Upstream removed. |
| `NewCarriableObject` (479) | Only in EventCodes.js | Drop | Upstream removed. |
| `CarriedObjectUpdate` (481) | Only in EventCodes.js | Drop | Upstream removed. |
| `PickupCarriableObjectStart` (482) | Only in EventCodes.js | Drop | Upstream removed. |
| `PickupCarriableObjectCancel` (483) | Only in EventCodes.js | Drop | Upstream removed. |
| `PickupCarriableObjectFinished` (484) | Only in EventCodes.js | Drop | Upstream removed. |

All 15 are dead. With zero aliases to preserve, Approach 3 converges to the same end-state as Approach 1 (full regeneration): the rewritten file matches upstream exactly. This is the cleanest alignment possible.

## Execution

### Step 1: Regenerate `EventCodes.js` from the upstream list

Replace the body of `web/scripts/utils/EventCodes.js` with all 683 upstream entries (including `Unused=0`). Preserve the `export const EventCodes =` wrapper and single indent style (tab).

### Step 2: Run the Vitest suite

```
npm test
```

Expected: ROUTER-2..9 `test.fails` now fail. The inner assertions pass (codes dispatch correctly), `test.fails` inverts to failure. CI red. This is the signal to flip them.

### Step 3: Flip ROUTER-2..9 `test.fails` to regular `test`

In `web/scripts/core/EventRouter.test.js`, change each of the 8 `test.fails(...)` blocks to regular `test(...)` with the `@verified 2026-04-18: dispatch verified after EventCodes refresh` label.

### Step 4: Update the suspect register

In `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`, remove ROUTER-2..9 entries and update the open count.

### Step 5: Run the suite again

```
npm test
```

Expected: all green. No ROUTER-* `test.fails` remaining.

### Step 6: Run the lint

```
npm run lint
```

Expected: exit 0.

### Step 7: Commits and PR

One-intent-per-commit discipline (Rule 4):

1. `chore(event-codes): align EventCodes.js with upstream StatisticsAnalysis reference`
   (drops 15 unreferenced, updates 452 stale values, adds 61 new, converges to 683 entries)
2. `test(router): flip ROUTER-2..9 test.fails to verified after EventCodes refresh`
3. `docs(coverage): remove ROUTER-2..9 from suspect register`

PR title: `fix(event-codes): refresh EventCodes.js to upstream StatisticsAnalysis (closes #53 #54)`

PR body explains scope correction (8 → 452/15/61) and the triage outcome for the 15 local-only names.

## Files touched

| File | Action |
|---|---|
| `web/scripts/utils/EventCodes.js` | Replace body, converge to 683 upstream entries |
| `web/scripts/core/EventRouter.test.js` | Flip ROUTER-2..9 `test.fails` to regular `test` with verified label |
| `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md` | Remove ROUTER-2..9 from register, update counts |
| `docs/plans/2026-04-18-eventcodes-refresh-design.md` | This file |

## Verification

1. `npm test` green, no remaining ROUTER-* `test.fails` (count drops from 11 to 3, keeping ROUTER-1 isBZ + 2 unrelated).
2. `npm run lint` exit 0.
3. Grep check: no reference to any of the 15 dropped names remains in the repo (outside git history).
4. Diff sanity: `EventCodes.js` has exactly 683 constants (+ export + braces).
5. In a live session, a loot chest spawn now produces a detectable chest on the radar.
6. In a live session, mounting the character shows the mount icon on the local player.
7. In a live session, a faction change (flag toggle) triggers the player-faction alert path when in a PvP zone.

## Risks

- **Upstream drift again**: future Albion patches may shift the enum further. Mitigation: characterization `test.fails` in EventRouter.test.js will pin any handler-path dispatch regression. Periodic `npm test` on a new capture exposes drift.
- **Cascade of bugs revealed by working dispatch**: once Chests, Dungeons, Fishing, Mounted, WispCage come back online, previously masked defects surface (e.g., CHEST-2 rarity loss becomes visible once chests render). Mitigation: already pinned by `test.fails` and scoped by `2026-04-18-small-bug-cluster-design.md`.
- **Stale vendored StatisticsAnalysis**: the local copy at `work/data/AlbionOnline-StatisticsAnalysis/` could lag upstream master. Mitigation: cross-checked on 2026-04-18, matches. Re-run before next refresh.
- **Unseen consumer of a dropped name**: grep was repo-wide, excluding `*.min.json`. If a dynamic lookup constructs names at runtime, it would miss the grep. Mitigation: none of these 15 names have that shape, they are all compile-time references or nothing.

## Handoff

After this plan lands:

- `2026-04-18-alerts-and-ignore-list-design.md` can validate PLAY-2 (#36 ignore list) end-to-end because faction-change now dispatches.
- Chests, Dungeons, Fishing, Mounted, WispCage reappear on the radar. Any handler-level defects revealed are pinned by existing `test.fails` and scoped by the small bug cluster plan.
- Issue #53 can be closed as "value drift fixed, full centralization deferred". A smaller follow-up issue may track centralization if it stays relevant.
