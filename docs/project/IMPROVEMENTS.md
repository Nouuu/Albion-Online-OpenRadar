# Summary of Improvements - OpenRadar

This document summarizes the main improvements made to OpenRadar.

> **📘 For resource detection:** See `/docs/project/RESOURCE_DETECTION_REFACTOR.md`
> This document contains the complete state of the resource detection system.

---

## Implemented Features

### 1. Enriched Logging for Living Resources

**File:** `scripts/Handlers/MobsHandler.js`

- Automatic HP validation (comparison with metadata)
- Animal identification (Boar, Wolf, Fox, etc.)
- JSON format for logs
- Readable summary with HP match indicator

### 2. Living Resources Metadata

**225 creatures with metadata:**
- HP per creature
- Prefab (internal name)
- Faction
- Animal (human-readable name)

### 3. Enchantment Detection System (Phase 3B - Dec 2025)

**Current system (Dec 2025):**
- ✅ Uses `parameters[33]` directly from server
- ✅ Works for all types (Hide, Fiber, Ore, Wood, Rock)
- ✅ No more approximate calculation from `rarity`

**Obsolete system (Nov 2025):**
- ❌ Calculation from `rarity` field (unreliable)
- See `docs/technical/ENCHANTMENTS.md` for history

**See:** `/docs/project/RESOURCE_DETECTION_REFACTOR.md` for details

### 4. Player Detection System

- Players detected via Event 29 (names, guilds, alliances)
- Equipment IDs extracted
- See `docs/technical/PLAYERS.md` for architecture

### 5. Radar Display Unification (~80% complete)

- RadarRenderer active (replaces legacy gameLoop)
- CanvasManager (7 canvas layers)
- SettingsSync (BroadcastChannel, no polling)
- Legacy code removed
- See `RADAR_UNIFICATION_PLAN.md` for details

---

## Planned Improvements

### 1. Mob Detection UI Enhancement

**Goal:** Improve visual representation of mobs on radar

**Current State:**
- Mobs displayed as simple green dots
- No detailed information about mob types
- MobsDatabase provides complete mob data (4528 mobs, ~2800 harvestables)

**Planned Enhancements:**
- Display mob tier/enchantment information
- Show mob type (hostile vs passive)
- Visual differentiation based on mob categories
- Enable filtering for specific mob types
- Color-coding by threat level
- Optional mob name display

### 2. Map Tile Size Normalization

**Goal:** Fix minimap stretching issues with variable zone sizes.

**Current Issue:**
- Different map tiles have different sizes
- Small city zones cause minimap stretching
- Player position becomes inaccurate on stretched maps

**Planned:**
- Normalize map tile dimensions
- Apply scaling correction for small zones
- Prevent image distortion on the minimap

---

## Known Limitations

### Player Movement

- Players detected but movement is still problematic
- Event 3 (Move) works for mobs but not reliably for players
- See `PLAYER_DETECTION_STATUS.md` for investigation status

---

*Last update: 2025-12-11*