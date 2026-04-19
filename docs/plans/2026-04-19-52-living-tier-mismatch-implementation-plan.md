# #52 Living Resource Tier Mismatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make radar display match in-game tooltip and harvest tier for living resource mobs (Fiber, Hide, Wood, Rock, Ore critters + Mists variants).

**Architecture:** Introduce a pure function `getLivingHarvestTier(mob)` in `web/scripts/utils/LivingResourceTier.js` implementing the derived rule `max(min_tier[l], t-1)` for LIVING non-DYNAMIC/DEAD templates, fallback to `t` otherwise. Use the function in `MobsHandler.AddEnemy` to set `mob.tier` when the mob is a living harvestable. Inline a 20-entry hardcoded min-tier map keyed by `Loot.Harvestable.@type` (game constants, stable). Deviation from spec's minifier-based approach: hardcoded map is simpler and removes build-time coupling without losing rigor (tests cover all observed families).

**Tech Stack:** Vanilla JavaScript ES modules, Vitest 4 + happy-dom, real `mobs.min.json` DB via `installRealDatabasesOnWindow`. No Go changes.

**Spec:** `docs/plans/2026-04-19-52-living-tier-mismatch-design.md`.

---

## File structure

### Create
- `web/scripts/utils/LivingResourceTier.js` : pure function + hardcoded min-tier map
- `web/scripts/utils/LivingResourceTier.test.js` : unit tests for the pure function (≥ 15 cases)
- `web/scripts/__fixtures__/ws/mobs/living-tier.json` : pcap-derived fixture with NewMob events for mismatch mobIds not in existing `spawn.json` (373, 374, 532, 534)

### Modify
- `web/scripts/handlers/MobsHandler.js:186-200` : use `getLivingHarvestTier` instead of raw `dbInfo.tier`
- `web/scripts/handlers/MobsHandler.test.js:87-139` : flip existing `@verified`/`@characterization` assertions for mobIds 422, 529, 531 that encoded pre-fix (wrong) tiers
- `web/scripts/handlers/MobsHandler.test.js` : add new variant tests using `living-tier.json` fixture
- `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md` : add TIER-1 register entry (closed same PR)

### No changes required
- `web/scripts/core/EventRouter.js` : NewMob dispatch unchanged, tier derived inside MobsHandler
- `web/ao-bin-dumps/mobs.min.json` : DB template data correct (combat tier), no refresh needed
- `tools/update-ao-data.ts` : spec's Phase 1 minifier dropped in favor of inline constant (see Architecture note)

---

## Task 1: LivingResourceTier pure function (TDD)

**Files:**
- Create: `web/scripts/utils/LivingResourceTier.js`
- Test: `web/scripts/utils/LivingResourceTier.test.js`

- [ ] **Step 1: Write the failing test file**

Create `web/scripts/utils/LivingResourceTier.test.js`:

```javascript
import {describe, test, expect} from 'vitest';
import {getLivingHarvestTier} from './LivingResourceTier.js';

describe('getLivingHarvestTier', () => {
    // DYNAMIC variants: no tier shift, template tier preserved
    test('DYNAMIC hide T3 returns combat tier 3', () => {
        expect(getLivingHarvestTier({u: 'T3_MOB_DYNAMIC_HIDE_SWAMP_GIANTTOAD', t: 3, l: 'HIDE'})).toBe(3);
    });
    test('DYNAMIC hide T5 returns combat tier 5', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_DYNAMIC_HIDE_SWAMP_GIANTSNAKE', t: 5, l: 'HIDE'})).toBe(5);
    });

    // DEAD variants: no tier shift, template tier preserved
    test('DEAD fiber critter T5 returns combat tier 5', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_FIBER_SWAMP_DEAD', t: 5, l: 'FIBER_CRITTER'})).toBe(5);
    });
    test('DEAD fiber critter T6 returns combat tier 6', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_CRITTER_FIBER_SWAMP_DEAD', t: 6, l: 'FIBER_CRITTER'})).toBe(6);
    });

    // Living HIDE (floor=1): -1 shift
    test('Living HIDE T2 snake returns 1 (floor=1, 2-1=1)', () => {
        expect(getLivingHarvestTier({u: 'T2_MOB_HIDE_SWAMP_SNAKE', t: 2, l: 'HIDE'})).toBe(1);
    });
    test('Living HIDE T3 gianttoad returns 2', () => {
        expect(getLivingHarvestTier({u: 'T3_MOB_HIDE_SWAMP_GIANTTOAD', t: 3, l: 'HIDE'})).toBe(2);
    });
    test('Living HIDE T5 mists owl returns 4', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_HIDE_MISTS_OWL', t: 5, l: 'HIDE'})).toBe(4);
    });
    test('Living HIDE T6 mists hound returns 5', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_HIDE_MISTS_HOUND', t: 6, l: 'HIDE'})).toBe(5);
    });

    // Living FIBER_CRITTER (floor=3): -1 shift, floor engages at T3
    test('Living FIBER_CRITTER T3 red returns 3 (floor engages: max(3, 2) = 3)', () => {
        expect(getLivingHarvestTier({u: 'T3_MOB_CRITTER_FIBER_SWAMP_RED', t: 3, l: 'FIBER_CRITTER'})).toBe(3);
    });
    test('Living FIBER_CRITTER T4 green returns 3', () => {
        expect(getLivingHarvestTier({u: 'T4_MOB_CRITTER_FIBER_SWAMP_GREEN', t: 4, l: 'FIBER_CRITTER'})).toBe(3);
    });
    test('Living FIBER_CRITTER T5 red returns 4', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_FIBER_SWAMP_RED', t: 5, l: 'FIBER_CRITTER'})).toBe(4);
    });

    // Living HIDE_CRITTER_ROADS (floor=4)
    test('Living HIDE_CRITTER_ROADS T5 mistcougar returns 4 (floor engages)', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_HIDE_MISTCOUGAR', t: 5, l: 'HIDE_CRITTER_ROADS'})).toBe(4);
    });
    test('Living HIDE_CRITTER_ROADS T6 mistcougar returns 5', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_CRITTER_HIDE_MISTCOUGAR', t: 6, l: 'HIDE_CRITTER_ROADS'})).toBe(5);
    });

    // Other families (spot checks, extrapolation validation)
    test('Living WOOD_CRITTER T4 returns 3', () => {
        expect(getLivingHarvestTier({u: 'T4_MOB_CRITTER_WOOD_MISTS_RED', t: 4, l: 'WOOD_CRITTER'})).toBe(3);
    });
    test('Living ROCK_CRITTER T4 returns 3', () => {
        expect(getLivingHarvestTier({u: 'T4_MOB_CRITTER_ROCK_MISTS_RED', t: 4, l: 'ROCK_CRITTER'})).toBe(3);
    });
    test('Living ORE_CRITTER T4 returns 3', () => {
        expect(getLivingHarvestTier({u: 'T4_MOB_CRITTER_ORE_MISTS_RED', t: 4, l: 'ORE_CRITTER'})).toBe(3);
    });

    // Edge cases
    test('mob without Loot.Harvestable.@type returns combat tier (no shift)', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_BOSS_UNDEAD', t: 5})).toBe(5);
    });
    test('null mob returns 0', () => {
        expect(getLivingHarvestTier(null)).toBe(0);
    });
    test('undefined mob returns 0', () => {
        expect(getLivingHarvestTier(undefined)).toBe(0);
    });
});
```

- [ ] **Step 2: Run the test file to verify it fails**

Run: `npx vitest run web/scripts/utils/LivingResourceTier.test.js`
Expected: FAIL with "Cannot find module './LivingResourceTier.js'" or similar import error. Every test listed as FAIL.

- [ ] **Step 3: Implement the pure function**

Create `web/scripts/utils/LivingResourceTier.js`:

```javascript
const MIN_TIER_BY_TYPE = {
    FIBER: 2,
    HIDE: 1,
    ORE: 2,
    ROCK: 1,
    WOOD: 1,
    FIBER_DYNAMIC: 3,
    HIDE_DYNAMIC: 3,
    ORE_DYNAMIC: 3,
    ROCK_DYNAMIC: 3,
    WOOD_DYNAMIC: 3,
    FIBER_CRITTER: 3,
    HIDE_CRITTER: 3,
    ORE_CRITTER: 3,
    ROCK_CRITTER: 3,
    WOOD_CRITTER: 3,
    FIBER_CRITTER_ROADS: 4,
    HIDE_CRITTER_ROADS: 4,
    ORE_CRITTER_ROADS: 4,
    ROCK_CRITTER_ROADS: 4,
    WOOD_CRITTER_ROADS: 4,
};

export function getLivingHarvestTier(mob) {
    if (!mob) return 0;
    const combatTier = mob.t ?? 0;
    if (!mob.l) return combatTier;
    if (/DYNAMIC|DEAD/.test(mob.u ?? '')) return combatTier;
    const minTier = MIN_TIER_BY_TYPE[mob.l] ?? 1;
    return Math.max(minTier, combatTier - 1);
}
```

- [ ] **Step 4: Run the test file to verify it passes**

Run: `npx vitest run web/scripts/utils/LivingResourceTier.test.js`
Expected: PASS, 19 tests passing, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add web/scripts/utils/LivingResourceTier.js web/scripts/utils/LivingResourceTier.test.js
git commit -m "feat(52): getLivingHarvestTier pure function with derived rule

Implements the rule max(min_tier[Loot.Harvestable.@type], combat_tier - 1)
for LIVING mobs (non-DYNAMIC, non-DEAD). DYNAMIC and DEAD variants preserve
combat tier. Hardcoded min-tier map per harvestable family (20 entries,
stable game constants).

Derived from capture-70 analysis: server Parameters[7] in event 40 matches
this rule 9/9 on observed cases across HIDE, FIBER_CRITTER including floor
engagement (T3 critter stays T3, T5 HIDE drops to T4)."
```

---

## Task 2: Integrate into MobsHandler (TDD with pcap fixture)

**Files:**
- Create: `web/scripts/__fixtures__/ws/mobs/living-tier.json`
- Modify: `web/scripts/handlers/MobsHandler.js:186-200`
- Modify: `web/scripts/handlers/MobsHandler.test.js:87-139`

### 2.1 Create targeted pcap-derived fixture

- [ ] **Step 1: Extract NewMob events for non-present mobIds from capture-70**

Run the following commands (assumes `capture-70.pcap` at repo root, untracked):

```bash
go run ./tools/anonymize-pcap --scrub-string "Nospy" --scrub-string "FARMEURCHINOIS" capture-70.pcap capture-70.anon.pcap

# Temporarily bump scenarios limit to 2000 to include rare mobIds
sed -i 's|Limit: 20}, // mobs/spawn|Limit: 2000}, // mobs/spawn|' tools/photon-dump/scenarios.go || true

rm -rf /tmp/cap70 && mkdir -p /tmp/cap70/go /tmp/cap70/js
go run ./tools/photon-dump -in capture-70.anon.pcap -out-go /tmp/cap70/go -out-js /tmp/cap70/js

# Restore scenarios.go
git checkout tools/photon-dump/scenarios.go

# Extract the 4 targeted mobIds into a focused fixture
node -e "
const fs=require('fs');
const src=JSON.parse(fs.readFileSync('/tmp/cap70/js/mobs/spawn.json','utf8'));
const targetIds=[373, 374, 532, 534];
const picked=[];
for (const tid of targetIds) {
  const msg=src.messages.find(m => m.parameters['1'] === tid);
  if (msg) picked.push(msg);
  else console.error('WARNING: typeId ' + tid + ' not found in capture');
}
const out={scenario:'mobs/living-tier.json', handler:'mobs', messages:picked};
fs.writeFileSync('web/scripts/__fixtures__/ws/mobs/living-tier.json', JSON.stringify(out, null, 2));
console.log('wrote', picked.length, 'messages');
"

rm -f capture-70.anon.pcap
```

Expected stdout: `wrote 4 messages`.

- [ ] **Step 2: Verify the fixture has the expected mobIds**

Run:
```bash
node -e "
const fx=JSON.parse(require('fs').readFileSync('web/scripts/__fixtures__/ws/mobs/living-tier.json','utf8'));
for (const m of fx.messages) console.log('typeId=' + m.parameters['1'], 'entity=' + m.parameters['0']);
"
```
Expected: 4 lines with typeIds 373, 374, 532, 534 (order may vary).

### 2.2 Write failing tests (RED)

- [ ] **Step 3: Flip existing @characterization tests + add new variant tests**

In `web/scripts/handlers/MobsHandler.test.js`, locate the test at line ~89 for mobId 422 and replace its assertion:

Replace:
```javascript
// @verified 2026-04-18: typeId=422 (T2_MOB_HIDE_SWAMP_SNAKE, real DB lt=2).
// Real DB: type=Hide, tier=2, isHarvestable=true -> LivingSkinnable.
test('pcap-derived spawn: living Hide mob typeId=422 tier=2 adds as LivingSkinnable', async () => {
    const fx = await loadFixture('mobs', 'spawn');
    const msg = fx.messages.find(m => m.parameters['1'] === 422);
    expect(msg).toBeDefined();
    const p = normalizeParams(msg.parameters);

    handler.NewMobEvent(p);

    const mobs = handler.getMobList();
    expect(mobs).toHaveLength(1);
    expect(mobs[0].type).toBe(EnemyType.LivingSkinnable);
    expect(mobs[0].tier).toBe(2);
});
```

With:
```javascript
// @verified 2026-04-19: typeId=422 (T2_MOB_HIDE_SWAMP_SNAKE). Server event 40 Parameters[7]=1.
// Rule: LIVING HIDE, max(1, 2-1) = 1. Combat tier 2 shifts to harvest tier 1.
test('pcap-derived spawn: living Hide mob typeId=422 rendered with harvest tier 1', async () => {
    const fx = await loadFixture('mobs', 'spawn');
    const msg = fx.messages.find(m => m.parameters['1'] === 422);
    expect(msg).toBeDefined();
    const p = normalizeParams(msg.parameters);

    handler.NewMobEvent(p);

    const mobs = handler.getMobList();
    expect(mobs).toHaveLength(1);
    expect(mobs[0].type).toBe(EnemyType.LivingSkinnable);
    expect(mobs[0].tier).toBe(1);
});
```

Similarly at line ~107 (mobId 529), replace:
```javascript
// @characterization 2026-04-18: typeId=529 (T4_MOB_CRITTER_FIBER_SWAMP_GREEN, real DB lt=4, type=Fiber).
// Real DB: l=FIBER_CRITTER, type=Fiber, tier=4, isHarvestable=true.
// Handler classifies: type !== 'Hide' -> LivingHarvestable (not LivingSkinnable).
// Previous mock wrongly returned type='Hide', causing wrong LivingSkinnable classification.
test('pcap-derived spawn: Fiber critter typeId=529 adds as LivingHarvestable with tier=4', async () => {
    const fx = await loadFixture('mobs', 'spawn');
    const msg = fx.messages.find(m => m.parameters['1'] === 529);
    expect(msg).toBeDefined();
    const p = normalizeParams(msg.parameters);

    handler.NewMobEvent(p);

    const mobs = handler.getMobList();
    expect(mobs).toHaveLength(1);
    expect(mobs[0].type).toBe(EnemyType.LivingHarvestable);
    expect(mobs[0].name).toBe('Fiber');
    expect(mobs[0].tier).toBe(4);
});
```

With:
```javascript
// @verified 2026-04-19: typeId=529 (T4_MOB_CRITTER_FIBER_SWAMP_GREEN). Server event 40 Parameters[7]=3.
// Rule: LIVING FIBER_CRITTER (floor=3), max(3, 4-1) = 3. Combat tier 4 shifts to harvest tier 3.
test('pcap-derived spawn: Fiber critter typeId=529 rendered with harvest tier 3', async () => {
    const fx = await loadFixture('mobs', 'spawn');
    const msg = fx.messages.find(m => m.parameters['1'] === 529);
    expect(msg).toBeDefined();
    const p = normalizeParams(msg.parameters);

    handler.NewMobEvent(p);

    const mobs = handler.getMobList();
    expect(mobs).toHaveLength(1);
    expect(mobs[0].type).toBe(EnemyType.LivingHarvestable);
    expect(mobs[0].name).toBe('Fiber');
    expect(mobs[0].tier).toBe(3);
});
```

Similarly at line ~126 (mobId 531), replace:
```javascript
// @characterization 2026-04-18: typeId=531 (T5_MOB_CRITTER_FIBER_SWAMP_RED, real DB lt=5, type=Fiber).
// Real DB: l=FIBER_CRITTER, type=Fiber, tier=5, isHarvestable=true.
// Handler classifies: type !== 'Hide' -> LivingHarvestable.
// Previous mock wrongly returned type='Hide', causing wrong LivingSkinnable classification.
test('pcap-derived spawn: Fiber critter typeId=531 adds as LivingHarvestable with tier=5', async () => {
    const fx = await loadFixture('mobs', 'spawn');
    const msg = fx.messages.find(m => m.parameters['1'] === 531);
    expect(msg).toBeDefined();
    const p = normalizeParams(msg.parameters);

    handler.NewMobEvent(p);

    const mobs = handler.getMobList();
    expect(mobs).toHaveLength(1);
    expect(mobs[0].type).toBe(EnemyType.LivingHarvestable);
    expect(mobs[0].name).toBe('Fiber');
    expect(mobs[0].tier).toBe(5);
});
```

With:
```javascript
// @verified 2026-04-19: typeId=531 (T5_MOB_CRITTER_FIBER_SWAMP_RED). Server event 40 Parameters[7]=4.
// Rule: LIVING FIBER_CRITTER, max(3, 5-1) = 4. Combat tier 5 shifts to harvest tier 4.
test('pcap-derived spawn: Fiber critter typeId=531 rendered with harvest tier 4', async () => {
    const fx = await loadFixture('mobs', 'spawn');
    const msg = fx.messages.find(m => m.parameters['1'] === 531);
    expect(msg).toBeDefined();
    const p = normalizeParams(msg.parameters);

    handler.NewMobEvent(p);

    const mobs = handler.getMobList();
    expect(mobs).toHaveLength(1);
    expect(mobs[0].type).toBe(EnemyType.LivingHarvestable);
    expect(mobs[0].name).toBe('Fiber');
    expect(mobs[0].tier).toBe(4);
});
```

- [ ] **Step 4: Add new variant tests using the `living-tier.json` fixture**

Append the following tests inside the `describe('NewMobEvent (event 123)', ...)` block (after the existing mobId 531 test):

```javascript
// @verified 2026-04-19: typeId=373 (T5_MOB_HIDE_MISTS_OWL). User confirmed game tooltip T4.
// Rule: LIVING HIDE, max(1, 5-1) = 4.
test('pcap-derived spawn (living-tier): Hide Mists owl typeId=373 rendered with harvest tier 4', async () => {
    const fx = await loadFixture('mobs', 'living-tier');
    const msg = fx.messages.find(m => m.parameters['1'] === 373);
    expect(msg).toBeDefined();
    const p = normalizeParams(msg.parameters);

    handler.NewMobEvent(p);

    const mobs = handler.getMobList();
    expect(mobs).toHaveLength(1);
    expect(mobs[0].type).toBe(EnemyType.LivingSkinnable);
    expect(mobs[0].name).toBe('Hide');
    expect(mobs[0].tier).toBe(4);
});

// @verified 2026-04-19: typeId=374 (T6_MOB_HIDE_MISTS_HOUND). User confirmed game tooltip T5.
// Rule: LIVING HIDE, max(1, 6-1) = 5.
test('pcap-derived spawn (living-tier): Hide Mists hound typeId=374 rendered with harvest tier 5', async () => {
    const fx = await loadFixture('mobs', 'living-tier');
    const msg = fx.messages.find(m => m.parameters['1'] === 374);
    expect(msg).toBeDefined();
    const p = normalizeParams(msg.parameters);

    handler.NewMobEvent(p);

    const mobs = handler.getMobList();
    expect(mobs).toHaveLength(1);
    expect(mobs[0].type).toBe(EnemyType.LivingSkinnable);
    expect(mobs[0].name).toBe('Hide');
    expect(mobs[0].tier).toBe(5);
});

// @verified 2026-04-19: typeId=532 (T5_MOB_CRITTER_FIBER_SWAMP_DEAD). Server event 40 Parameters[7]=5.
// Rule: DEAD variant preserves combat tier 5, no shift.
test('pcap-derived spawn (living-tier): Fiber DEAD typeId=532 preserves combat tier 5', async () => {
    const fx = await loadFixture('mobs', 'living-tier');
    const msg = fx.messages.find(m => m.parameters['1'] === 532);
    expect(msg).toBeDefined();
    const p = normalizeParams(msg.parameters);

    handler.NewMobEvent(p);

    const mobs = handler.getMobList();
    expect(mobs).toHaveLength(1);
    expect(mobs[0].type).toBe(EnemyType.LivingHarvestable);
    expect(mobs[0].name).toBe('Fiber');
    expect(mobs[0].tier).toBe(5);
});

// @verified 2026-04-19: typeId=534 (T6_MOB_CRITTER_FIBER_SWAMP_DEAD). DEAD variant.
// Rule: DEAD preserves combat tier 6.
test('pcap-derived spawn (living-tier): Fiber DEAD typeId=534 preserves combat tier 6', async () => {
    const fx = await loadFixture('mobs', 'living-tier');
    const msg = fx.messages.find(m => m.parameters['1'] === 534);
    expect(msg).toBeDefined();
    const p = normalizeParams(msg.parameters);

    handler.NewMobEvent(p);

    const mobs = handler.getMobList();
    expect(mobs).toHaveLength(1);
    expect(mobs[0].type).toBe(EnemyType.LivingHarvestable);
    expect(mobs[0].name).toBe('Fiber');
    expect(mobs[0].tier).toBe(6);
});
```

- [ ] **Step 5: Run the tests, verify failures of the 3 flipped tests and new tests**

Run: `npx vitest run web/scripts/handlers/MobsHandler.test.js`
Expected: FAIL on the 3 flipped tests (422 expects 1 got 2, 529 expects 3 got 4, 531 expects 4 got 5) AND on the new tests for 373 (expects 4 got 5), 374 (expects 5 got 6), 532 and 534 should PASS (DEAD preserves, no shift applied yet but MobsHandler already returns combat tier via `dbInfo.tier`).

Actually: 532 and 534 are DEAD. Before fix, MobsHandler already returns combat tier via `dbInfo.tier`. After fix with `getLivingHarvestTier`, DEAD still returns combat tier. So 532/534 pass both before and after.

### 2.3 Implement the fix (GREEN)

- [ ] **Step 6: Wire getLivingHarvestTier into MobsHandler.AddEnemy**

In `web/scripts/handlers/MobsHandler.js`, add the import at the top near other utility imports:

```javascript
import {getLivingHarvestTier} from '../utils/LivingResourceTier.js';
```

Then modify the block at line 186-200 from:

```javascript
if (dbInfo && dbInfo.isHarvestable) {
    // Living resource from MobsDatabase
    mob.tier = dbInfo.tier || 0;
    mob.name = dbInfo.type;  // 'Hide', 'Fiber', 'Log', 'Rock', 'Ore'
    // Hide = LivingSkinnable (animals), others = LivingHarvestable (critters/guardians)
    mob.type = dbInfo.type === 'Hide' ? EnemyType.LivingSkinnable : EnemyType.LivingHarvestable;
    hasKnownInfo = true;

    window.logger?.debug(CATEGORIES.MOBS, 'MobsDatabaseMatch', {
        typeId,
        type: dbInfo.type,
        tier: dbInfo.tier,
        uniqueName: dbInfo.uniqueName,
        assignedEnemyType: this.getEnemyTypeName(mob.type)
    });
}
```

To:

```javascript
if (dbInfo && dbInfo.isHarvestable) {
    mob.tier = getLivingHarvestTier(dbInfo) || 0;
    mob.name = dbInfo.type;
    mob.type = dbInfo.type === 'Hide' ? EnemyType.LivingSkinnable : EnemyType.LivingHarvestable;
    hasKnownInfo = true;

    window.logger?.debug(CATEGORIES.MOBS, 'MobsDatabaseMatch', {
        typeId,
        type: dbInfo.type,
        combatTier: dbInfo.tier,
        harvestTier: mob.tier,
        uniqueName: dbInfo.uniqueName,
        assignedEnemyType: this.getEnemyTypeName(mob.type)
    });
}
```

Note: `getLivingHarvestTier` expects the raw DB row shape (`{u, t, l}`), but `dbInfo` from `mobsDatabase.getMobInfo()` has parsed properties. Verify in Step 7 that the shape matches, and if not, wrap with a shape adapter.

- [ ] **Step 7: Check that dbInfo shape matches getLivingHarvestTier contract**

Run: `grep -n "getMobInfo\|mobsById" web/scripts/data/MobsDatabase.js | head -20`

Inspect the `getMobInfo` return shape. If dbInfo exposes fields as `{uniqueName, tier, lootType}` rather than `{u, t, l}`, change the call site to adapt:

```javascript
mob.tier = getLivingHarvestTier({
    u: dbInfo.uniqueName,
    t: dbInfo.tier,
    l: dbInfo.lootType,
}) || 0;
```

Commit this adapter call. Do NOT change the internal shape of LivingResourceTier.js (the pure function keeps `{u, t, l}` matching the minified DB format directly for auditability against `mobs.min.json`).

- [ ] **Step 8: Run the test suite, verify all tests pass**

Run: `npx vitest run web/scripts/handlers/MobsHandler.test.js`
Expected: PASS. 422→1, 529→3, 531→4, 373→4, 374→5 all green. 424 (DYNAMIC)→3, 428 (DYNAMIC)→5, 532→5, 534→6 also green (no regression on DYNAMIC/DEAD).

Also run the full handler suite to check for regressions:

Run: `npm test`
Expected: ALL handler tests green.

- [ ] **Step 9: Commit**

```bash
git add web/scripts/__fixtures__/ws/mobs/living-tier.json web/scripts/handlers/MobsHandler.js web/scripts/handlers/MobsHandler.test.js
git commit -m "fix(52): use derived harvest tier for living resource mobs

MobsHandler.AddEnemy now delegates tier computation to getLivingHarvestTier
which applies the rule max(min_tier[Loot.Harvestable.@type], combat_tier - 1)
for LIVING non-DYNAMIC/non-DEAD mobs. DYNAMIC and DEAD variants preserve
combat tier (no regression).

Flipped @characterization tests for mobIds 422, 529, 531 to @verified with
correct harvest tiers. Added 4 new variant tests covering Hide Mists (373,
374) and DEAD variants (532, 534) via new living-tier.json pcap fixture.

Fixes #52."
```

---

## Task 3: Register update + finish branch

**Files:**
- Modify: `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`

- [ ] **Step 1: Add TIER-1 register entry**

In `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`, under the "Decisions log" section, add at the end:

```markdown
- 2026-04-19 #52 living resource tier mismatch: root-cause investigation on capture-70 revealed server Parameters[7] in event 40 (NewHarvestableObject) matches the game tooltip exactly for all 9 observed cases. ao-bin-dumps `@tier` is the combat tier, distinct from harvest tier. Derived rule: for LIVING non-DYNAMIC/non-DEAD mobs, `harvest_tier = max(min_tier[l], combat_tier - 1)`. For DYNAMIC and DEAD variants, preserve combat tier. Pure function `getLivingHarvestTier` in `web/scripts/utils/LivingResourceTier.js`, used in `MobsHandler.AddEnemy`. 19 unit tests + 7 integration tests with pcap-derived fixtures covering HIDE, FIBER_CRITTER, HIDE_CRITTER_ROADS + DEAD + DYNAMIC. Issue #52 fixed in PR.
```

Also update the counts table at the top. Locate the current Distribution table:

```markdown
| Handler | `@verified` | `@characterization` | `test.fails` | Total |
|---|---:|---:|---:|---:|
| PlayersHandler | 37 | 2 | 2 | 41 |
| HarvestablesHandler | 47 | 7 | 1 | 55 |
| MobsHandler | 59 | 3 | 0 | 62 |
```

And bump MobsHandler to account for the new tests:
- 2 existing `@characterization` for 529 and 531 flip to `@verified`
- 4 new `@verified` from living-tier.json fixture (373, 374, 532, 534)

New row: `| MobsHandler | 65 | 1 | 0 | 66 |`
(the remaining `@characterization` is the 538 one that wasn't touched in this PR, adjust if count differs; verify by inspecting the current file).

Actual counts verification:

Run:
```bash
grep -c "@characterization" web/scripts/handlers/MobsHandler.test.js
grep -c "@verified" web/scripts/handlers/MobsHandler.test.js
```
Use the observed counts to write the exact row values.

- [ ] **Step 2: Commit**

```bash
git add docs/plans/notes/2026-04-18-handlers-characterization-coverage.md
git commit -m "docs(52): close TIER-1 register entry with decision log"
```

- [ ] **Step 3: Final verification run**

Run the full test suite + lint:

```bash
npm test
npm run lint
go test ./...
```

Expected: all green, no regressions.

- [ ] **Step 4: Push branch + open PR**

```bash
git push -u origin feat/52-living-tier-mismatch
gh pr create --title "fix(#52): derived harvest tier rule for living resource mobs" --body "$(cat <<'EOF'
## Summary
- Root-cause: `MobsHandler.AddEnemy` used combat tier from DB for living resources, but game tooltip and harvest drop use a different (shifted) tier.
- Fix: new `getLivingHarvestTier` pure function derives harvest tier from DB shape using rule `max(min_tier[Loot.Harvestable.@type], combat_tier - 1)` for LIVING non-DYNAMIC/non-DEAD mobs. DYNAMIC and DEAD preserve combat tier.
- Validated 9/9 on pcap server evidence + 4 user screenshot annotations.

## Test plan
- [x] Unit tests for `getLivingHarvestTier` (19 cases)
- [x] Integration tests for MobsHandler with pcap-derived fixture (7 variants)
- [x] No regression on existing DYNAMIC tests (424, 428)
- [ ] Live smoke in-game: radar tier matches tooltip for mobIds 373/374 (Mists) and 531 (Falsestep Marsh)
EOF
)"
```

- [ ] **Step 5: Live smoke test (user action)**

User runs the radar in-game, visits Falsestep Marsh T5, and verifies radar icon tier matches tooltip for mobId 531 (should both show T4). Then visits The Mists and verifies mobId 373 (owl) and 374 (hound), radar should show T4 and T5 respectively, matching the game.

If any discrepancy surfaces in live test: capture the scenario, add a new fixture, open follow-up issue. Do NOT patch the rule without evidence.

---

## Post-implementation checklist

- [ ] All tests green (`npm test` + `go test ./...`)
- [ ] Lint clean (`npm run lint`)
- [ ] No em-dash character in diff (`git diff main...HEAD | grep -cP '\x{2014}'` should output 0)
- [ ] Register `coverage.md` updated with TIER-1 decision entry and adjusted counts
- [ ] Memory refreshed (user-facing: update `project_active_plans.md` after PR merge)
- [ ] Live smoke confirmed with screenshot comparison (optional but recommended)
- [ ] Follow-up issue if live test uncovers a mob family not handled by the rule

## Rollback plan

If live smoke reveals the rule is incorrect for a specific family not covered by tests:
1. Revert the `getLivingHarvestTier` import in `MobsHandler.js` (single line), restore `mob.tier = dbInfo.tier || 0`.
2. Keep the pure function and its tests (still useful documentation).
3. Open a follow-up issue with the failing scenario and new pcap fixture.
4. Redesign the rule with additional evidence.
