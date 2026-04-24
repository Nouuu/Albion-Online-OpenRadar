# #32 Living resource enchant filter at render time Implementation Plan

> **Status 2026-04-24:** implementation complete on `feat/32-living-enchant-render-filter` (PR #82). The amended design in `2026-04-19-32-living-enchant-render-filter-design.md` is the source of truth for the final routing rule (DEAD carcass routes through Living, not Static, per user live-test). Moves to `docs/archive/completed-plans/` when PR #82 merges.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issue #32 (living resources require e0 on to show enchanted variants) by moving the enchant/tier filter from spawn-time to render-time.

**Architecture:** Pure function `shouldRenderLivingResource(entity, getSetting)` consumed by `MobsDrawing.invalidate` and `HarvestablesDrawing.invalidate`. Handlers stop dropping living resources at spawn, allowing subsequent enchant updates to land correctly in-memory. Static path unchanged.

**Tech Stack:** Vanilla JavaScript ES modules, Vitest 4 + happy-dom, real DBs via `installRealDatabasesOnWindow`.

**Spec:** `docs/plans/2026-04-19-32-living-enchant-render-filter-design.md`.

---

## Amendment 2026-04-24 : expanded scope HARV-3 + HARV-4

Live smoke surfaced two sibling defects. Scope grew by six tasks that share the same branch.

### Additional files

- `web/scripts/utils/LivingResourceFilter.js` : add `shouldRenderStaticResource` and shared `resolveSettingsCell`.
- `web/scripts/utils/LivingResourceFilter.test.js` : +11 tests for the static variant.
- `web/scripts/handlers/MobsHandler.js` : `mob.uniqueName` propagation in both AddEnemy branches.
- `web/scripts/handlers/MobsHandler.test.js` : HARV-3 describe block (4 tests) covering DEAD/live critter/DYNAMIC Hide/hostile.
- `web/scripts/drawings/MobsDrawing.js` : pick `shouldRenderStaticResource` when `mob.uniqueName` matches `/_DEAD$/`.
- `web/scripts/drawings/MobsDrawing.test.js` : +5 tests for the DEAD routing.
- `web/scripts/handlers/HarvestablesHandler.js` : drop `shouldDisplayHarvestable` helper and both call sites; drop `settingsSync` and `getResourceStorageKey` imports.
- `web/scripts/handlers/HarvestablesHandler.test.js` : flip the "settings off blocks spawn" test, add HARV-4 trio (carcass, batch, UpdateHarvestable).
- `web/scripts/drawings/HarvestablesDrawing.js` : drop `isLiving` branch, always call `shouldRenderStaticResource`.
- `web/scripts/drawings/HarvestablesDrawing.test.js` : rewritten suite, 14 tests including pcap-derived Hide toad mobileTypeId=424.

### Expected outcome

`npm test` green, +33 tests on top of the original #32 coverage, no new characterization entries. User-facing behaviour: checking `settingStatic{Family}Enchants` gates any map-static entity (true static resource, batch-spawn sentinel, Hide carcass, DEAD critter carcass). Living settings gate only alive moving mobs. Checkbox toggles are instant, no spawn re-detection required.

---

## File structure

### Create
- `web/scripts/utils/LivingResourceFilter.js` : pure function `shouldRenderLivingResource`
- `web/scripts/utils/LivingResourceFilter.test.js` : 15 unit tests
- `web/scripts/drawings/MobsDrawing.test.js` : 5 drawing-level tests covering the render-time filter

### Modify
- `web/scripts/handlers/MobsHandler.js` : remove filter block at lines 252-268, remove dead `harvestablesNotGood` references
- `web/scripts/handlers/MobsHandler.test.js` : add 3 regression tests, remove any existing test that asserted the filter dropped mobs
- `web/scripts/handlers/HarvestablesHandler.js` : add `isLiving` early-return in `shouldDisplayHarvestable`, remove post-update filter call in `HarvestUpdateEvent`
- `web/scripts/handlers/HarvestablesHandler.test.js` : flip HARV-2 `test.fails` to `@verified`, add 1 regression test
- `web/scripts/drawings/MobsDrawing.js` : add render-time filter call at top of `invalidate` loop
- `web/scripts/drawings/HarvestablesDrawing.js` : same for living harvestables
- `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md` : close HARV-2, bump counts, add decision entry

### Archive
- `docs/plans/2026-01-15-living-harvestables-fix-design.md` : move to `docs/archive/completed-plans/` (only partial solution, superseded by this PR)

---

## Task 1: LivingResourceFilter pure function (TDD)

**Files:**
- Create: `web/scripts/utils/LivingResourceFilter.js`
- Test: `web/scripts/utils/LivingResourceFilter.test.js`

- [ ] **Step 1: Write the failing test file**

Create `web/scripts/utils/LivingResourceFilter.test.js` verbatim:

```javascript
import {describe, test, expect} from 'vitest';
import {shouldRenderLivingResource} from './LivingResourceFilter.js';

function strictSettings(map) {
    return key => map[key] ?? null;
}

function allTrueForFamily(family) {
    const key = {Fiber: 'settingLivingFiberEnchants', Hide: 'settingLivingHideEnchants', Log: 'settingLivingWoodEnchants', Ore: 'settingLivingOreEnchants', Rock: 'settingLivingRockEnchants'}[family];
    return {
        [key]: {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)},
    };
}

describe('shouldRenderLivingResource', () => {
    test('Fiber T5 e2 returns true when settings e2 T5 is on', () => {
        const settings = {settingLivingFiberEnchants: {e2: [false, false, false, false, true, false, false, false]}};
        expect(shouldRenderLivingResource({name: 'Fiber', tier: 5, enchantmentLevel: 2}, strictSettings(settings))).toBe(true);
    });

    test('Hide T4 e0 returns false when settings e0 T4 is off', () => {
        const settings = {settingLivingHideEnchants: {e0: [true, true, true, false, true, true, true, true]}};
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: 0}, strictSettings(settings))).toBe(false);
    });

    test('Log (wood) T4 e3 resolves via settingLivingWoodEnchants key', () => {
        const settings = {settingLivingWoodEnchants: {e3: [false, false, false, true, false, false, false, false]}};
        expect(shouldRenderLivingResource({name: 'Log', tier: 4, enchantmentLevel: 3}, strictSettings(settings))).toBe(true);
    });

    test('Ore T6 e4 returns true', () => {
        expect(shouldRenderLivingResource({name: 'Ore', tier: 6, enchantmentLevel: 4}, strictSettings(allTrueForFamily('Ore')))).toBe(true);
    });

    test('Rock T3 e0 returns true', () => {
        expect(shouldRenderLivingResource({name: 'Rock', tier: 3, enchantmentLevel: 0}, strictSettings(allTrueForFamily('Rock')))).toBe(true);
    });

    test('charges fallback for HarvestablesHandler entities without enchantmentLevel', () => {
        const settings = {settingLivingFiberEnchants: {e2: [false, false, false, true, false, false, false, false]}};
        expect(shouldRenderLivingResource({name: 'Fiber', tier: 4, charges: 2}, strictSettings(settings))).toBe(true);
    });

    test('enchantmentLevel takes precedence over charges if both present', () => {
        const settings = {settingLivingFiberEnchants: {e1: Array(8).fill(true), e2: Array(8).fill(false)}};
        expect(shouldRenderLivingResource({name: 'Fiber', tier: 4, charges: 2, enchantmentLevel: 1}, strictSettings(settings))).toBe(true);
    });

    test('null entity returns false', () => {
        expect(shouldRenderLivingResource(null, strictSettings({}))).toBe(false);
    });

    test('entity without name returns false', () => {
        expect(shouldRenderLivingResource({tier: 4, enchantmentLevel: 2}, strictSettings({}))).toBe(false);
    });

    test('entity with unknown name returns false', () => {
        expect(shouldRenderLivingResource({name: 'Silver', tier: 4, enchantmentLevel: 2}, strictSettings({}))).toBe(false);
    });

    test('tier 0 returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 0, enchantmentLevel: 0}, strictSettings(allTrueForFamily('Hide')))).toBe(false);
    });

    test('tier 9 (out of range) returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 9, enchantmentLevel: 0}, strictSettings(allTrueForFamily('Hide')))).toBe(false);
    });

    test('enchantment 5 (out of range) returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: 5}, strictSettings(allTrueForFamily('Hide')))).toBe(false);
    });

    test('negative enchantment returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: -1}, strictSettings(allTrueForFamily('Hide')))).toBe(false);
    });

    test('getSetting returns null returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: 2}, () => null)).toBe(false);
    });

    test('settings object missing e{n} key returns false', () => {
        const settings = {settingLivingHideEnchants: {e0: Array(8).fill(true)}};
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: 2}, strictSettings(settings))).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run web/scripts/utils/LivingResourceFilter.test.js`
Expected: FAIL with module-not-found or all 16 tests fail.

- [ ] **Step 3: Implement the pure function**

Create `web/scripts/utils/LivingResourceFilter.js`:

```javascript
const LIVING_SETTINGS_KEY_BY_NAME = {
    Fiber: 'settingLivingFiberEnchants',
    Hide: 'settingLivingHideEnchants',
    Log: 'settingLivingWoodEnchants',
    Ore: 'settingLivingOreEnchants',
    Rock: 'settingLivingRockEnchants',
};

export function shouldRenderLivingResource(entity, getSetting) {
    if (!entity) return false;
    const tier = entity.tier ?? 0;
    if (tier < 1 || tier > 8) return false;
    const enchant = entity.enchantmentLevel ?? entity.charges ?? 0;
    if (enchant < 0 || enchant > 4) return false;
    const key = LIVING_SETTINGS_KEY_BY_NAME[entity.name];
    if (!key) return false;
    const settings = getSetting(key);
    return settings?.[`e${enchant}`]?.[tier - 1] === true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run web/scripts/utils/LivingResourceFilter.test.js`
Expected: 16 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/scripts/utils/LivingResourceFilter.js web/scripts/utils/LivingResourceFilter.test.js
git commit -m "feat(32): shouldRenderLivingResource pure function for render-time filter

Resolves settings key from entity.name (Fiber, Hide, Log, Ore, Rock),
checks settings[e<enchant>][tier-1] with out-of-range guards. Accepts
both entity.enchantmentLevel (MobsHandler) and entity.charges
(HarvestablesHandler) via fallback. Returns false on any missing input,
no throws.

Used by MobsDrawing.invalidate and HarvestablesDrawing.invalidate to
filter living resources at render time instead of spawn time, fixing #32."
```

---

## Task 2: MobsHandler remove spawn filter + dead scaffolding (TDD)

**Files:**
- Modify: `web/scripts/handlers/MobsHandler.js`
- Modify: `web/scripts/handlers/MobsHandler.test.js`

### 2.1 Write failing regression tests (RED)

- [ ] **Step 1: Append regression tests to MobsHandler.test.js**

Find the `describe('NewMobEvent (event 123)', ...)` block. After the last `test.each` coverage block, before the closing `});` of the describe, append:

```javascript

        // -------------------------------------------------------------------------
        // HARV-2 / issue #32 : enchant filter moved from spawn to render
        // -------------------------------------------------------------------------

        // @verified 2026-04-19: mob spawn with enchant=0 must add to mobsList even if user has e0 disabled.
        // Before fix: filter at spawn dropped the mob, updateEnchantEvent could not recover it.
        test('HARV-2: living Hide mob spawns with enchant=0 into mobsList regardless of settings', () => {
            const e0OffSettings = {
                e0: Array(8).fill(false),
                e1: Array(8).fill(true),
                e2: Array(8).fill(true),
                e3: Array(8).fill(true),
                e4: Array(8).fill(true),
            };
            settingsSync.getJSON.mockReturnValue(e0OffSettings);
            const p = normalizeParams({'0': 91000, '1': 373, '2': 255, '7': [0, 0], '13': 1000, '33': 0});

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].typeId).toBe(373);
            expect(mobs[0].enchantmentLevel).toBe(0);
        });

        // @verified 2026-04-19: updateEnchantEvent mutates enchant on existing mob, entity survives spawn-filter gap.
        test('HARV-2: updateEnchantEvent mutates enchantmentLevel on mob already in mobsList', () => {
            settingsSync.getJSON.mockReturnValue({e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)});
            const spawnParams = normalizeParams({'0': 91500, '1': 373, '2': 255, '7': [0, 0], '13': 1000, '33': 0});
            handler.NewMobEvent(spawnParams);
            expect(handler.getMobList()).toHaveLength(1);

            handler.updateEnchantEvent({0: 91500, 1: 2});

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].enchantmentLevel).toBe(2);
        });

        // @verified 2026-04-19: spawn-then-update sequence survives when user has only e2 checked.
        // This is the real-world scenario issue #32 describes.
        test('HARV-2: spawn e0 + user e0=off + update to e2 yields mob with e=2 in mobsList', () => {
            const e0OffOnlyE2On = {
                e0: Array(8).fill(false),
                e1: Array(8).fill(false),
                e2: Array(8).fill(true),
                e3: Array(8).fill(false),
                e4: Array(8).fill(false),
            };
            settingsSync.getJSON.mockReturnValue(e0OffOnlyE2On);
            const spawnParams = normalizeParams({'0': 92000, '1': 373, '2': 255, '7': [0, 0], '13': 1000, '33': 0});
            handler.NewMobEvent(spawnParams);

            handler.updateEnchantEvent({0: 92000, 1: 2});

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].enchantmentLevel).toBe(2);
            expect(mobs[0].tier).toBe(4);
        });
```

- [ ] **Step 2: Run tests to verify failures**

Run: `npx vitest run web/scripts/handlers/MobsHandler.test.js -t "HARV-2"`
Expected: 3 tests fail. First test fails with `Expected length: 1, Received length: 0` because the filter currently drops the mob at spawn.

### 2.2 Apply the fix (GREEN)

- [ ] **Step 3: Remove the filter block in MobsHandler.js**

In `web/scripts/handlers/MobsHandler.js`, find lines 252-268:

```javascript
        // Filter living resources based on user settings
        if (mob.type === EnemyType.LivingHarvestable || mob.type === EnemyType.LivingSkinnable) {
            if (mob.tier > 0 && mob.name) {
                const resourceType = mob.name;
                let prefix;
                if (resourceType === 'Fiber' || resourceType === 'fiber') prefix = 'fsp';
                else if (resourceType === 'Hide' || resourceType === 'hide') prefix = 'hsp';
                else if (resourceType === 'Log' || resourceType === 'Wood' || resourceType === 'Logs') prefix = 'wsp';
                else if (resourceType === 'Ore' || resourceType === 'ore') prefix = 'osp';
                else if (resourceType === 'Rock' || resourceType === 'rock') prefix = 'rsp';
                const settingKey = getResourceStorageKey(prefix, 'Living');

                if (!settingsSync.getJSON(settingKey)?.[`e${mob.enchantmentLevel}`][mob.tier - 1]) {
                    return;
                }
            }
        }
```

Delete the entire block. Also remove the now-unused import `getResourceStorageKey` if it is only used in this block. Run:
```
grep -n "getResourceStorageKey" web/scripts/handlers/MobsHandler.js
```
If only one reference remains (the import line), remove that import line too.

- [ ] **Step 4: Remove dead `harvestablesNotGood` references**

In `web/scripts/handlers/MobsHandler.js`, remove these specific lines:

Line 89 (constructor): `this.harvestablesNotGood = [];`

Line 174 (dedup check): `if (this.harvestablesNotGood.some(m => m.id === id)) return;`

Line 313 (removal filter): `this.harvestablesNotGood = this.harvestablesNotGood.filter(x => x.id !== id);`

Line 338 (updateEnchantEvent find): `|| this.harvestablesNotGood.find(m => m.id === mobId)` : change this line from:
```javascript
const found = this.mobsList.find(m => m.id === mobId) || this.harvestablesNotGood.find(m => m.id === mobId);
```
To:
```javascript
const found = this.mobsList.find(m => m.id === mobId);
```

Line 511 (Clear method): `this.harvestablesNotGood = [];`

Verify cleanup:
```
grep -n "harvestablesNotGood" web/scripts/handlers/MobsHandler.js
```
Expected: zero matches.

- [ ] **Step 5: Run the test file, verify GREEN**

Run: `npx vitest run web/scripts/handlers/MobsHandler.test.js`
Expected: ALL tests pass. The 3 new HARV-2 tests green. The existing 131 tests including the T1-T8 grid still green.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: 395+ passing, 3 expected failures. The living resource T1-T8 grid continues to pass because `allTrueSettings` covers all settings keys.

- [ ] **Step 7: Commit**

```bash
git add web/scripts/handlers/MobsHandler.js web/scripts/handlers/MobsHandler.test.js
git commit -m "fix(32): stop dropping living mobs at spawn based on enchant filter

MobsHandler.AddEnemy previously filtered LivingHarvestable/LivingSkinnable
mobs at spawn based on settings[e<enchant>][tier-1]. Because mobs spawn
with Parameters[33]=0 and only later receive enchant updates via
updateEnchantEvent, the filter dropped the entity before the update
could arrive. No path recovered it.

Removed the filter block entirely (MobsDrawing.invalidate will apply it
at render time in the next task). Removed the dead scaffolding
harvestablesNotGood (declared in 4 places, never written). Added 3
regression tests exercising the spawn + update flow with a strict
settings mock.

Fixes the first half of #32. Drawing-side filter lands in the next
commit."
```

---

## Task 3: HarvestablesHandler remove living spawn filter + event 46 remove gate (TDD)

**Files:**
- Modify: `web/scripts/handlers/HarvestablesHandler.js`
- Modify: `web/scripts/handlers/HarvestablesHandler.test.js`

### 3.1 Write failing regression tests (RED)

- [ ] **Step 1: Append regression tests to HarvestablesHandler.test.js**

Find a describe block covering `newHarvestableObject` or create a new `describe('HARV-2 living spawn + update', ...)` block inside the main handler describe. Append these tests:

```javascript
    describe('HARV-2 living spawn + update (issue #32)', () => {
        // @verified 2026-04-19: living harvestable spawns with charges=0 and user has e0 off for living.
        // Before fix: shouldDisplayHarvestable dropped it at spawn.
        test('living fiber spawn with charges=0 is kept in list even when e0 setting is off', async () => {
            settingsSync.getJSON.mockImplementation(key => {
                if (key === 'settingLivingFiberEnchants') {
                    return {e0: Array(8).fill(false), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
                }
                return {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
            });

            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 531);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);
            p[11] = 0;

            handler.newHarvestableObject(p[0], p);

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].charges).toBe(0);
        });

        // @verified 2026-04-19: HarvestUpdateEvent (event 46) mutates charges in place for enchant updates,
        // does not remove the entity based on the new enchant setting.
        test('HarvestUpdateEvent mutates charges without removing entity when setting for new enchant is off', async () => {
            settingsSync.getJSON.mockReturnValue({e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)});
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 531);
            const p = normalizeParams(msg.parameters);
            p[11] = 0;
            handler.newHarvestableObject(p[0], p);
            expect(handler.getHarvestableList()).toHaveLength(1);

            settingsSync.getJSON.mockReturnValue({e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(false), e3: Array(8).fill(true), e4: Array(8).fill(true)});

            handler.HarvestUpdateEvent({0: p[0], 1: 5, 2: 2});

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].charges).toBe(2);
        });
    });
```

- [ ] **Step 2: Flip existing HARV-2 test.fails to @verified**

Search for `test.fails('issue #30/#32:` in `HarvestablesHandler.test.js`. Change `test.fails(` to `test(` and change the preceding `@characterization` or related comment to `@verified 2026-04-19:`. If the test body still contains a `.toBe(false)` or similar assertion that asserted the buggy filter behaviour, update it to assert the fixed behaviour.

If the exact existing test is:
```javascript
test.fails('issue #30/#32: living Fiber with e0 off appears after event 46 enchant update to e=2', async () => {
    // ... body that expects the entity to appear after e=2 update
});
```

Change to:
```javascript
// @verified 2026-04-19: living Fiber with e0 off appears after event 46 enchant update to e=2 (#32 fix).
test('living Fiber with e0 off appears after event 46 enchant update to e=2', async () => {
    // ... same body
});
```

If the body needs adjustment to match the new behaviour, keep the setup, update the expectation to `.toBe(1)` / `.toBe(true)`.

- [ ] **Step 3: Run the test file, verify new tests FAIL on current code**

Run: `npx vitest run web/scripts/handlers/HarvestablesHandler.test.js`
Expected: The 2 new HARV-2 tests and the flipped test.fails fail. They fail because the current code drops living resources at spawn when charges=0 and the setting is off.

### 3.2 Apply the fix (GREEN)

- [ ] **Step 4: Add isLiving early-return in `shouldDisplayHarvestable`**

In `web/scripts/handlers/HarvestablesHandler.js`, find `shouldDisplayHarvestable` starting at line 89:

```javascript
    shouldDisplayHarvestable(stringType, isLiving, tier, charges) {
        // Map resource type to settings key suffix
        const settingsMap = {
```

Insert right after the opening brace, before `const settingsMap`:

```javascript
    shouldDisplayHarvestable(stringType, isLiving, tier, charges) {
        if (isLiving) return true;
        // Map resource type to settings key suffix
        const settingsMap = {
```

This makes the spawn path of `UpdateHarvestable` and `addHarvestable` always admit living resources. Static path behaviour is unchanged.

- [ ] **Step 5: Remove the post-update removal in `HarvestUpdateEvent`**

In `web/scripts/handlers/HarvestablesHandler.js`, find `HarvestUpdateEvent` around line 321. Inside this method, locate the block:

```javascript
        // Update enchantment if provided and different
        if (enchant !== undefined && enchant !== harvestable.charges) {
            window.logger?.info(CATEGORIES.HARVESTABLES, 'Event46_EnchantmentUpdate', {
                id,
                oldEnchant: harvestable.charges,
                newEnchant: enchant
            });
            harvestable.charges = enchant;

            const stringType = harvestable.stringType;
            const mobileTypeId = harvestable.mobileTypeId;
            const isLiving = mobileTypeId !== null && mobileTypeId !== undefined
                && mobileTypeId !== 65535 && mobileTypeId !== -1;

            if (!this.shouldDisplayHarvestable(stringType, isLiving, harvestable.tier, enchant)) {
                this.removeHarvestable(id);
            }
        }
```

Replace with:

```javascript
        // Update enchantment if provided and different (filter applied at render, not here)
        if (enchant !== undefined && enchant !== harvestable.charges) {
            window.logger?.info(CATEGORIES.HARVESTABLES, 'Event46_EnchantmentUpdate', {
                id,
                oldEnchant: harvestable.charges,
                newEnchant: enchant
            });
            harvestable.charges = enchant;
        }
```

The entity is no longer removed based on the new enchant value. Rendering decides whether to display it.

- [ ] **Step 6: Run the test file, verify GREEN**

Run: `npx vitest run web/scripts/handlers/HarvestablesHandler.test.js`
Expected: ALL tests pass. The 2 new HARV-2 tests and the flipped HARV-2 test are green.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: green, no regressions.

- [ ] **Step 8: Commit**

```bash
git add web/scripts/handlers/HarvestablesHandler.js web/scripts/handlers/HarvestablesHandler.test.js
git commit -m "fix(32): keep living harvestables in list across spawn and enchant updates

shouldDisplayHarvestable now returns true immediately for living
resources (mobileTypeId > 0). Static path unchanged. Removed the
post-enchant-update removal block in HarvestUpdateEvent that dropped
the entity whenever the new enchant setting was off.

Rendering filter is applied by HarvestablesDrawing.invalidate in the
next task.

Flipped HARV-2 test.fails to @verified. Added 2 regression tests with
strict settings mocks exercising spawn with charges=0 and subsequent
enchant update."
```

---

## Task 4: MobsDrawing filter at render (TDD)

**Files:**
- Create: `web/scripts/drawings/MobsDrawing.test.js`
- Modify: `web/scripts/drawings/MobsDrawing.js`

### 4.1 Write failing drawing tests (RED)

- [ ] **Step 1: Create MobsDrawing.test.js**

Create `web/scripts/drawings/MobsDrawing.test.js` with:

```javascript
// synthetic: living mobs constructed to cover render-time filter gates.

import {describe, test, expect, beforeEach, vi} from 'vitest';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getJSON: vi.fn(() => null),
    },
}));

const {MobsDrawing} = await import('./MobsDrawing.js');
const {EnemyType} = await import('../handlers/MobsHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('MobsDrawing living resource filter at render', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new MobsDrawing();
        drawing.DrawCustomImage = vi.fn();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.interpolateEntity = vi.fn();
        drawing.drawTextItems = vi.fn();
        drawing.drawFilledCircle = vi.fn();
        drawing.drawDistanceIndicator = vi.fn();
        drawing.drawHealthBar = vi.fn();
        drawing.getEnemyColor = vi.fn(() => '#ffffff');
        drawing.getEnemyTypeName = vi.fn(() => 'unknown');
        drawing.getScaledSize = vi.fn(s => s);
        drawing.getScaledFontSize = vi.fn(s => s);
        ctx = {font: '', measureText: vi.fn(() => ({width: 12}))};
        settingsSync.getBool.mockReturnValue(true);
    });

    function livingMob({id = 1, tier = 4, enchant = 0, name = 'Fiber'} = {}) {
        return {
            id, typeId: 529, hX: 10, hY: 20, tier,
            enchantmentLevel: enchant, name,
            type: name === 'Hide' ? EnemyType.LivingSkinnable : EnemyType.LivingHarvestable,
            getCurrentHP: () => 100, maxHealth: 100,
        };
    }

    // @verified 2026-04-19: living mob with enchant=0 is skipped when settings e0 for family is off.
    test('living Fiber e0 is skipped when settingLivingFiberEnchants.e0 is off', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 0})], []);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-19: living mob with enchant=2 is rendered when settings e2 for family is on.
    test('living Fiber e2 is rendered when settingLivingFiberEnchants.e2[tier-1] is on', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, true, false, false, false, false], e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 2})], []);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_4_2', 'Resources', 40);
    });

    // @verified 2026-04-19: living Hide resolves via settingLivingHideEnchants.
    test('living Hide e3 is rendered when settingLivingHideEnchants.e3[tier-1] is on', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingHideEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: [false, false, false, false, true, false, false, false], e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 5, enchant: 3, name: 'Hide'})], []);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'hide_5_3', 'Resources', 40);
    });

    // @verified 2026-04-19: living mob with wrong tier setting off is skipped even when enchant setting on.
    test('living Fiber e2 T4 is skipped when settings e2 T4 is off (T5 on)', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, false, true, false, false, false], e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 2})], []);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-19: hostile mob (non-living) is not affected by living filter; rendered via circle path.
    test('hostile enemy (non-living) is not subject to living filter', () => {
        settingsSync.getJSON.mockReturnValue(null);
        const hostile = {
            id: 2, typeId: 2067, hX: 10, hY: 20, tier: 5, enchantmentLevel: 0,
            name: 'T5_MOB_ROAMING_KEEPER_CAMP_UNPROVEN_MALE',
            type: EnemyType.Enemy,
            getCurrentHP: () => 100, maxHealth: 100,
        };
        drawing.invalidate(ctx, [hostile], []);
        expect(drawing.drawFilledCircle).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run the drawing test, verify failures**

Run: `npx vitest run web/scripts/drawings/MobsDrawing.test.js`
Expected: 4 out of 5 tests fail. The 2 "skipped" tests fail because without the filter, `DrawCustomImage` IS called. The 2 "rendered" tests fail because the current settings mocks return null, so the existing `mobOne.name && mobOne.tier > 0` gate keeps `imageName` as `fiber_4_0` but the test setup may need the `getBool` calls too, examine the actual failure output.

Note: the "hostile" test passes even on current code because hostile path bypasses the living-filter entirely. That is fine.

### 4.2 Apply the fix (GREEN)

- [ ] **Step 3: Add filter call in MobsDrawing.invalidate**

In `web/scripts/drawings/MobsDrawing.js`, at the top of the file add the import:

```javascript
import {shouldRenderLivingResource} from '../utils/LivingResourceFilter.js';
```

Locate the `invalidate(ctx, mobs, mists)` method, find the mobs loop:

```javascript
        for (const mobOne of mobs)
        {
            const point = this.transformPoint(mobOne.hX, mobOne.hY);

            let imageName = undefined;
            let imageFolder = undefined;

            /* Set by default to enemy, since there are more, so we don't add at each case */
            let drawHealthBar = settingsSync.getBool("settingEnemiesHealthBar");
            let drawId = settingsSync.getBool("settingEnemiesID");
            let isLivingResource = false;

            if (mobOne.type == EnemyType.LivingSkinnable || mobOne.type == EnemyType.LivingHarvestable)
            {
                isLivingResource = true;
```

Right after `isLivingResource = true;`, add:

```javascript
                if (!shouldRenderLivingResource(mobOne, key => settingsSync.getJSON(key))) {
                    continue;
                }
```

The `continue` skips to the next mob in the loop, avoiding both image draw and circle fallback.

- [ ] **Step 4: Run the drawing test, verify GREEN**

Run: `npx vitest run web/scripts/drawings/MobsDrawing.test.js`
Expected: 5 / 5 pass.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add web/scripts/drawings/MobsDrawing.js web/scripts/drawings/MobsDrawing.test.js
git commit -m "fix(32): apply living resource filter at MobsDrawing render time

MobsDrawing.invalidate now calls shouldRenderLivingResource for
LivingSkinnable/LivingHarvestable mobs, skipping the loop iteration
when the current enchant/tier/family combination is disabled in
settings.

Added MobsDrawing.test.js with 5 tests covering on/off combos for
Fiber and Hide, and a regression guard confirming hostile enemies
bypass the living filter."
```

---

## Task 5: HarvestablesDrawing filter at render (TDD)

**Files:**
- Modify: `web/scripts/drawings/HarvestablesDrawing.js`
- Create: `web/scripts/drawings/HarvestablesDrawing.test.js`

### 5.1 Write failing drawing tests (RED)

- [ ] **Step 1: Create HarvestablesDrawing.test.js**

Create `web/scripts/drawings/HarvestablesDrawing.test.js`:

```javascript
// synthetic: living + static harvestables constructed to cover render-time filter gates.

import {describe, test, expect, beforeEach, vi} from 'vitest';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => false),
        getJSON: vi.fn(() => null),
    },
}));

const {HarvestablesDrawing} = await import('./HarvestablesDrawing.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('HarvestablesDrawing living filter at render', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new HarvestablesDrawing();
        drawing.DrawCustomImage = vi.fn();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.interpolateEntity = vi.fn();
        drawing.drawText = vi.fn();
        drawing.drawDistanceIndicator = vi.fn();
        drawing.drawResourceCountBadge = vi.fn();
        drawing.calculateDistance = vi.fn(() => 10);
        drawing.calculateRealResources = vi.fn(() => 5);
        drawing.getScaledSize = vi.fn(s => s);
        ctx = {};
        settingsSync.getBool.mockReturnValue(false);
    });

    function livingHarvestable({tier = 4, charges = 0, stringType = 'Fiber', mobileTypeId = 529} = {}) {
        return {id: 1, hX: 10, hY: 20, size: 3, tier, charges, stringType, mobileTypeId, type: 11};
    }

    function staticHarvestable({tier = 5, charges = 2, stringType = 'Fiber'} = {}) {
        return {id: 2, hX: 30, hY: 40, size: 3, tier, charges, stringType, mobileTypeId: -1, type: 11};
    }

    test('living Fiber e0 is skipped when settings e0 for living fiber is off', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)}
                : null
        );
        drawing.invalidate(ctx, [livingHarvestable({tier: 4, charges: 0})]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    test('living Fiber e2 is rendered when settings e2 T4 is on', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, true, false, false, false, false], e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingHarvestable({tier: 4, charges: 2})]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_4_2', 'Resources', 40);
    });

    test('static Fiber rendering is unaffected by living filter', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [staticHarvestable({tier: 5, charges: 2})]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 30, 40, 'fiber_5_2', 'Resources', 40);
    });
});
```

- [ ] **Step 2: Run test, verify failures**

Run: `npx vitest run web/scripts/drawings/HarvestablesDrawing.test.js`
Expected: the "e0 is skipped" test fails (DrawCustomImage IS called). Others may vary on current code.

### 5.2 Apply the fix (GREEN)

- [ ] **Step 3: Add filter call in HarvestablesDrawing.invalidate**

In `web/scripts/drawings/HarvestablesDrawing.js`, add at the top:

```javascript
import {shouldRenderLivingResource} from '../utils/LivingResourceFilter.js';
```

Find the `invalidate(ctx, harvestables)` method and the loop over `harvestableOne`. At the top of the loop body, after the `if (harvestableOne.size <= 0) continue;` line, insert:

```javascript
            const mobileTypeId = harvestableOne.mobileTypeId;
            const isLiving = mobileTypeId !== null && mobileTypeId !== undefined
                && mobileTypeId !== 65535 && mobileTypeId !== -1;
            if (isLiving) {
                const entity = {
                    name: harvestableOne.stringType,
                    tier: harvestableOne.tier,
                    enchantmentLevel: harvestableOne.charges,
                };
                if (!shouldRenderLivingResource(entity, key => settingsSync.getJSON(key))) {
                    continue;
                }
            }
```

This adapts the Harvestable shape `{stringType, tier, charges}` to the filter's expected `{name, tier, enchantmentLevel}`. Static harvestables (mobileTypeId = -1 / 65535) pass through unchanged.

- [ ] **Step 4: Run test, verify GREEN**

Run: `npx vitest run web/scripts/drawings/HarvestablesDrawing.test.js`
Expected: 3 / 3 pass.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add web/scripts/drawings/HarvestablesDrawing.js web/scripts/drawings/HarvestablesDrawing.test.js
git commit -m "fix(32): apply living resource filter at HarvestablesDrawing render time

HarvestablesDrawing.invalidate now detects living harvestables via
mobileTypeId and routes them through shouldRenderLivingResource.
Static harvestables continue through the existing path unchanged.

Created HarvestablesDrawing.test.js with 3 tests: living off, living
on, static unaffected."
```

---

## Task 6: Register update + archive + finish branch

**Files:**
- Modify: `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`
- Move: `docs/plans/2026-01-15-living-harvestables-fix-design.md` to `docs/archive/completed-plans/`

- [ ] **Step 1: Archive the superseded design doc**

```bash
mkdir -p docs/archive/completed-plans
git mv docs/plans/2026-01-15-living-harvestables-fix-design.md docs/archive/completed-plans/
```

- [ ] **Step 2: Update the register**

Edit `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`:

1. In the `Open test.fails register` section, remove the `HARV-2` bullet entirely (the bug is fixed).

2. In the `Counts per handler` table, verify the HarvestablesHandler row. Flipping HARV-2 test.fails to @verified moves 1 from `test.fails` column to `@verified` column. Update from current `49 | 5 | 1 | 55` to `50 | 5 | 0 | 55`.

Verify via grep:
```
grep -c "@verified" web/scripts/handlers/HarvestablesHandler.test.js
grep -c "@characterization" web/scripts/handlers/HarvestablesHandler.test.js
grep -c "test.fails" web/scripts/handlers/HarvestablesHandler.test.js
```
Use actual counts if they differ from the predicted 50/5/0.

Also update MobsHandler row for the new 3 HARV-2 tests: `69 + 3 = 72 @verified`, total `131 + 3 = 134`. Verify via:
```
grep -c "@verified" web/scripts/handlers/MobsHandler.test.js
```

Recompute the Total row accordingly.

3. Add a decision log entry at the end of the `Decisions log` section:

```markdown
- 2026-04-19 #32 living resource enchant filter moved from spawn to render time. MobsHandler and HarvestablesHandler no longer drop living resources at spawn when the user has the corresponding e<n>[tier-1] setting off. Pure function `shouldRenderLivingResource` in `web/scripts/utils/LivingResourceFilter.js` is called by `MobsDrawing.invalidate` and `HarvestablesDrawing.invalidate` to filter per-frame. Dead scaffolding `MobsHandler.harvestablesNotGood` removed (4 reads, 0 writes). HARV-2 closed. Issue #30 and #32 both resolved. Superseded design doc `2026-01-15-living-harvestables-fix-design.md` moved to `docs/archive/completed-plans/`.
```

- [ ] **Step 3: Commit the register + archive**

```bash
git add docs/plans/notes/2026-04-18-handlers-characterization-coverage.md docs/plans/2026-01-15-living-harvestables-fix-design.md docs/archive/completed-plans/
git commit -m "docs(32): close HARV-2 register, archive superseded design doc"
```

- [ ] **Step 4: Final verification**

Run:
```
npm test
npm run lint
go test ./...
```

Expected: all green. No em-dash in the diff:
```
git diff main...HEAD | grep -cP '\x{2014}'
```
Expected output: 0.

No co-author trailer:
```
git log --format=%B main..HEAD | grep -ci "co-authored"
```
Expected output: 0.

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin feat/32-living-enchant-render-filter
gh pr create --title "fix(#32): living resources visible when only enchants other than e0 are checked" --body "$(cat <<'EOF'
## Summary
- Root cause: both MobsHandler and HarvestablesHandler filtered living resources at spawn based on enchant/tier settings. Living resources initially arrive with enchant = 0 (Parameters[33] = 0 for NewMob, hardcoded enchant = 0 in event 38 batch). Subsequent enchant update events could not recover entities already dropped.
- Fix: moved the enchant/tier filter from spawn to render time via pure function shouldRenderLivingResource in web/scripts/utils/LivingResourceFilter.js. Handlers keep living resources in their lists; drawings decide whether to display them per frame.
- Scope: living only. Static path unchanged.
- Removed dead scaffolding harvestablesNotGood.

## Test plan
- [x] 16 unit tests for shouldRenderLivingResource
- [x] 3 regression tests in MobsHandler.test.js (spawn e0 + settings e0 off + update to e2 yields visible mob)
- [x] 2 regression tests in HarvestablesHandler.test.js (same pattern for living harvestables)
- [x] HARV-2 test.fails flipped to @verified
- [x] 5 tests in MobsDrawing.test.js covering living filter at render
- [x] 3 tests in HarvestablesDrawing.test.js covering living filter + static unaffected
- [ ] Live in-game smoke: uncheck settingLivingHideEnchants.e0 across all tiers, find an enchanted hide mob in Mists, verify it appears on the radar with its enchant-coloured icon. User action.

## Depends on
Branched on feat/52-living-tier-mismatch (PR #77). When #77 merges, rebase on new main (no conflicts expected since changes are disjoint). Alternatively can be merged after #77 in sequence.
EOF
)"
```

- [ ] **Step 6: Live smoke test (user action)**

User in-game verification:
1. Settings UI : uncheck `settingLivingHideEnchants.e0` for tiers T2-T6, keep e1-e4 checked for those tiers.
2. Enter The Mists zone, find a Hide critter that has charged up past e0.
3. Verify the radar shows the critter with its enchant-coloured icon.
4. Move out of range then back in : icon persists (filter does not re-filter dropped-then-re-added entity).
5. Cross-check with one Fiber critter and one Wood critter (post-#52 Log fix) for symmetry across families.

If any discrepancy, capture pcap + screenshot, open follow-up issue.

---

## Post-implementation checklist

- [ ] All tests green (`npm test` + `go test ./...`)
- [ ] Lint clean (`npm run lint`)
- [ ] No em-dash character in diff
- [ ] No Co-Authored-By trailer
- [ ] Register entry for #32 / HARV-2 closed
- [ ] Superseded design doc archived
- [ ] Live smoke confirmed
- [ ] Dead scaffolding `harvestablesNotGood` verified removed (`grep -n harvestablesNotGood web/` = 0 matches)

## Rollback plan

If live smoke reveals an unexpected render regression on a specific mob family:
1. Revert the MobsDrawing.js or HarvestablesDrawing.js `continue` statement only. Handlers stay fixed.
2. Add a targeted skip case for the offending mob (log and proceed).
3. File a new issue describing the scenario, adjust the pure function or its call site in a follow-up commit.

The pure function and its tests are a stable safety net regardless.
