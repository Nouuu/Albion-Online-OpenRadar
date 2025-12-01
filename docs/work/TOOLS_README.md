# 🛠 Work Tools – Python Utilities for OpenRadar

> **Purpose:** Analysis and diagnostic tools for radar development.  
> **Folder:** `work/` (git-ignored except README)

---

## 📌 Available Scripts (work/scripts/)

### ⭐ 1. `parse-living-logs.py`

**Goal:** Parse enriched logs for living resource TypeIDs.

**Usage:**

```bash
cd work/scripts
python parse-living-logs.py ../logs-session-2025-11-05.txt
```

**Output:**

- Summary of collected TypeIDs.
- HP validation statistics.
- Coverage analysis (missing enchantments).
- `MobsInfo.js` entries ready to copy.

Example report:

```text
📊 LIVING RESOURCES COLLECTION REPORT
══════════════════════════════════════

🔢 Total logs: 150
Ⓜ Unique TypeIDs: 25

TypeID 425 → hide T4.0 | Boar ✓ | 🟢 45 🔴 12
TypeID 426 → hide T4.1 | Unknown | 🟢 12 🔴 3

📝 MobsInfo.js Entries:
    426: [4, EnemyType.LivingSkinnable, "Hide", 1],
    ...
```

---

### 2. `analyze-typeids.py`

**Goal:** Analyze which TypeIDs are missing in `MobsInfo.js`.

**Usage:**

```bash
cd work/scripts
python analyze-typeids.py
```

**Output:**

- List of unmapped TypeIDs.
- Potential collision analysis.
- Suggestions for improvements.

---

### 3. `extract-metadata.py`

**Goal:** Extract mob metadata from `ao-bin-dumps`.

**Usage:**

```bash
cd work/scripts
python extract-metadata.py ../data/ao-bin-dumps-master/mobs.json
```

**Output:**

- `living-resources-enhanced.json` – Complete creature metadata.
- `living-resources-reference.js` – Usable JS module.

**Extracted data includes:**

- HP per creature.
- Prefab (internal name).
- Faction.
- Tier.
- Inferred enchantment hints.

---

### 4. `list-living-resources.py`

**Goal:** List all living resources.

**Usage:**

```bash
cd work/scripts
python list-living-resources.py
```

**Output:**

- Lists by type (Hide, Fiber, Wood, etc.).
- Lists by tier.
- Lists by faction.

---

## 📚 Reference Data

### `output/living-resources-enhanced.json`

**225 creature metadata entries** extracted from ao-bin-dumps.

**Format:**

```json
{
  "animal": "Boar",
  "tier": 4,
  "enchant": 0,
  "prefab": "MOB_HIDE_BOAR_01",
  "hp": 1323,
  "faction": "BOAR"
}
```

**Usage in code:**

```javascript
// Loaded automatically by MobsHandler.js
const metadata = this.findCreatureMetadata(tier, resourceType, hp);
if (metadata) {
  console.log(`Animal: ${metadata.animal}, Expected HP: ${metadata.hp}`);
}
```

---

### `output/harvestables-typeids.js`

**Static item TypeIDs related to gathering** (backpacks, journals, fragments).

⚠ **Important:** These are **not** the TypeIDs of harvestable nodes themselves (trees, rocks, fibers), but the **items** associated with gathering.

**Format:**

```javascript
// WOOD items
913,   // T1.0 - Rough Logs
11734, // T2.0 - Novice Lumberjack's Trophy Journal (Full)
5908,  // T4.1 - Adept's Lumberjack Backpack
...

// ORE items
11762, // T2.0 - Novice Prospector's Trophy Journal (Full)
5708,  // T4.1 - Adept's Miner Backpack
...
```

**Use:**

- Reference for gathering-related items.  
- **Not** used directly for radar resource detection.  
- Real harvestable TypeIDs are collected in-game via logging.

---

## 🔁 Collection Workflow (Legacy)

> Note: Thanks to the rarity-based enchantment detection, collecting enchanted TypeIDs is mostly obsolete. Workflow kept for reference.

### Step 1: Preparation

1. Read [`COLLECTION_GUIDE.md`](./COLLECTION_GUIDE.md).
2. Clear any previous TypeID cache.
3. Enable enriched logging.

### Step 2: In-Game Session

1. Move to target zones.
2. Kill enchanted creatures.
3. Watch logs in the browser console.

### Step 3: Analysis

1. Save console logs.
2. Run `parse-living-logs.py`.
3. Check coverage.

### Step 4: Integration

1. Copy generated `MobsInfo.js` entries.
2. Update `scripts/classes/MobsInfo.js`.
3. Test with the radar.

---

## 🧠 Technical Notes

### Living Resources Metadata

**Source:** `ao-bin-dumps` `mobs.json`.

**Limitations:**

- ❌ No TypeIDs (server runtime identifiers only).  
- ✅ HP per creature.  
- ✅ Prefab names.  
- ✅ Faction/family.

**Use:**

- Real-time HP validation.
- Automatic animal identification.
- Anomaly detection.

### Collected TypeIDs

**Current method:** In-game logging (the only viable method).

**Reason:**

- TypeIDs = dynamic server identifiers.  
- Not present as-is in static dumps.  
- Vary with enchantment in some contexts.

---

## 🧪 Additional Analysis Scripts

### `parse-all-resources.py`

Parse all resources from dumps.

```bash
cd work/scripts
python parse-all-resources.py ../data/ao-bin-dumps-master/
```

### `search-living-mobs.py`

Search for specific living mobs.

```bash
cd work/scripts
python search-living-mobs.py --tier 4 --type hide
```

---

## 🤝 Contributing

### Add a New Script

1. Create `work/scripts/my-script.py`.
2. Document it in this README.
3. Add usage examples.

### Improve Data

1. Collect in-game logs with enriched logging.
2. Parse with `parse-living-logs.py`.
3. Contribute any new insights/TypeIDs via PR or docs.

---

## 📚 Related Documentation

- **Collection guide:** [`COLLECTION_GUIDE.md`](./COLLECTION_GUIDE.md)
- **Technical notes:** see `docs/technical/LOGGING.md` and `docs/technical/ENCHANTMENTS.md`.
- **Player system:** `docs/technical/PLAYERS.md`

---

_Last updated: 2025-11-03_
