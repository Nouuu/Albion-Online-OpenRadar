# 🧹 CLEANUP PLAN - Remove Obsolete Features

**Date**: 2025-12-11
**Status**: ✅ Complete (2/2 features removed)
**Last Updated**: 2025-12-12

---

## 🎯 Objective

Remove non-essential features that clutter the UI and don't provide real value.

---

## 📋 Features to Remove

### 1. Resource Overlay Enhancements ✅ COMPLETED

**Reason**: Resource images already have different colors for enchantments. Overlays are redundant.

#### Settings Removed:
- ✅ `settingResourceEnchantOverlay` - Enchantment overlay on static resources
- ✅ `settingLivingResourceEnchantOverlay` - Enchantment halo overlay on living resources

#### Files Cleaned:
- ✅ **scripts/Drawings/MobsDrawing.js**
  - Removed `drawEnchantmentIndicator()` calls (line ~130)

- ✅ **scripts/Drawings/HarvestablesDrawing.js**
  - Removed enchantment overlay code

- ✅ **scripts/Utils/DrawingUtils.js**
  - Removed `drawEnchantmentIndicator()` method

- ✅ **views/main/resources.ejs**
  - Removed enchantment overlay checkboxes
  - Removed associated event listeners

- ✅ **views/main/settings.ejs**
  - Removed enchantment indicator section
  - Removed all references and event listeners

- ✅ **views/main/drawing.ejs**
  - Removed `overlayEnchantment` checkbox
  - Removed associated JavaScript code

- ✅ **scripts/drawing-ui.js**
  - Removed enchantment overlay logic

**Completion Date**: 2025-12-12

---

### 2. Grid Overlay ✅ COMPLETED

**Reason**: Grid doesn't provide useful information, clutters the display.

#### Settings Removed:
- ✅ No UI toggle existed (grid was always shown)

#### Files Cleaned:
- ✅ **scripts/Utils/CanvasManager.js**
  - Removed `gridCanvas` from canvasIds array
  - Deleted `setupGridCanvas()` method entirely
  - Updated header documentation (6 layers → 5 layers)

- ✅ **scripts/Utils/DrawingUtils.js**
  - Removed `initGridCanvas()` method
  - Removed `drawBoard()` method (grid line rendering)
  - Removed `fillCtx()` method (unused)

- ✅ **views/main/drawing.ejs**
  - Removed `<canvas id="gridCanvas">` HTML element
  - Moved border CSS styling to mapCanvas

- ✅ **views/main/radar-overlay.ejs**
  - Removed `<canvas id="gridCanvas">` HTML element
  - Moved border CSS styling to mapCanvas

**Completion Date**: 2025-12-12

---

## 📝 Step-by-Step Cleanup

### Phase 1: Identify All References ✅ COMPLETED
- [x] Search for `settingLivingResourceEnchantOverlay`
- [x] Search for `settingResourceEnchantOverlay`
- [x] Search for grid-related settings
- [x] Document exact line numbers for each removal

### Phase 2: Remove UI Elements ✅ COMPLETED (Enchantment Overlay)
- [x] Remove checkboxes from resources.ejs
- [x] Remove checkboxes from settings.ejs
- [x] Remove checkbox from drawing.ejs
- [x] Remove event listeners
- [x] Test UI still loads correctly

### Phase 3: Remove Code Logic ✅ COMPLETED (Enchantment Overlay)
- [x] Remove drawing methods (drawEnchantmentIndicator)
- [x] Remove settings checks
- [x] Remove overlay rendering code
- [x] Test radar still works correctly

### Phase 4: Remove Settings Storage ✅ COMPLETED (Enchantment Overlay)
- [x] Clean up SettingsSync references
- [x] Update default settings
- [x] Test settings save/load

### Phase 5: Update Documentation ⏳ IN PROGRESS
- [x] Update CLEANUP_PLAN.md
- [x] Update PLAN.md
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

---

## 📊 Cleanup Progress

### ✅ Completed (2/2)
- **Resource Overlay Enhancements** (Enchantment indicators)
  - All UI elements removed
  - All code logic removed
  - All settings references removed
  - Tested and working correctly

- **Grid Overlay**
  - Removed gridCanvas from canvas layer stack
  - Deleted all grid rendering methods
  - Updated canvas documentation
  - Moved border styling to mapCanvas
  - Canvas count reduced from 6 to 5 layers

---

**Last Updated**: 2025-12-12