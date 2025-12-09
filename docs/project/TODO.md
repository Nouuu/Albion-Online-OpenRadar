# 📋 TODO

**Last Update**: 2025-12-09
**Status**: Phase 3B ✅ Complétée | Phase 4 ⏸️ En attente

> **📘 DÉTECTION DES RESSOURCES :** `/RESOURCE_DETECTION_REFACTOR.md`  
> Ce document contient l'état complet et à jour du système de détection.

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

  **⚠️ SYSTÈME OBSOLÈTE (Nov 2025) - Conservé pour historique**

  **Système Actuel (Phase 3B - Déc 2025) :**
    - ✅ Utilise `parameters[33]` directement du serveur
    - ✅ Fonctionne pour TOUS les types (Hide, Fiber, Ore, Wood, Rock)
    - ✅ Plus de calcul approximatif depuis `rarity`
    - ✅ Code simplifié et fiable
    - 📘 **Voir :** `/RESOURCE_DETECTION_REFACTOR.md`

  **Ancien système (Nov 2025 - OBSOLÈTE) :**

  Harvestable (Fiber/Wood/Ore/Rock) :
    - ❌ Calcul depuis `rarity` (unreliable)
    - ❌ Formule : `enchant = floor((rarity - base) / 45)`

  Skinnable (Hide) :
    - ❌ `rarity` constant par TypeID (faux)
    - ❌ Impossible de calculer l'enchant depuis rarity
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

#### Resources
- [ ] Long field session (2h+) with complete validation
    - Different biomes and tiers
    - Analyze stability and performance
    - Verify remaining charges vs harvest bonus

- [ ] Analyze EventNormalizer necessity
    - Evaluate if current corrections are sufficient
    - Decision based on long session results

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

- [ ] EventNormalizer decision (after long session analysis)
- [ ] Quality metrics
- [ ] Feature flags

---

## 📊 EventNormalizer EVALUATION

**Goal**: Determine if EventNormalizer is still necessary with recent changes

### ✅ Already Applied Corrections

1. **Server TypeID bugs override** (528/530/531) via mobinfo priority
2. **localStorage cache** of TypeID mappings
3. **Structured logging** (JSON + CSV) for analysis
4. **Complete database** (235 TypeIDs)

### ❓ Questions to Resolve via Long Session

1. **False positives**: How many TypeIDs still misclassified?
2. **Performance**: Slowdowns with cache enabled?
3. **Stability**: Race conditions in what % of cases?
4. **"Overlap"**: Annoying or acceptable (different objects)?

### 🎯 Decision Criteria

**EventNormalizer NECESSARY if** :

- [ ] > 10% of TypeIDs still misclassified after session
- [ ] Frequent race conditions (> 5% of spawns)
- [ ] Overlap annoying for gameplay
- [ ] localStorage cache unstable

**EventNormalizer NOT NECESSARY if** :

- [ ] < 5% problematic TypeIDs
- [ ] Rare race conditions (< 2%)
- [ ] Acceptable overlap
- [ ] Current system stable

> **Decision after 2h+ session with complete CSV logging**

---

## ⚠️ LIMITATIONS (Albion Server)

1. **Remaining charges**: Incorrect display (server counts harvest bonus)
    - Fix: Impossible (missing server-side data)

2. **"Overlap"**: Grouped resources have different entityIds
    - Normal game behavior (not a bug)

3. **Fiber TypeID**: Server sends incorrect typeNumber (16 instead of 14)
    - Fix: mobinfo override ✅

4. **ENCHANTED Hide/Fiber (.1+)**
    - Cause: Unique TypeIDs per enchantment (unknown)
    - Example: Hide T4.0 (TypeID 425) ✅, T4.1/T4.2 (TypeID ???) ❌
    - Impact: T4.2+ and T5.1+ filters non-functional
    - Solution: Manual collection needed (field session with logs)

5. **Missing Blackzone maps**
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

