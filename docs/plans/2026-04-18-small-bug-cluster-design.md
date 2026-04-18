# Small Bug Cluster Design

| Field | Value |
|---|---|
| Status | Active, queued after #53 EventCodes refresh |
| Created | 2026-04-18 |
| Priority | Medium (five unrelated trivial fixes bundled) |
| Depends on | `feat/handlers-characterization` merged (HARV-1, HARV-3, CHEST-1, CHEST-2, FISH-1 pinned as `test.fails`) |
| Blocks | None |
| User action required | No |
| GitHub interaction | One combined PR or individual PRs. |

## Context

The handlers characterization pass surfaced five small bugs, each pinned by a single `test.fails(...)` and each resolvable in one to five lines. Bundled here to avoid five individual plan files.

| Tag | Handler | Issue | One-liner fix |
|---|---|---|---|
| HARV-1 | HarvestablesHandler | new | Extend `isLiving` guard to treat `mobileTypeId === -1` as static. |
| HARV-3 | HarvestablesHandler | new | In `HarvestUpdateEvent` enchant-update path, reuse `harvestable.stringType` and true living flag; remove `const isLiving = false;` hardcode. |
| CHEST-1 | ChestsHandler | new | Guard `Parameters[3]` for undefined before calling `.toLowerCase()`. |
| CHEST-2 | ChestsHandler | #29 root | Persist `Parameters[5]` (rarity) on the Chest entity; drawing-layer color resolution is a follow-up. |
| FISH-1 | FishingHandler | #25 | Replace `!type` falsy guard with `type === null || type === undefined` so empty-string `type=""` is not discarded. |

Each fix flips one `test.fails` from passing (bug present) to failing (bug fixed), prompting the flip to a regular `test(...)`. After the fix-and-flip cycle, five `test.fails` turn into five verified tests.

## Goals

- Apply the five one-liner fixes.
- Flip each pinned `test.fails` to `test` with a `@verified YYYY-MM-DD` label.
- No new features. No refactor. Each fix is its own commit.

## Non goals

- No fix to #29 drawing-layer color resolution (that is downstream once CHEST-2 lands and rarity is available).
- No fix to #52 Fiber tier (blocked on #58 overlay).
- No fix to #30, #32 living enchant e0-gate (covered by the living-harvestables plan).
- No fix to PLAY-1 or PLAY-2 alert paths (covered by the alerts plan).

## Execution

Each subtask is one file, one commit, one test flip.

### Subtask 1: HARV-1 static sentinel

- **File**: `web/scripts/handlers/HarvestablesHandler.js` (around line 165 in `addHarvestable`)
- **Fix**: change `const isLiving = mobileTypeId !== null && mobileTypeId !== 65535;` to also exclude `-1`. Match the Go parser's int16 decode of `0xFFFF`.
  ```javascript
  const isLiving = mobileTypeId != null && mobileTypeId !== 65535 && mobileTypeId !== -1;
  ```
- **Apply same change** in `UpdateHarvestable` (around line 246).
- **Flip**: in `HarvestablesHandler.test.js`, change the HARV-1 `test.fails(...)` to `test(...)` with a `@verified` label.
- **Commit**: `fix(harvestables): treat mobileTypeId=-1 as static (HARV-1)`

### Subtask 2: HARV-3 re-gate logic

- **File**: `web/scripts/handlers/HarvestablesHandler.js`, `HarvestUpdateEvent` around lines 363-378.
- **Fix**: the enchant-update re-gate currently recomputes `stringType` from `harvestable.type` (server typeNumber, not always the resource family) and forces `isLiving = false`. Use the stored values instead:
  ```javascript
  if (enchant !== undefined && enchant !== harvestable.charges) {
      harvestable.charges = enchant;
      const stringType = harvestable.stringType;
      const mobileTypeId = harvestable.mobileTypeId ?? null;
      const isLiving = mobileTypeId != null && mobileTypeId !== 65535 && mobileTypeId !== -1;
      if (!this.shouldDisplayHarvestable(stringType, isLiving, harvestable.tier, enchant)) {
          this.removeHarvestable(id);
      }
  }
  ```
- Requires storing `mobileTypeId` on the Harvestable class (small additional change in the constructor). Update `addHarvestable` to pass it.
- **Flip**: HARV-3 `test.fails` to `test` verified.
- **Commit**: `fix(harvestables): reuse stored stringType and mobileTypeId in enchant re-gate (HARV-3)`

### Subtask 3: CHEST-1 null guard

- **File**: `web/scripts/handlers/ChestsHandler.js`, `addChestEvent` around line 73.
- **Fix**: guard before `.toLowerCase()`:
  ```javascript
  let chestName = Parameters[3];
  if (typeof chestName === 'string' && chestName.toLowerCase().includes('mist')) {
      chestName = Parameters[4];
  }
  ```
- **Flip**: CHEST-1 `test.fails` to `test` verified.
- **Commit**: `fix(chests): guard Parameters[3] type in addChestEvent (CHEST-1)`

### Subtask 4: CHEST-2 persist rarity

- **Files**: `web/scripts/handlers/ChestsHandler.js` (Chest class + `addChest` + `addChestEvent`).
- **Fix**:
  - Add `rarity` parameter to Chest constructor: `constructor(id, posX, posY, name, rarity = null)`.
  - Set `this.rarity = rarity` in the constructor.
  - Propagate through `addChest(id, posX, posY, name, rarity)`.
  - In `addChestEvent`, pass `Parameters[5]` as the rarity argument.
- **Flip**: CHEST-2 `test.fails` to `test` verified.
- **Commit**: `fix(chests): persist rarity from Parameters[5] on Chest entity (CHEST-2, #29 root)`
- Note: #29 as filed concerns the drawing-layer color resolution. This fix only addresses the handler-layer prerequisite (rarity availability). Drawing fix is a follow-up.

### Subtask 5: FISH-1 empty-type guard

- **File**: `web/scripts/handlers/FishingHandler.js`, `newFishEvent` around line 40.
- **Fix**: replace `if (!type) return;` with `if (type === null || type === undefined) return;`.
- **Flip**: FISH-1 `test.fails` to `test` verified.
- **Commit**: `fix(fishing): accept empty-string type for fishpool detection (FISH-1, closes #25)`

### Subtask 6: Update coverage register

Remove HARV-1, HARV-3, CHEST-1, CHEST-2, FISH-1 from the Open `test.fails` register in `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`. Update counts.

Commit: `docs(coverage): remove HARV-1, HARV-3, CHEST-1, CHEST-2, FISH-1 after fix cluster`

## Files touched

| File | Action |
|---|---|
| `web/scripts/handlers/HarvestablesHandler.js` | HARV-1 + HARV-3 guards |
| `web/scripts/handlers/HarvestablesHandler.test.js` | Flip HARV-1, HARV-3 `test.fails` to verified |
| `web/scripts/handlers/ChestsHandler.js` | CHEST-1 guard + CHEST-2 rarity field |
| `web/scripts/handlers/ChestsHandler.test.js` | Flip CHEST-1, CHEST-2 `test.fails` to verified |
| `web/scripts/handlers/FishingHandler.js` | FISH-1 guard |
| `web/scripts/handlers/FishingHandler.test.js` | Flip FISH-1 `test.fails` to verified |
| `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md` | Remove five entries, update counts |

## Verification

1. `npm test` green with zero remaining `test.fails` among the five fixed tags.
2. `npm run lint` exit 0.
3. Each commit is scoped: one handler file plus the corresponding test flip.
4. No regressions on adjacent tests (full suite still green).

## Risks

- **HARV-3 is the largest change** (stores mobileTypeId on the Harvestable class, propagates through two code paths). A second pass may be needed if constructor changes break other tests. Mitigation: run the full HarvestablesHandler test suite after the commit; any broken test surfaces instantly.
- **CHEST-2 alone does not make #29 disappear**. The drawing-layer color bug remains. Mitigation: add a short note at the top of #29 when this lands, separating handler-layer root cause (fixed) from drawing-layer resolution (open).
- **CHEST-2 may expose a fixture gap**: if `Parameters[5]` is not consistently present, add a characterization case. Mitigation: the single pcap chest carries `Parameters[5]=4`; assume present for now, flag if otherwise observed.

## Ordering

Subtasks are independent. Can be executed in any order or in parallel. A single PR containing all six commits is fine.
