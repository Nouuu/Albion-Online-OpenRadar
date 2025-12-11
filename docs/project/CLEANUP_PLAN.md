# 🧹 CLEANUP PLAN - Remove Obsolete Features

**Date**: 2025-12-11
**Status**: 📋 Planned

---

## 🎯 Objective

Remove non-essential features that clutter the UI and don't provide real value.

---

## 📋 Features to Remove

### 1. Resource Overlay Enhancements ❌

**Reason**: Resource images already have different colors for enchantments. Overlays are redundant.

#### Settings to Remove:
- `settingLivingResourceEnchantOverlay` - Enchantment halo overlay on living resources

#### Files to Clean:
- **scripts/Drawings/MobsDrawing.js**
  - Remove `drawEnchantmentIndicator()` calls (line ~130)

- **scripts/Drawings/HarvestablesDrawing.js**
  - Remove enchantment overlay code

- **scripts/Utils/DrawingUtils.js**
  - Remove `drawEnchantmentIndicator()` method

- **views/main/resources.ejs**
  - Remove enchantment overlay checkbox
  - Remove associated event listeners

- **views/main/settings.ejs**
  - Remove any references to these settings

---

### 2. Grid Overlay ❌

**Reason**: Grid doesn't provide useful information, clutters the display.

#### Settings to Remove:
- `settingShowGrid` (or similar grid toggle)

#### Files to Clean:
- **scripts/Drawings/*** (check all drawing files)
  - Remove grid rendering code

- **views/main/settings.ejs** (or wherever grid toggle is)
  - Remove grid checkbox
  - Remove associated event listeners

- **Canvas layers**
  - Check if dedicated grid canvas layer exists
  - Remove if present

---

## 📝 Step-by-Step Cleanup

### Phase 1: Identify All References
- [x] Search for `settingLivingResourceEnchantOverlay`
- [x] Search for grid-related settings
- [ ] Document exact line numbers for each removal

### Phase 2: Remove UI Elements
- [ ] Remove checkboxes from resources.ejs
- [ ] Remove checkboxes from settings.ejs
- [ ] Remove event listeners
- [ ] Test UI still loads correctly

### Phase 3: Remove Code Logic
- [ ] Remove drawing methods
- [ ] Remove settings checks
- [ ] Remove overlay rendering code
- [ ] Test radar still works correctly

### Phase 4: Remove Settings Storage
- [ ] Clean up SettingsSync references
- [ ] Update default settings
- [ ] Test settings save/load

### Phase 5: Update Documentation
- [ ] Update MOB_UI_ENHANCEMENT.md
- [ ] Update TODO.md
- [ ] Mark features as removed

---

## ✅ Expected Results

After cleanup:
- Cleaner UI with fewer unnecessary checkboxes
- Simpler codebase (easier to maintain)
- No visual changes to actual radar display (resources still show correctly)
- Grid no longer clutters the minimap

---

## 🚨 Risks

### Low Risk
- Settings already saved in localStorage won't break (just ignored)
- No data loss (only UI/display features)

### Testing Required
- Resources still display correctly
- Living resources still show with correct images
- Static resources still show with correct images
- Minimap still works without grid

---

## 📚 Related Documents

- **MOB_UI_ENHANCEMENT.md** - Update with cleanup results
- **TODO.md** - Mark cleanup as completed
- **IMPROVEMENTS.md** - Remove obsolete features from planned list

---

**Last Updated**: 2025-12-11