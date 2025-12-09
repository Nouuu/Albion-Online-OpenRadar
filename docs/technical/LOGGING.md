# 📊 Logging & Debug System - OpenRadar v2.2

> **Last update:** 2025-11-06  
> **Version:** 2.2 (Refactored constants & centralized filtering)  
> **Status:** ✅ Implemented and working

---

## 🎯 Goals

OpenRadar uses a centralized, configurable logging system to:

- Give clear visibility into what happens in the radar (players, mobs, harvestables, chests, dungeons, fishing, etc.).
- Make debugging easier without spamming the console.
- Allow **fine-grained filtering** by category (enemies, players, harvestables, etc.).
- Support **structured logs** (JSONL) on the server side.

Version **2.2** introduces:

- ✅ Centralized constants in `LoggerConstants.js` (categories, events, mapping)
- ✅ Centralized filtering in `LoggerClient.shouldLog()`
- ✅ Standardized imports (consistent patterns across the codebase)
- ✅ Real-time settings (no page reload needed)
- ✅ Safer RAW packet filtering (console vs server)
- ✅ Backward-compatible API for `window.logger`

---

## 🧱 Architecture Overview

### Components

- **LoggerClient.js** (client-side)
  - Loaded globally in `views/layout.ejs`.
  - Responsible for:
    - Console logging (with colors & emojis).
    - Buffering and sending logs to the server (via WebSocket) when enabled.
    - Centralized filtering logic.

- **LoggerServer.js** (server-side)
  - Instantiated in `app.js` and exposed as `global.loggerServer`.
  - Writes JSONL session files in `logs/sessions/`.
  - Dedicated error file in `logs/errors/`.

- **LoggerConstants.js**
  - Declares:
    - `CATEGORIES` (MOB, PLAYER, HARVEST, CHEST, DUNGEON, FISHING, PACKET_RAW, etc.)
    - `EVENTS` (NewMobEvent, HarvestStart, LoadMetadata, etc.)
    - `CATEGORY_SETTINGS_MAP` → Mapping from category to user setting (debugEnemies, debugPlayers, debugHarvestables, ...)

- **Settings UI** (`views/main/settings.ejs`)
  - Controls:
    - Display logs in console
    - Send logs to server
    - RAW packets in console
    - RAW packets to server
    - Category-specific debug toggles (enemies, players, harvestables, chests, dungeons, fishing)

---

## 🔣 Constants (LoggerConstants.js)

### Categories

Examples (non-exhaustive):

```javascript
const CATEGORIES = {
  MOB: 'MOB',
  MOB_HEALTH: 'MOB_HEALTH',
  MOB_DRAW: 'MOB_DRAW',

  HARVEST: 'HARVEST',
  HARVEST_HIDE_T4: 'HARVEST_HIDE_T4',

  PLAYER: 'PLAYER',
  PLAYER_HEALTH: 'PLAYER_HEALTH',

  CHEST: 'CHEST',
  DUNGEON: 'DUNGEON',
  FISHING: 'FISHING',

  PACKET_RAW: 'PACKET_RAW',

  WEBSOCKET: 'WEBSOCKET',
  CACHE: 'CACHE',
  ITEM: 'ITEM'
  // ...
};
```

### Events

```javascript
const EVENTS = {
  NewMobEvent: 'NewMobEvent',
  NewMobEvent_ALL_PARAMS: 'NewMobEvent_ALL_PARAMS',
  LoadMetadata: 'LoadMetadata',
  LoadMetadataFailed: 'LoadMetadataFailed',

  HarvestStart: 'HarvestStart',
  NoCacheWarning: 'NoCacheWarning',

  Connected: 'Connected',
  Disconnected: 'Disconnected',

  CacheCleared: 'CacheCleared',

  ItemIdDiscovery: 'ItemIdDiscovery',

  CriticalError: 'CriticalError',
  // ...
};
```

### Category → Setting Mapping

```javascript
const CATEGORY_SETTINGS_MAP = {
  MOB: 'debugEnemies',
  MOB_HEALTH: 'debugEnemies',
  MOB_DRAW: 'debugEnemies',

  HARVEST: 'debugHarvestables',
  HARVEST_HIDE_T4: 'debugHarvestables',

  PLAYER: 'debugPlayers',
  PLAYER_HEALTH: 'debugPlayers',

  CHEST: 'debugChests',
  DUNGEON: 'debugDungeons',
  FISHING: 'debugFishing',

  PACKET_RAW: 'debugRawPackets',

  // Always logged (no setting)
  WEBSOCKET: null,
  CACHE: null,
  ITEM: null,
};
```

---

## 🖥️ Output Formats

### Colored Console Output

```text
🔍 [DEBUG] MOB.NewMobEvent_RAW @ 18:30:45
{id: 12345, typeId: 456, health: 850, position: {x: 100, y: 200}}
(page: /drawing)

ℹ️ [INFO] HARVEST.HarvestStart @ 18:31:12
{harvestableId: 67890, tier: 5, enchantment: 2}
(page: /drawing)

⚠️ [WARN] MOB_HEALTH.HealthUpdate @ 18:32:00
{id: 12345, health: 500, maxHealth: 850}
(page: /drawing)

❌ [ERROR] HARVEST.ItemIdDiscovery @ 18:33:45
{error: "Unknown TypeID", typeId: 99999}
(page: /resources)

🚨 [CRITICAL] MOB.CriticalError @ 18:35:00
{message: "Parser failed", stack: "...}
(page: /drawing)
```

### JSONL Files (Server)

**Location:** `logs/sessions/session_<timestamp>.jsonl`

**Format:**

```jsonl
{"timestamp":"2025-11-05T18:30:45.123Z","level":"DEBUG","category":"MOB","event":"NewMobEvent_RAW","data":{"id":12345,"typeId":456,"health":850},"context":{"sessionId":"session_1730829045123_abc","page":"/drawing"}}
{"timestamp":"2025-11-05T18:31:12.456Z","level":"INFO","category":"HARVEST","event":"HarvestStart","data":{"harvestableId":67890,"tier":5,"enchantment":2},"context":{"sessionId":"session_1730829045123_abc","page":"/drawing","mapId":"ForestA"}}
```

---

## 👤 User Perspective

### Enabling Logging in Settings

1. Open **Settings** → Settings tab in the menu.
2. Scroll to **Debug & Logging** section.
3. Enable the options you need:
   - ✅ **Display logs in console** → See logs in real time (recommended)
   - ✅ **Send logs to server** → Save JSONL files in `logs/sessions/`
   - ⚠️ **RAW packets in console** → Only for deep debugging (VERY VERBOSE!)
   - ⚠️ **RAW packets to server** → Only for deep debugging (VERY VERBOSE!)
4. Open browser console (F12) → see colored logs in real time.
5. Use **Download Debug Logs** button to export a JSON snapshot.

---

## 🧑‍💻 Developer Usage (v2.2)

### Import Patterns for Constants

#### 1. Classes (Handlers, Drawings)

```javascript
class MobsHandler {
  constructor(settings) {
    // Import once in constructor
    const { CATEGORIES, EVENTS } = window;
    this.CATEGORIES = CATEGORIES;
    this.EVENTS = EVENTS;
    this.settings = settings;
  }
  
  someMethod() {
    // Use with this.
    window.logger?.debug(this.CATEGORIES.MOB, this.EVENTS.NewMobEvent, { /* ... */ });
  }
}
```

#### 2. Local-scope Scripts (`Utils.js`, `ItemsPage.js`)

```javascript
// Import at top of module
const { CATEGORIES, EVENTS } = window;

// Use directly (no this.)
window.logger?.info(CATEGORIES.WEBSOCKET, EVENTS.Connected, { /* ... */ });
```

#### 3. Global Functions (`ResourcesHelper.js`)

```javascript
function clearCache() {
  // Use window.CATEGORIES directly
  window.logger?.info(window.CATEGORIES.CACHE, window.EVENTS.CacheCleared, {});
}
```

### Adding Logs in Code (v2.2)

```javascript
// ✅ NEW v2.2 - Use constants + optional chaining
window.logger?.debug(this.CATEGORIES.MOB, this.EVENTS.NewMobEvent, {
  data1: value1,
  data2: value2
}, {
  additionalInfo: 'some context'
});

// ✅ Automatic filtering - no more `if (settings.debugX)`
window.logger?.info(CATEGORIES.HARVEST, EVENTS.HarvestStart, { /* ... */ });

// ❌ OLD v2.1 - Do not use anymore
if (settings.debugEnemies && window.logger) {
  window.logger.debug('MOB', 'EventName', { /* ... */ }); // Deprecated
}
```

### Adding a New Category or Event

**1. Add it in `LoggerConstants.js`:**

```javascript
// Add category
const CATEGORIES = {
  // ... existing
  MY_NEW_CATEGORY: 'MY_NEW_CATEGORY'
};

// Add event
const EVENTS = {
  // ... existing
  MyNewEvent: 'MyNewEvent'
};

// Add mapping if you want filtering
const CATEGORY_SETTINGS_MAP = {
  // ... existing
  MY_NEW_CATEGORY: 'debugMyFeature', // or null if always logged
};
```

**2. Use it in code:**

```javascript
window.logger?.debug(this.CATEGORIES.MY_NEW_CATEGORY, this.EVENTS.MyNewEvent, { /* ... */ });
```

### Automatic Filtering (v2.2)

```javascript
// ✅ No need to manually check settings!
// Filtering is done in LoggerClient.shouldLog()

// DEBUG → Filtered according to CATEGORY_SETTINGS_MAP
window.logger?.debug(this.CATEGORIES.MOB, this.EVENTS.NewMobEvent, { /* ... */ });

// INFO/WARN/ERROR → Always logged
window.logger?.info(CATEGORIES.CACHE, EVENTS.CacheCleared, { /* ... */ });
```

---

## ✅ Best Practices (v2.2)

### 1. Always Use Constants

```javascript
// ✅ CORRECT v2.2
window.logger?.debug(this.CATEGORIES.MOB, this.EVENTS.NewMobEvent, { /* ... */ });

// ❌ INCORRECT - Hardcoded strings
window.logger?.debug('MOB', 'NewMobEvent', { /* ... */ });
```

### 2. Choose the Right Level

**DEBUG** – Technical, verbose details (filtered automatically)

```javascript
window.logger?.debug(this.CATEGORIES.MOB, this.EVENTS.NewMobEvent_ALL_PARAMS, {
  mobId,
  typeId,
  allParameters
});
```

**INFO** – Important actions (ALWAYS logged)

```javascript
window.logger?.info(this.CATEGORIES.MOB, this.EVENTS.LoadMetadata, {
  count: this.metadata.length
});
```

**WARN** – Abnormal situations (ALWAYS logged)

```javascript
window.logger?.warn(this.CATEGORIES.HARVEST, this.EVENTS.NoCacheWarning, {
  note: 'Resource tracking may be incomplete'
});
```

**ERROR** – Critical errors (ALWAYS logged)

```javascript
window.logger?.error(this.CATEGORIES.MOB, this.EVENTS.LoadMetadataFailed, error);
```

### 3. Respect Import Patterns

**Classes:**
```javascript
constructor(settings) {
  const { CATEGORIES, EVENTS } = window;
  this.CATEGORIES = CATEGORIES;
  this.EVENTS = EVENTS;
}
```

**Local scripts:**
```javascript
const { CATEGORIES, EVENTS } = window;
```

**Global functions:**
```javascript
window.CATEGORIES.CACHE;
```

### 4. Do NOT Manually Check Settings

```javascript
// ✅ CORRECT v2.2 - Automatic filtering
window.logger?.debug(this.CATEGORIES.MOB, this.EVENTS.NewMobEvent, { data });

// ❌ INCORRECT v2.2 - Redundant check
if (this.settings.debugEnemies && window.logger) {
  window.logger.debug(/* ... */); // Filtering already handled in LoggerClient
}
```

### 5. Category → Setting Mapping

The system handles mapping automatically:

- MOB, MOB_HEALTH, MOB_DRAW → `debugEnemies`
- HARVEST, HARVEST_HIDE_T4 → `debugHarvestables`
- PLAYER, PLAYER_HEALTH → `debugPlayers`
- CHEST → `debugChests`
- DUNGEON → `debugDungeons`
- FISHING → `debugFishing`
- PACKET_RAW → `debugRawPackets`
- WEBSOCKET, CACHE, ITEM, etc. → **always logged** (`null` mapping)

### 6. Real-Time Behavior

```javascript
// ✅ Checkbox changes take effect immediately
// LoggerClient.shouldLog() reads localStorage on each call (no cache)
// → No page reload required
```

---

## 🔧 Internals

### Centralized Filtering (v2.2)

**`LoggerClient.shouldLog()` – single point of truth:**

```javascript
shouldLog(category, level) {
  // 1. INFO/WARN/ERROR/CRITICAL → always logged
  if (level !== 'DEBUG') return true;
  
  // 2. Get mapping category → setting
  const settingKey = window.CATEGORY_SETTINGS_MAP?.[category];
  
  // 3. No mapping = always logged (WEBSOCKET, CACHE, etc.)
  if (!settingKey) return true;
  
  // 4. Special RAW packets handling (console OR server)
  if (settingKey === 'debugRawPackets') {
    const consoleEnabled = localStorage.getItem('settingDebugRawPacketsConsole') === 'true';
    const serverEnabled = localStorage.getItem('settingDebugRawPacketsServer') === 'true';
    return consoleEnabled || serverEnabled;
  }
  
  // 5. Read setting from localStorage (REAL TIME, no cache)
  const localStorageKey = 'setting' + settingKey.charAt(0).toUpperCase() + settingKey.slice(1);
  return localStorage.getItem(localStorageKey) === 'true';
}
```

**Used inside `log()`:**

```javascript
log(level, category, event, data, context = {}) {
  // ⚡ Exit early if filtered out (performance)
  if (!this.shouldLog(category, level)) return;
  
  // ... rest of logging logic
}
```

**Benefits:**
- ✅ **Real-time**: always reads from localStorage (no cache)
- ✅ **Early exit**: immediate return if log is filtered (performance)
- ✅ **Single place**: all filtering logic is centralized
- ✅ **Simple handlers**: no more `if (settings.debugX)` scattered everywhere

### Offline Mode

The logger works even if the WebSocket server is not available:

- ✅ Console logs always work
- ❌ Server logs are skipped silently (buffer is cleared)
- 📢 Informative console messages: "logs will be console-only"

### RAW Packet Filtering

**Smart logic:**
```javascript
// In log() - server buffering
if (logEntry.category === '[CLIENT] PACKET_RAW' && !debugRawPacketsServer) {
  return; // Skip server logging for RAW packets
}

// In logToConsole() - console output
if (entry.category === '[CLIENT] PACKET_RAW' && !showRawPacketsConsole) {
  return; // Skip console display for RAW packets
}
```

**Result:**
- RAW packets do not pollute normal logs
- Separate enable/disable for console vs server
- Optimal performance when disabled

### Buffer & Flush

```javascript
// Automatic buffer
this.buffer.push(logEntry);

// Flush when buffer is full
if (this.buffer.length >= this.maxBufferSize) {
  this.flush(); // Send to server
}

// Periodic flush (every 5 seconds)
setInterval(() => this.flush(), 5000);
```

---

## ⚠️ Warnings & Limitations

### RAW Packet Debugging

**⚠️ EXTREMELY VERBOSE!**

When enabled, the logger traces **EVERY network packet** captured:

- Can generate 100+ logs per second during fights
- Performance impact if console is open (rendering lots of logs)
- Big JSONL files (several MB per minute)

**Recommendations:**
- ❌ Do NOT enable all the time
- ✅ Enable only to investigate a specific problem
- ✅ Disable it as soon as the analysis is done

### Offline Mode

If the WebSocket server is not available:

- ✅ Console logging works as usual
- ❌ Server logs are ignored (no error, just dropped)
- 📢 Console message: "logs will be console-only"

### Performance

- ✅ No overhead if `settingLogToConsole = false`
- ✅ Smart RAW packets filtering
- ⚠️ Impact if console is open with many logs

---

## 📚 See Also

- `docs/dev/DEV_GUIDE.md` – Project architecture & dev workflow

---

*OpenRadar Logging System v2.2 – Centralized, Configurable, Performant* 🎉
