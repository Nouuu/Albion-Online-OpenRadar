# 📋 TODO

**Last Update**: 2025-12-11
**Status**: Phase 5 ✅ VALIDATED (100% success) | Next: Mob UI Enhancement

> **📘 RESOURCE DETECTION:** `/docs/project/RESOURCE_DETECTION_REFACTOR.md`
> This document contains the complete and up-to-date state of the detection system.

> 📖 **Technical Details**: [DEV_NOTES.md](DEV_NOTES.md) | **Tools**: [tools/](tools/)  
> 🎯 **New**: [Overlay Mode](OVERLAY_MODE.md) - Popup window for radar  
> 📊 **New**: [Resource Display](RESOURCES_COUNT_FIX.md) - Real resource count

---

## 📊 CURRENT STATE

### ✅ What Works

- **Hide/Fiber .0 (non-enchanted)** : 100% detection
    - Hide T1/T3/T4/T5 (TypeID 421/423/425/427) ✅
    - Fiber T3/T4/T5 (TypeID 528/530/531) ✅
- **🆕 Resource Count Display (2025-11-03)** : ✅ **FIXED**
    - ✅ Stack → resources conversion based on tier
    - ✅ T1-T3 : 1 stack = **3 resources** displayed
    - ✅ T4 : 1 stack = **2 resources** displayed
    - ✅ T5+ : 1 stack = **1 resource** displayed
    - ✅ Correct decrementation during harvest
    - ✅ Real-time display of exact available resources
- **🆕 MAJOR DISCOVERY (2025-11-03)** : **Living resources enchantments**
    - ✅ **TypeID DOES NOT CHANGE with enchantment!**
    - ✅ TypeID 427 = Hide T5 for .0, .1, .2, .3, .4 (all share same ID)
    - ✅ TypeID 530 = Fiber T4 for all enchantments
    - ⚠️ **BUT : Harvestable ≠ Skinnable !**

  **⚠️ OBSOLETE SYSTEM (Nov 2025) - Kept for history**

  **Current System (Phase 3B - Dec 2025):**
    - ✅ Uses `parameters[33]` directly from server
    - ✅ Works for ALL types (Hide, Fiber, Ore, Wood, Rock)
    - ✅ No more approximate calculation from `rarity`
    - ✅ Simplified and reliable code
    - 📘 **See:** `/docs/project/RESOURCE_DETECTION_REFACTOR.md`

  **Old system (Nov 2025 - OBSOLETE):**

  Harvestable (Fiber/Wood/Ore/Rock):
    - ❌ Calculation from `rarity` (unreliable)
    - ❌ Formula: `enchant = floor((rarity - base) / 45)`

  Skinnable (Hide):
    - ❌ `rarity` constant per TypeID (false)
    - ❌ Impossible to calculate enchant from rarity
- **localStorage Cache** : Functional (cross-reference HarvestablesHandler)
- **Settings Filtering** : By Tier + Enchant operational
- **🆕 Overlay Mode** : Popup window with opacity control ✅
- **🆕 Player Detection (2025-11-07)** : ✅ **IMPLEMENTED**
    - ✅ Basic radar display (red dots)
    - ✅ Smooth position interpolation
    - ✅ Type filtering (Passive/Faction/Dangerous)
    - ✅ Debug logging system
    - ✅ Master toggle `settingShowPlayers`
    - ✅ UI in home.ejs
    - 📖 See [PLAYERS.md](../technical/PLAYERS.md) for details

### ❌ Resolved Issues

- ✅ **Resource display** : Now displays real resource count instead of stacks
- ✅ **Resource decrementation** : Removes correct number of resources based on tier (3/2/1)
- ✅ **Fiber enchantments detected** : Rarity-based formula works
- ✅ **Hide enchantments** : Impossible to calculate at spawn (constant rarity), detected at kill via corpse
- ✅ **Unique TypeIDs** : No need to collect different enchanted TypeIDs (same ID for all .0 to .4)
- ✅ **Enhanced logging** : Displays calculated enchant for Fiber, 0 for Hide (corrected at kill)
- ✅ **Refactored code** : Centralized `calculateEnchantment()` method without duplication

---

## ✅ COMPLETED

### Resources & Detection
- ✅ Complete TypeIDs database (235 TypeIDs)
- ✅ Fiber/Hide functional detection
- ✅ Albion server bugs override (TypeID 528/530/531)
- ✅ localStorage cache + Clear button
- ✅ Analysis tools (tools/)
- ✅ Organized documentation
- ✅ **Field Validation (2025-12-11)** - Phase 5 VALIDATED
    - ✅ 100% success rate (3698 valid detections, 0 invalid)
    - ✅ Enchantments .0 to .3 working correctly
    - ✅ All tiers T1-T6 validated
    - ✅ All types validated (Wood, Fiber, Hide, Rock)
    - ✅ Living resources via MobsDatabase (468 detections)
    - ✅ Static resources via HarvestablesDatabase (3230+ detections)
    - ❌ **EventNormalizer NOT needed** (0% error rate)

### Player Detection (2025-11-07)
- ✅ Basic player radar display (red dots, 10px)
- ✅ Position interpolation (smooth movement)
- ✅ **Move event handling FIXED** (2025-11-07)
    - ✅ Support for both player format (Parameters[1][x/y])  
    - ✅ Support for entity format (Parameters[4/5])
    - ✅ Detection based on Parameters[253] === 21
    - ✅ Debug logging for both movement types
- ✅ PlayersDrawing.js refactored (uncommented interpolate/invalidate)
- ✅ Settings renamed: `settingDot` → `settingShowPlayers`
- ✅ UI added in home.ejs with master toggle
- ✅ Debug logging with CATEGORIES.PLAYER
- ✅ Type filtering (Passive/Faction/Dangerous)
- ✅ Documentation: docs/technical/PLAYERS.md

---

## 🔄 NEXT STEPS

### 🎉 RESOLVED (2025-11-03)

1. ✅ **Living resources enchantment mystery SOLVED!**
    - Identical TypeID for all enchantments (.0 to .4)
    - Enchantment calculated from rarity (params[19])
    - params[33] never used for living resources
    - Formula validated in-game: Hide T5.1 detected correctly
    - Logging corrected to display proper enchantment

### 🔥 URGENT (immediate)

1. ✅ **~~COLLECT Enchanted TypeIDs~~** → **NOT NECESSARY!**
    - TypeIDs are IDENTICAL for all enchantments
    - System already correctly calculates enchant from rarity
    - MobsInfo.js does NOT need enrichment

2. **Field validation session** (1-2h)
    - Validate formula on more enchantments (.2, .3, .4)
    - Test different tiers (T4, T6, T7, T8)
    - Verify enchanted Fiber
    - Collect precise statistics

### Medium term

#### Mobs (Priority 1 - Current Focus)
- [x] **Mob UI Enhancement - Classification System** ✅ (2025-12-11)
    - ✅ Color-coded mobs by threat level (Green/Purple/Orange/Red)
    - ✅ Functional filters (Normal/Enchanted/MiniBoss/Boss)
    - ✅ Name-based heuristics for VETERAN/ELITE detection
    - ✅ Removed Medium Enemy (not aligned with game data)
    - See MOB_UI_ENHANCEMENT.md for details

- [ ] **Code Cleanup** - Remove obsolete features
    - Remove resource overlay enhancements (redundant)
    - Remove grid overlay (not useful)
    - See CLEANUP_PLAN.md for details

#### Players (Priority 1 - Quick Wins)
- [ ] **Nickname display** (~30 min)
    - Add `settingNickname` checkbox in home.ejs
    - Implement in `PlayersDrawing.invalidate()`
    - Show player name near dot

- [ ] **Health bar overlay** (~30 min)
    - Add `settingHealth` checkbox in home.ejs
    - Use existing `drawHealthBar()` method
    - Display below player dot

- [ ] **Distance indicator** (~30 min)
    - Add `settingDistance` checkbox in home.ejs
    - Use `calculateDistance()` method
    - Show distance in meters

- [ ] **Color-coded dots by faction** (~45 min)
    - Green: Passive (flagId=0)
    - Yellow/Orange: Faction (1-6)
    - Red: Hostile (255)
    - Pattern from `MobsDrawing.getEnemyColor()`

- [ ] **Guild/Alliance tags** (~30 min)
    - Add `settingGuild` checkbox in home.ejs
    - Display guild name near dot

- [ ] **Mount status indicator** (~30 min)
    - Checkbox exists (`settingMounted`)
    - Visual: circle border or icon

### Medium/Long term

- [ ] Quality metrics
- [ ] Feature flags

---

## ⚠️ LIMITATIONS (Albion Server)

1. **Remaining charges**: Incorrect display (server counts harvest bonus)
    - Fix: Impossible (missing server-side data)

2. **"Overlap"**: Grouped resources have different entityIds
    - Normal game behavior (not a bug)

3. **Fiber TypeID**: Server sends incorrect typeNumber (16 instead of 14)
    - Fix: MobsDatabase override ✅

4. **Missing Blackzone maps**
    - Symptom: Black background on radar in blackzone (T6+ zones)
    - Cause: Incomplete Maps pack - blackzone tiles not included
    - Current pack: 103 tiles (mainly blue/yellow/red zones)
    - Missing tiles: Blackzone map IDs (4000+, 5000+)
    - Impact: Display works (entities visible), just no map background
    - Solution: Extract blackzone tiles from Albion client or find complete pack
    - Workaround: Disable "Show Map Background" in Settings

> Details: [DEV_NOTES.md](DEV_NOTES.md) "Expected behavior" section

---

## 📚 DOCUMENTATION

- **README.md** - User guide
- **DEV_NOTES.md** - Complete technical documentation
- **DOCS_GUIDE.md** - Navigation
- **tools/** - Analysis and verification scripts
- **README.md** - User documentation

---

End of TODO.

