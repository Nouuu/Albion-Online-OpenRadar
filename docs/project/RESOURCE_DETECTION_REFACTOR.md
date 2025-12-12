# Resource Detection System Refactor Plan

**Creation date:** 2025-12-02
**Last update:** 2025-12-11
**Status:** Phase 5 COMPLETED

---

## Phase Summary

| Phase | Description | Status | Commit |
|-------|-------------|--------|--------|
| 1 | HarvestablesDatabase | Done | `c34023e1` |
| 2 | Legacy Cache Removal | Done | `b1498a0a` |
| 3 | T6+ Bug Fix (override typeNumber) | Done | - |
| 3B | Living Resources Bug Fix (params[33]) | Done | - |
| 4 | Database Usage + isLiving Fix | Done | - |
| 5 | MobsDatabase (OFFSET=15) | Done | - |

---

## Final Architecture (Post-Phase 5)

### Detection Flow - Static Resources

```
Network Events (Photon)
  Event 38: NewSimpleHarvestableObjectList (batch spawn)
  Event 40: NewHarvestableObject (individual spawn)
  Event 46: HarvestableChangeState (update)
                    |
                    v
HarvestablesHandler.js
  - Parse parameters (type, tier, enchant, mobileTypeId)
  - Determine isLiving based on mobileTypeId
  - Validate via HarvestablesDatabase
  - Filter via settings (Static/Living x Type x Tier x Enchant)
                    |
                    v
HarvestablesDatabase.js
  - Load harvestables.json (5 types, 190 combinations)
  - Validate type/tier/enchant combinations
  - Provide getResourceTypeFromTypeNumber()
```

### Detection Flow - Living Resources

```
Network Events (Photon)
  Event 71: NewMobEvent (animal/creature spawn)
                    |
                    v
MobsHandler.js
  - Parse TypeID from parameters[1]
  - Lookup in MobsDatabase via getMobInfo(typeId)
  - Determine type (Hide/Fiber/etc) and tier from mobs.json
  - Filter via settings
                    |
                    v
MobsDatabase.js
  - Load mobs.json at startup (4528 mobs)
  - OFFSET = 15 (TypeID_server = Index + 15)
  - Parse Loot.Harvestable to identify resources
  - ~2800 harvestables automatically identified
```

### System Files

| File | Role |
|------|------|
| `scripts/Data/HarvestablesDatabase.js` | Parse harvestables.json, validate static resources |
| `scripts/Data/MobsDatabase.js` | Parse mobs.json with OFFSET=15, identify living resources |
| `scripts/Handlers/HarvestablesHandler.js` | Static resources detection |
| `scripts/Handlers/MobsHandler.js` | Living resources detection (animals, critters) |
| `public/ao-bin-dumps/harvestables.json` | Static data source |
| `public/ao-bin-dumps/mobs.json` | Mobs data source |

---

## Phase 5 - MobsDatabase (COMPLETED)

### Key Discovery

**`TypeID_server = Index_mobs.json + 15`**

This formula is used by all reference radars (DeathEye, AO-Radar).

| Server TypeID | Index (-15) | Mob Found | Tier |
|---------------|-------------|-----------|------|
| 421 | 406 | T1_MOB_HIDE_SWAMP_TOAD | T1 Hide |
| 425 | 410 | T4_MOB_HIDE_SWAMP_MONITORLIZARD | T4 Hide |
| 429 | 414 | T5_MOB_HIDE_STEPPE_TERRORBIRD | T5 Hide |

**DeathEye C# Reference**: `TypeId = Convert.ToInt32(parameters[1]) - 15;`

### Implementation

```javascript
// MobsDatabase.js
class MobsDatabase {
    static OFFSET = 15;

    _parseMobs(mobsArray) {
        mobsArray.forEach((mob, index) => {
            const typeId = index + MobsDatabase.OFFSET;
            // ...
        });
    }

    getMobInfo(typeId) {
        return this.mobsById.get(typeId) || null;
    }
}
```

### Resource Type Detection

The `_normalizeResourceType()` method analyzes the UniqueName to identify the type:

```javascript
_normalizeResourceType(uniqueName) {
    const name = uniqueName.toUpperCase();

    // Hide: animals (HIDE, WOLF, BEAR, etc.) + hide guardians
    if (name.includes('_HIDE_') || name.startsWith('HIDE_GUARDIAN'))
        return 'Hide';

    // Fiber: fiber critters + fiber guardians
    if (name.startsWith('FIBER_CRITTER') || name.startsWith('FIBER_GUARDIAN'))
        return 'Fiber';

    // Wood: wood critters + wood guardians
    if (name.startsWith('WOOD_CRITTER') || name.startsWith('WOOD_GUARDIAN'))
        return 'Log';

    // etc.
}
```

### Statistics

- **Total mobs in mobs.json**: ~4528
- **Harvestables identified**: ~2800+
- **Supported types**: Hide, Fiber, Log, Rock, Ore

### Validated Tests (2025-12-11)

| Observed | Type | Tier | Status |
|----------|------|------|--------|
| Living Hide | T4e0, T4e1, T5e1, T5e2, T5e3, T6e0 | OK |
| Living Fiber | T4e0, T5e0, T5e1, T6e0 | OK |

---

## Removed Legacy Code

### MobsInfo.js - DELETED

File completely removed. The 235 hardcoded TypeIDs are replaced by automatic parsing of mobs.json (2800+ mobs).

### MobsHandler.js - Cleaned

```javascript
// REMOVED:
this.mobinfo = {};
updateMobInfo(newData) { ... }
updateMobInfoEntry(typeId, entry) { ... }
getMobInfo(typeId) { ... }

// Legacy fallback removed in:
registerStaticResourceTypeID()
AddEnemy()
```

### Utils.js - Cleaned

```javascript
// REMOVED:
import {MobsInfo} from "../Handlers/MobsInfo.js";
var mobsInfo = new MobsInfo();
mobsInfo.initMobs();
mobsHandler.updateMobInfo(mobsInfo.moblist);
```

---

## Debugging Guide

### Verify MobsDatabase

```javascript
// Browser console
window.mobsDatabase.stats
// { totalMobs: 4528, harvestables: 2800+, ... }

// Test a specific TypeID
window.mobsDatabase.getMobInfo(425)
// { typeId: 425, uniqueName: "T4_MOB_HIDE_SWAMP_...", type: "Hide", tier: 4, ... }
```

### Verify HarvestablesDatabase

```javascript
window.harvestablesDatabase
// { isLoaded: true, stats: { typesLoaded: 5, combinationsLoaded: 190 } }

window.harvestablesDatabase.isValidResource('WOOD', 4, 1)
// true
```

### Analyze Detections

```javascript
// Detected living resources
window.logger.logs.filter(l =>
    l.event === 'MobsDatabaseMatch'
);

// Unknown TypeIDs (not in mobs.json)
window.logger.logs.filter(l =>
    l.event === 'UnknownMob_NoFallback'
);
```

---

## Before/After Comparison

| Aspect | Before (MobsInfo.js) | After (MobsDatabase) |
|--------|----------------------|----------------------|
| Supported TypeIDs | 235 hardcoded | 2800+ auto-parsed |
| Maintenance | Manual | Automatic via `update-ao-data.ts` |
| T6+ resources | Partially missing | All supported |
| Source of truth | Legacy code | Official mobs.json |

---

## System State (Dec 2025)

### What Works

| Feature | Status |
|---------|--------|
| T1-T8 static resources | OK |
| T1-T8 living resources | OK |
| Enchantments .0-.4 | OK |
| HarvestablesDatabase | OK |
| MobsDatabase | OK |
| All types (Wood, Rock, Fiber, Hide, Ore) | OK |

### Databases Used

| System | Database | Legacy Code |
|--------|----------|-------------|
| Items | OK | None |
| Spells | OK | None |
| Harvestables | OK | None |
| Mobs | OK | None (MobsInfo.js deleted) |

---

**End of document**