# Living Harvestables Bug Fix Design

## Status 2026-04-18

Both bugs pinned as `test.fails` in `web/scripts/handlers/HarvestablesHandler.test.js` after handlers-characterization merged:

- **HARV-2** pins #30 and #32 (e0-gate blocks enchanted living spawn recovery).
- **HARV-3** pins the re-gate logic bug in `HarvestUpdateEvent` (`isLiving=false` hardcoded, wrong `stringType` lookup).

HARV-3 is routed through `2026-04-18-small-bug-cluster-design.md` as a one-liner. This plan focuses on HARV-2 (the e0-gate spawn recovery), which is the deeper structural change.

## Problem

Living harvestables (animals like pigs, cows) require e0 enabled to show enchanted resources (e1-e4), even when e0 is disabled and e1+ are enabled.

**Issues:** #30, #32

## Root Cause

Two bugs in `HarvestablesHandler.js`:

### Bug 1: Event 46 hardcodes `isLiving = false`

```javascript
// Line 374 - WRONG
const isLiving = false;

if (!this.shouldDisplayHarvestable(stringType, isLiving, harvestable.tier, enchant)) {
    this.removeHarvestable(id);
}
```

When Event 46 updates the enchantment, it always uses Static settings instead of Living settings.

### Bug 2: Initial spawn filtering

Living resources spawn with `charges=0` (Event 40), then receive real enchantment via Event 46. If e0 is disabled for Living, the resource is filtered out before Event 46 arrives.

## Solution

### Change 1: Add `isLiving` to Harvestable class

```javascript
class Harvestable {
    constructor(id, type, tier, posX, posY, charges, size, stringType = null, isLiving = false) {
        // ... existing properties
        this.isLiving = isLiving;
    }
}
```

### Change 2: Pass `isLiving` when creating Harvestable

In `addHarvestable()` (line 220):
```javascript
const h = new Harvestable(id, type, tier, posX, posY, charges, size, stringType, isLiving);
```

In `UpdateHarvestable()` (line 304):
```javascript
const h = new Harvestable(id, type, tier, posX, posY, charges, size, stringType, isLiving);
```

### Change 3: Fix Event 46 to use stored `isLiving`

```javascript
// Line 373-374 - FIXED
const stringType = harvestable.stringType || this.GetStringType(harvestable.type);
const isLiving = harvestable.isLiving;

if (!this.shouldDisplayHarvestable(stringType, isLiving, harvestable.tier, enchant)) {
    this.removeHarvestable(id);
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `web/scripts/handlers/HarvestablesHandler.js` | Add `isLiving` param, fix Event 46 |

## Test Plan

1. Start app, go to Resources page
2. For a Living resource type (e.g., Hide):
   - Disable e0 for Living
   - Enable e1+ for Living
3. Enter a zone with living harvestables
4. Verify: enchanted living resources (e1+) should appear
5. Verify: e0 living resources should NOT appear

## Acceptance Criteria

- [ ] Living harvestables with e1-e4 appear when e0 is disabled
- [ ] Static harvestables behavior unchanged
- [ ] No regressions in resource filtering
