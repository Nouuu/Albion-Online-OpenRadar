# 🐛 Debug & Logging System - Complete Guide

> **Date:** 2025-12-01
> **Version:** 2.2 - Constants refactoring & centralized filtering

## 🔄 Migration v2.1 → v2.2

**Major changes:**

- ✅ **New file**: `scripts/constants/LoggerConstants.js` - Centralized constants
  - 42 CATEGORIES (MOB, HARVEST, PLAYER, etc.)
  - 90+ EVENTS (NewMobEvent, HarvestStart, etc.)
  - CATEGORY_SETTINGS_MAP (category → setting mapping)

- ✅ **Centralized filtering**: LoggerClient.shouldLog() - Reads localStorage in real-time
  - Removed ~40+ `if (settings.debugX && window.logger)` conditions
  - Handlers no longer need to check settings
  - Exit early for optimal performance

- ✅ **Constants everywhere**: Replaced ALL hardcoded strings
  - ❌ BEFORE: `window.logger.debug('MOB', 'NewMobEvent', {...})`
  - ✅ AFTER: `window.logger?.debug(this.CATEGORIES.MOB, this.EVENTS.NewMobEvent, {...})`

- ✅ **Standardized patterns**: Consistent import across codebase
  - Classes: `this.CATEGORIES`, `this.EVENTS` (import in constructor)
  - Local scripts: `CATEGORIES`, `EVENTS` (import at top of module)
  - Global functions: `window.CATEGORIES`, `window.EVENTS`

## 🔄 Migration v2.0 → v2.1

**Debug category changes:**

- ❌ **Removed**: `logLivingCreatures` → ✅ **Replaced by**: `debugEnemies`
- ❌ **Removed**: `logLivingResources` → ✅ **Replaced by**: `debugHarvestables`

**New settings added:**
- ✅ `debugHarvestables`: Verbose debug for harvestable resources (living + static)
- ✅ `debugFishing`: Verbose debug for fishing
- ✅ `debugPlayers`, `debugChests`, `debugDungeons`: Fully integrated

---

## 📋 Table des Matières

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [User Controls](#user-controls)
4. [Technical System](#technical-system)
5. [Developer Guide](#developer-guide)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

### Goal
Provide a **centralized**, **dynamic** and **easy-to-use** debug and logging system to trace events in the Albion Online radar.

### v2.2 Principles
- ✅ **Complete centralization**: Filtering in LoggerClient only
- ✅ **Zero duplication**: ~40+ conditions removed from handlers
- ✅ **Type-safe**: Constants for categories and events (42 CATEGORIES, 90+ EVENTS)
- ✅ **Real-time**: Instant changes without reload (reads localStorage without cache)
- ✅ **Persistence**: Settings saved in localStorage
- ✅ **KISS**: Simple handlers, no filtering logic

---

## 🏗️ Architecture v2.2

### v2.2 Data Flow (Simplified)

```
┌─────────────────┐
│  Settings.ejs   │ ← User changes a checkbox
│  (Interface)    │
└────────┬────────┘
         │ onChange event
         ▼
┌─────────────────┐
│  localStorage   │ ← Automatic save
│   (Storage)     │
└────────┬────────┘
         │ Real-time read (no cache)
         ▼
┌──────────────────────────┐
│  LoggerClient.shouldLog()│ ← Centralized filtering
│  (Single decision)       │
└────────┬─────────────────┘
         │ true/false
         ▼
┌─────────────────┐
│   Handlers      │ ← Call window.logger?.debug() directly
│  (Logic)        │    NO settings check!
└─────────────────┘
```

### v2.2 Components

#### 1. **LoggerConstants.js** (NEW v2.2)
- **File:** `scripts/constants/LoggerConstants.js`
- **42 CATEGORIES**: MOB, HARVEST, PLAYER, CHEST, etc.
- **90+ EVENTS**: NewMobEvent, HarvestStart, HealthUpdate, etc.
- **CATEGORY_SETTINGS_MAP**: Category → setting mapping
  - MOB → debugEnemies
  - HARVEST → debugHarvestables
  - null for always-logged categories

#### 2. **LoggerClient.shouldLog()** (NEW v2.2)
- **File:** `scripts/LoggerClient.js`
- **Centralized filtering**: Single location for all logic
- **Real-time**: Reads localStorage.getItem() without cache
- **Exit early**: Immediate return if filtered (performance)

#### 3. **User Interface** (views/main/settings.ejs)
- **Section "🐛 Debug & Logging"**
- Global debug checkboxes
- Download Debug Logs button
- Links to specialized pages

#### 4. **Storage** (localStorage)
- Keys prefixed with `setting`
- Values: `"true"` or `"false"` (strings)
- Persistent between sessions
- **Read in real-time** by LoggerClient (no cache)

#### 5. **Global State** (scripts/Utils/Settings.js)
- `Settings` class with properties (optional in v2.2)
- `update()` method to refresh
- **Note:** Handlers no longer need to check settings

#### 6. **Handlers** (scripts/Handlers/*.js)
- **v2.2:** Appellent `window.logger?.debug()` directement
- **Plus de conditions** `if (settings.debugX)`
- Importent constantes dans constructor
- Code simplifié et maintenable

---

## 🎛️ User Controls

### Settings Page (Centralized)

#### Global Logging Toggles

| Checkbox              | localStorage Key             | Settings Property     | Usage                                   |
|-----------------------|------------------------------|-----------------------|-----------------------------------------|
| 🐛 Debug Enemies      | `settingDebugEnemies`        | `this.debugEnemies`   | Verbose debug for enemies/mobs          |
| 👥 Debug Players      | `settingDebugPlayers`        | `this.debugPlayers`   | Verbose debug for players               |
| 📦 Debug Chests       | `settingDebugChests`         | `this.debugChests`    | Verbose debug for chests                |
| 🏰 Debug Dungeons     | `settingDebugDungeons`       | `this.debugDungeons`  | Verbose debug for dungeons              |
| 🎣 Debug Fishing      | `settingDebugFishing`        | `this.debugFishing`   | Verbose debug for fishing               |
| 🌱 Debug Harvestables | `settingDebugHarvestables`   | `this.debugHarvestables` | Verbose debug for harvestable resources |

#### Visual Overlays (Specialized Pages)

| Page | Contrôles | localStorage Keys |
|------|-----------|-------------------|
| **Enemies** | Health Bar, Show ID | `settingEnemiesHealthBar`, `settingEnemiesID` |
| **Resources** | Health Bar, Show ID | `settingLivingResourcesHealthBar`, `settingLivingResourcesID` |

#### Actions

| Button | Location | Function |
|--------|----------|----------|
| 💾 Download Debug Logs | Settings | Export JSON with session info + all settings |
| 📋 Log Enemies | Drawing (Radar) | Log current enemy list to console |
| 👁️ View Cache | Resources | Display TypeID cache in console |
| 🗑️ Clear Cache | Resources | Clear TypeID cache and prompt reload |

---

## ⚙️ Technical System

### 1. Dynamic Updates

#### Mechanism (scripts/Utils/Utils.js)

```javascript
// Override localStorage.setItem to detect changes
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    
    if (key.startsWith('setting')) {
        console.log(`🔄 [Settings] Update: ${key} = ${value}`);
        settings.update(); // ← Instant update
    }
};
```

#### Advantages
- ✅ **Instant** changes (no reload needed)
- ✅ Works on **same page** (storage event not enough)
- ✅ Debug logs for tracking

### 2. Handler Usage

#### MobsHandler.js

```javascript
NewMobEvent(parameters) {
    // ...
    
    // 🐛 DEBUG: Log raw parameters
    if (this.settings && this.settings.debugEnemies) {
        console.log(`[DEBUG_ENEMY] RAW PARAMS | ID=${id} TypeID=${typeId}`);
    }
    
    // 🌱 DEBUG: Living creatures enhanced (harvestables)
    if (this.settings && this.settings.debugHarvestables) {
        this.logLivingCreatureEnhanced(id, typeId, health, ...);
    }
}
```

#### HarvestablesHandler.js

```javascript
onHarvestStart(harvestableId) {
    // ...

    if (this.settings && this.settings.debugHarvestables && window.logger) {
        window.logger.debug('HARVEST', 'HarvestStart', {
            harvestableId,
            timestamp: new Date().toISOString()
        });
    }
}
```

### 3. Format des Logs

#### Living Creatures (Enhanced JSON)

```javascript
[LIVING_JSON] {
    "timestamp": "2025-11-05T18:30:45.123Z",
    "typeId": 12345,
    "entity": {
        "name": "Rabbit",
        "tier": 4,
        "enchant": 1,
        "type": "Hide"
    },
    "state": {
        "health": 850,
        "alive": true,
        "rarity": 112
    },
    "validation": {
        "animal": "Rabbit",
        "expectedHP": 850,
        "match": true
    }
}
```

#### Living Resources (CSV)

```
🌱 [HarvestablesHandler] HarvestStart
{
    harvestableId: 67890,
    timestamp: "2025-11-05T18:30:45.123Z"
}
```

#### Debug Enemies (Verbose)

```
[DEBUG_ENEMY] RAW PARAMS | ID=123 TypeID=456 | params[2]=255 (normalized) params[13]=1500 (maxHP) params[19]=112 (rarity)
```

---

## 👨‍💻 Developer Guide v2.2

### Constant Import Patterns

#### 1. Classes (Handlers, Drawings)

```javascript
class MobsHandler {
    constructor(settings) {
        // Import constants in constructor
        const { CATEGORIES, EVENTS } = window;
        this.CATEGORIES = CATEGORIES;
        this.EVENTS = EVENTS;
        this.settings = settings;
    }
    
    NewMobEvent(params) {
        // ✅ v2.2 - Automatic filtering, no if
        window.logger?.debug(this.CATEGORIES.MOB, this.EVENTS.NewMobEvent, {
            id: params[0],
            typeId: params[1]
        });
    }
}
```

#### 2. Local Scope Scripts (Utils.js)

```javascript
// Import at top of module
const { CATEGORIES, EVENTS } = window;

// Direct usage
window.logger?.info(CATEGORIES.WEBSOCKET, EVENTS.Connected, {
    page: 'drawing'
});
```

#### 3. Global Functions (ResourcesHelper.js)

```javascript
function clearCache() {
    // Use window.CATEGORIES directly
    window.logger?.info(window.CATEGORIES.CACHE, window.EVENTS.CacheCleared, {});
}
```

### Adding a New Category/Event

#### 1. Add in LoggerConstants.js

```javascript
const CATEGORIES = {
    // ... existing
    MY_FEATURE: 'MY_FEATURE'
};

const EVENTS = {
    // ... existing
    MyFeatureStart: 'MyFeatureStart',
    MyFeatureEnd: 'MyFeatureEnd'
};

const CATEGORY_SETTINGS_MAP = {
    // ... existing
    MY_FEATURE: 'debugMyFeature', // or null if always logged
};
```

#### 2. Add checkbox in settings.ejs (if new setting)

```html
<label class="flex items-center space-x-2">
  <input 
    type="checkbox" 
    id="settingDebugMyFeature" 
    class="h-5 w-5 text-indigo-600 border-gray-300 rounded-md"
  >
  <span class="text-gray-600 dark:text-gray-300">🆕 Debug My Feature</span>
</label>
```

#### 3. Add event listener in settings.ejs

```javascript
const settingDebugMyFeature = document.getElementById("settingDebugMyFeature");

settingDebugMyFeature.addEventListener("change", function (event) {
  saveToLocalStorage("settingDebugMyFeature", event.target.checked);
});

// Initialize
settingDebugMyFeature.checked = getFromLocalStorage("settingDebugMyFeature") === "true";
```

#### 4. Use in Code

```javascript
// ✅ CORRECT v2.2 - Automatic filtering
window.logger?.debug(this.CATEGORIES.MY_FEATURE, this.EVENTS.MyFeatureStart, {
    data: 'some data'
});

// ❌ INCORRECT v2.2 - DON'T check settings manually
if (this.settings.debugMyFeature && window.logger) {
    window.logger.debug(...); // Unnecessary duplication!
}
```

### Best Practices v2.2

#### ✅ DO

- **Use constants everywhere**: `this.CATEGORIES.MOB`, `this.EVENTS.NewMobEvent`
- **Import in constructor** (classes): `const { CATEGORIES, EVENTS } = window;`
- **Optional chaining**: `window.logger?.debug(...)` instead of `if (window.logger)`
- **No settings check**: Let LoggerClient.shouldLog() filter
- **Add CATEGORY_SETTINGS_MAP**: Define mapping for new categories
- **Guaranteed real-time**: LoggerClient reads localStorage without cache

#### ❌ DON'T

- **DON'T** use hardcoded strings: `'MOB'` → use `CATEGORIES.MOB`
- **DON'T** check settings manually: `if (settings.debugX)` → obsolete in v2.2
- **DON'T** duplicate filtering: LoggerClient.shouldLog() handles it
- **DON'T** forget to import constants: Import required in constructor
- **DON'T** use `console.log()`: Use `window.logger`

#### Migration v2.1 → v2.2

```javascript
// ❌ OLD v2.1
if (this.settings.debugEnemies && window.logger) {
    window.logger.debug('MOB', 'NewMobEvent', {...});
}

// ✅ NEW v2.2
window.logger?.debug(this.CATEGORIES.MOB, this.EVENTS.NewMobEvent, {...});
```

---

## 🔧 Troubleshooting v2.2

### Changes don't take effect

**Symptom:** Checkbox changed but logs don't appear

**Solutions v2.2:**
1. ✅ Check localStorage: `localStorage.getItem("settingDebugEnemies")` = `"true"`?
2. ✅ Check CATEGORY_SETTINGS_MAP: Category → setting mapping exists?
3. ✅ Check LoggerConstants.js: Category/event is defined?
4. ✅ Check console: LoggerClient.shouldLog() returns true?

### Logs don't appear in console

**Symptom:** Setting enabled but nothing in console

**Solutions v2.2:**
1. ✅ Check console level: Warnings/Logs not filtered?
2. ✅ Check radar connected: Handlers not initialized before connection
3. ✅ Check event: Logged action actually occurring?
4. ✅ Check F12: Console open and visible?
5. ✅ Check constants: `window.CATEGORIES` and `window.EVENTS` loaded?

### "Cannot read properties of undefined (reading 'MOB')"

**Symptom:** Error on load

**Solutions v2.2:**
1. ✅ Check layout.ejs: LoggerConstants.js loaded before other scripts?
2. ✅ Check constructor: Import `const { CATEGORIES, EVENTS } = window;` present?
3. ✅ Check timing: Handler instantiated after constants loaded?

### Hardcoded strings detected

**Symptom:** Code still uses `'MOB'` instead of `CATEGORIES.MOB`

**Solutions v2.2:**
1. ✅ Replace all strings with constants
2. ✅ Use global search to find: `window.logger.*(\'[A-Z_]+\'`
3. ✅ Check MCP git diff to ensure everything is migrated

### Download Debug Logs doesn't work

**Symptom:** Button doesn't respond or error

**Solutions:**
1. ✅ Check event listener: `downloadLogsBtn.addEventListener` present?
2. ✅ Check function: `downloadDebugLogs()` defined?
3. ✅ Check console: JavaScript error visible?
4. ✅ Check popup blocker: Browser blocking download?

---

## 📊 Settings Status

### Implemented Settings ✅

| Setting | Interface | localStorage | Settings.js | Handlers |
|---------|-----------|--------------|-------------|----------|
| Log Living Creatures | ✅ | ✅ | ✅ | ✅ MobsHandler |
| Log Living Resources | ✅ | ✅ | ✅ | ✅ HarvestablesHandler |
| Debug Enemies | ✅ | ✅ | ✅ | ✅ MobsHandler |
| Enemies Health Bar | ✅ | ✅ | ✅ | ✅ Drawing |
| Enemies ID | ✅ | ✅ | ✅ | ✅ Drawing |
| Living Resources Health Bar | ✅ | ✅ | ✅ | ✅ Drawing |
| Living Resources ID | ✅ | ✅ | ✅ | ✅ Drawing |

### Old System Removed ❌

| Component | Status | Removal Date |
|-----------|--------|--------------|
| DebugConfig.js | ❌ Removed | 2025-11-05 |
| window.debugLogs | ❌ Removed | 2025-11-05 |
| 15 window.debugLogs references | ❌ Migrated | 2025-11-05 |

---

## 🎯 Future Enhancements

### Short Term
- [ ] Add settings for other entity types (chests, dungeons)
- [ ] Log filters by tier/enchant
- [ ] Export logs to text file

### Medium Term
- [ ] Log visualization interface in the app
- [ ] Logging statistics (event count by type)
- [ ] Log replay for debugging

### Long Term
- [ ] Logging profile system
- [ ] API for external plugins
- [ ] Cloud sync for settings

---

## 📝 Changelog

### v2.2 - 2025-11-06 (NEW)
- ✅ **Centralized constants**: LoggerConstants.js (42 CATEGORIES, 90+ EVENTS)
- ✅ **Centralized filtering**: LoggerClient.shouldLog() - Reads localStorage in real-time
- ✅ **Removed duplication**: ~40+ `if (settings.debugX)` conditions removed
- ✅ **Type-safe**: Replaced ALL strings with constants
- ✅ **Standardized patterns**: Consistent import (classes, scripts, global functions)
- ✅ **CATEGORY_SETTINGS_MAP**: Automatic category → setting mapping
- ✅ **Performance**: Exit early in shouldLog()
- ✅ **KISS compliant**: Ultra-simple handlers, zero filtering logic
- ✅ **15 files refactored**: MobsHandler, HarvestablesHandler, Utils.js, etc.
- ✅ **Complete documentation**: LOGGING.md and DEBUG_LOGGING_GUIDE.md v2.2
- ✅ **MCP Memory**: logging_system_v2.2_constants_refactoring

### v2.1 - 2025-11-06
- ✅ Complete debug category refactoring
- ✅ Removed `logLivingCreatures` → `debugEnemies`
- ✅ Removed `logLivingResources` → `debugHarvestables`
- ✅ Added complete: `debugHarvestables`, `debugFishing`
- ✅ Fixed log consistency (categories, levels, filtering)
- ✅ Removed local alpine.min.js (-27 KB) - CDN used
- ✅ Complete v2.1 documentation

### v2.0 - 2025-11-05
- ✅ Complete centralization in Settings.ejs
- ✅ Dynamic updates without reload
- ✅ Removed old window.debugLogs system
- ✅ HarvestablesHandler migration
- ✅ Complete documentation

### v1.0 - 2025-11-04
- Initial system with distributed checkboxes
- window.debugLogs for technical logs
- No dynamic updates

---

## 📚 References

- **Source Code:**
  - `views/main/settings.ejs` - User interface
  - `scripts/Utils/Settings.js` - State and logic
  - `scripts/Utils/Utils.js` - Initialization and listeners
  - `scripts/Handlers/MobsHandler.js` - Logging usage
  - `scripts/Handlers/HarvestablesHandler.js` - Logging usage

- **Documentation:**
  - `work/DEBUG_LOGGING_GUIDE.md` - This file
  - `docs/technical/LOGGING.md` - Complete technical documentation
  - Memory Serena: `debug-logging-centralization.md`

---

**Maintained by:** OpenRadar Team
**Last updated:** 2025-12-01

