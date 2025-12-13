# ✨ Enchantments System – Technical Notes

> **⚠️ HISTORICAL DOCUMENT (Nov 2025)**
> This document describes the old enchantment system based on the `rarity` field.
>
> **Current system (Dec 2025):** Uses `parameters[33]` directly from server (Phase 3B).
>
> **📘 REFERENCE DOCUMENT:** `/docs/project/RESOURCE_DETECTION_REFACTOR.md`
> See this document for the complete current state of the detection system.

---

> **Scope (Historical):** How enchantments were represented and detected in OpenRadar (Nov 2025).
> **Focus:** Living resources (Hide/Fiber), harvestables, and dungeon enchantments.

---

## 1. Overview

Albion Online uses different representations for enchantments depending on the context:

- **Resources / Mobs** → encoded in a `rarity` field.
- **Items** → encoded in item name suffixes (.1, .2, .3, .4).
- **Dungeon enchantments** → specific parameters in event payloads.

OpenRadar relies heavily on **rarity-based detection** for living resources.

---

## 2. Rarity-Based Enchantments (Living Resources)

### 2.1 Discovery

While investigating living resources (Hide/Fiber), we found:

- `params[33]` in events is **always 0** for living resources.
- Real enchantment is encoded in a `rarity` field (e.g. `params[19]`).

Example log (simplified):

```text
TypeID 530 | rarity = 92
params[19] = 92
params[33] = 0
params[8] = undefined
params[9] = undefined
params[252] = undefined
```

**Monitored parameters:**

- `params[19]` = rarity (contains encoded enchantment) ✅
- `params[33]` = supposed enchant (always 0) ❌
- `params[8]`, `params[9]`, `params[252]` = other tested candidates

**Result:** Enchantment is computed from `rarity` (params[19]), not from a dedicated field.

---

## 3. Validated Formula

### 3.1 Base Rarity per Tier

| Tier | Base Rarity | Status                  |
|------|-------------|-------------------------|
| T3   | 78          | ✅ Field confirmed       |
| T4   | 92          | ✅ Field confirmed       |
| T5   | 112         | ✅ Field confirmed       |
| T6   | 132         | ⚠ Estimated (+20/tier)  |
| T7   | 152         | ⚠ Estimated             |
| T8   | 172         | ⚠ Estimated             |

### 3.2 Enchantment Calculation

```javascript
const diff = rarity - baseRarity;

if (diff < 20)   return 0; // .0 (normal)
if (diff < 65)   return 1; // .1 (~+45)
if (diff < 110)  return 2; // .2 (~+90)
if (diff < 155)  return 3; // .3 (~+145)
return 4;                  // .4 (~+155+)
```

### 3.3 Field-Validated Examples

| Resource   | TypeID | Rarity | Base | Diff | Enchant | ✔   |
|------------|--------|--------|------|------|---------|-----|
| Hide T5.1  | 427    | 257    | 112  | 145  | 1       | ✅   |
| Fiber T4.0 | 530    | 92     | 92   | 0    | 0       | ✅   |
| Hide T4.0  | 425    | 137    | 92   | 45   | 1?      | ⚠   |

The formula is correct qualitatively, but thresholds still need incremental validation for all tiers/enchants.

---

## 4. Code Changes Applied

### 4.1 `getBaseRarity()` Helper

**File:** `scripts/Handlers/MobsHandler.js`

```javascript
getBaseRarity(tier) {
  const baseRarities = {
    1: 0,
    2: 0,
    3: 78,  // Field validated
    4: 92,  // Field validated
    5: 112, // Field validated
    6: 132, // Estimated
    7: 152, // Estimated
    8: 172  // Estimated
  };

  return baseRarities[tier] || 0;
}
```

### 4.2 Computing `realEnchant`

**File:** `scripts/Handlers/MobsHandler.js`  
**Method:** `logLivingCreatureEnhanced()`

```javascript
// Calculate REAL enchantment from rarity
let realEnchant = enchant;
if (rarity !== null && rarity !== undefined) {
  const baseRarity = this.getBaseRarity(tier);
  if (baseRarity > 0) {
    const diff = rarity - baseRarity;
    if (diff < 20) realEnchant = 0;
    else if (diff < 65) realEnchant = 1;
    else if (diff < 110) realEnchant = 2;
    else if (diff < 155) realEnchant = 3;
    else realEnchant = 4;
  }
}

// Use calculated enchant
logData.resource.enchant = realEnchant;
console.log(`... T${tier}.${realEnchant} ...`);  // Correct display
```

Previously, the code used `params[33]` directly, which was always 0 for living resources.

### 4.3 Debug Parameters

For further investigations, extra debug logging was temporarily added:

```javascript
// [DEBUG_PARAMS]
// TypeID ${typeId} | params[19] = ${rarity} | params[33] = ${enchant}
```

---

## 5. Impact Analysis

### 5.1 What Was Already Correct

`HarvestablesHandler.js` already computed enchantment from rarity:

```javascript
// Around line 140
const enchant = this.calculateEnchantmentFromRarity(rarity, tier);
```

### 5.2 What Was Wrong

`MobsHandler.js` logged `params[33]` directly:

```javascript
// BEFORE (wrong)
logData.resource.enchant = enchant;  // = params[33] = 0 ❌

// AFTER (correct)
logData.resource.enchant = realEnchant;  // Computed from rarity ✅
```

---

## 6. Effects on the System

### 6.1 Positive

1. **No need to collect separate enchanted TypeIDs:**
   - E.g. TypeID 427 = Hide T5 for **all** enchants (.0, .1, .2, .3, .4).
   - Same for Fiber T4 TypeID 530.
   - `MobsInfo.js` was already complete at the base level.

2. **System works for all enchantments:**
   - Formula calculates enchantment automatically.
   - Radar displays correct `.0`–`.4` information.
   - Logging is now consistent with in-game behavior.

3. **Simpler architecture:**
   - No extra database needed for enchanted TypeIDs.
   - No manual enchanted TypeID collection.
   - Code is easier to maintain.

### 6.2 Still to Validate

A dedicated field-test session (1–2h) is needed to:

- [ ] Test Hide/Fiber .2, .3, .4.
- [ ] Validate tiers T6–T8.
- [ ] Refine thresholds (20, 65, 110, 155) if needed.
- [ ] Check edge cases (diff exactly on threshold boundaries).

---

## 7. Dungeon Enchantments

Dungeon enchantments are handled separately from resource rarity.

### 7.1 Offset Fix

During analysis, an incorrect offset was found in `DungeonsHandler.js`:

```javascript
// BEFORE
const enchant = parameters[6];

// AFTER
const enchant = parameters[8]; // Correct offset
```

This fix ensures solo dungeon enchantments are read from the proper parameter.

---

## 8. Summary & Next Steps (Historical)

### 8.1 Summary of Root Causes

Problems identified in Nov 2025:
- Approximate calculation from `rarity`
- Complex distinction LivingHarvestable vs LivingSkinnable
- Fragile formula `enchant = floor((rarity - base) / 45)`

### 8.2 Expected Gains After Fixes

| Metric                    | Before          | After (Phase 3B) | Note                      |
|---------------------------|-----------------|------------------|---------------------------|
| T6+ detection             | ~50%            | 100%             | Fix override + params[33] |
| Living resources enchant  | ~20%            | 100%             | Uses params[33]           |
| Solo dungeon enchantment  | ~80%            | 100%             | After offset correction   |

### 8.3 Next Steps (Completed in Phase 3B)

1. ✅ **Field validation completed**
2. ✅ **Simplified system**: Uses `parameters[33]` directly
3. ⏸️ **Database migration**: Phase 4 pending

---

## 9. Current System (Phase 3B - Dec 2025)

**The system described in this document is OBSOLETE.**

Since Phase 3B (December 2025), OpenRadar uses a simplified approach:

```javascript
// MobsHandler.js - Phase 3B (Current)
calculateEnchantment(type, tier, rarity, paramsEnchant) {
    // ✅ Uses parameters[33] directly (reliable server data)
    if (paramsEnchant !== null && paramsEnchant !== undefined) {
        return Math.max(0, Math.min(4, paramsEnchant));
    }
    return 0;
}
```

**What was abandoned:**
- ❌ Calculation from `rarity` (unreliable)
- ❌ Distinction LivingHarvestable vs LivingSkinnable
- ❌ Formula `enchant = floor((rarity - base) / 45)`
- ❌ Base rarity tables (78, 92, 112, etc.)

**📘 See:** `/docs/project/RESOURCE_DETECTION_REFACTOR.md` for complete current state.

---

_**Note:** This document is kept for historical reference. The current system (Phase 3B, Dec 2025) no longer uses the rarity-based calculation described here._
