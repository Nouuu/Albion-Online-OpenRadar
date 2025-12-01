# 🗂 Work Folder Overview – OpenRadar

> **Folder:** `work/` (git-ignored except this README and `.gitignore`)

The `work/` folder contains **development-time tools and data** used to analyze Albion Online dumps, collect TypeIDs, and generate reference files for OpenRadar.

---

## 📁 Structure of `work/`

```text
work/
├── README.md                          ✅ Documentation
├── .gitignore                         ✅ Ignore everything except README
├── data/                              ← Source and generated data
│   ├── ao-bin-dumps-master/           ★ Official Albion dumps
│   ├── living-resources.json          ← 225 creature metadata records
│   └── all-typeids.json               ← Complete TypeID database
└── scripts/                           ← Utility Python scripts
    ├── parse-living-logs.py           ★ Parse logs
    ├── analyze-typeids.py             ← Analyze TypeIDs
    └── extract-metadata.py            ← Extract metadata
```

---

## 📊 Data Files (work/data/)

### 1. `ao-bin-dumps-master/` ★

Official Albion Online dumps.

- **Source:** https://github.com/ao-data/ao-bin-dumps
- **Contents:** `mobs.json`, `items.txt`, etc.
- **Use:** Reference for TypeIDs and metadata.

### 2. `living-resources.json`

225 living resource metadata entries (animals, guardians, etc.).

- HP per creature.
- Prefab (internal name).
- Faction.
- Tier.
- (Optional) inferred enchantment hints.

### 3. `all-typeids.json`

Complete mapping TypeID → Item/Resource static information.

- Used during earlier investigations for coverage and collisions.

---

## 🧪 Python Utility Scripts (work/scripts/)

### 1. `parse-living-logs.py` ★

**Goal:** Parse enriched logging output to collect living resource TypeIDs.

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

---

### 2. `analyze-typeids.py`

**Goal:** Analyze missing TypeIDs in `MobsInfo.js`.

**Usage:**

```bash
cd work/scripts
python analyze-typeids.py
```

**Output:**

- List of unmapped TypeIDs.
- Analysis of potential collisions.
- Suggestions for improvements.

---

### 3. `extract-metadata.py`

**Goal:** Extract mob metadata from official dumps.

**Usage:**

```bash
cd work/scripts
python extract-metadata.py
```

**Generates:**

- `work/data/living-resources.json` (225 creatures).

---

## 🔄 Typical Workflows

### Workflow 1: Collect New TypeIDs (Legacy)

> Note: With the rarity-based enchantment formula, collecting enchanted TypeIDs is mostly obsolete, but the workflow is kept here for historical reference.

1. **Enable logging in-game**
   - Settings → Debug → "Log Living Creatures".

2. **Farm living resources**
   - Kill creatures of various tiers.
   - Logs are recorded in the browser console.

3. **Parse logs**

   ```bash
   cd work/scripts
   python parse-living-logs.py ../logs-session-YYYY-MM-DD.txt
   ```

4. **Update `MobsInfo.js`**
   - Copy the generated entries.

### Workflow 2: Update Metadata from Dumps

```bash
cd work/scripts
python extract-metadata.py ../data/ao-bin-dumps-master/mobs.json
```

- Reads `ao-bin-dumps-master/`.
- Regenerates `living-resources.json`.

### Workflow 3: Analyze TypeID Coverage

```bash
cd work/scripts
python analyze-typeids.py
```

- Shows which TypeIDs are still not mapped in `MobsInfo.js`.
- Helps target in-game collection (if still needed).

---

## ⚠️ Important Notes

### `work/` is Git-Ignored

- `work/` is ignored by Git (except `README.md` and `.gitignore`).
- **Reason:** Contains temporary data and heavy files.
- All permanent documentation lives under `docs/`.

### Data is Regenerable

All files under `work/data/` can be regenerated from:

- Official dumps (`ao-bin-dumps-master/`).
- Python scripts in `work/scripts/`.

Example:

```bash
cd work/scripts
python extract-metadata.py ../data/ao-bin-dumps-master/mobs.json
```

### Official Sources

`work/data/ao-bin-dumps-master/` should be updated manually when a new game version is released.

---

## 🔗 Useful Links

- Main docs: `docs/README.md`
- Logging system: `docs/technical/LOGGING.md`
- Enchantments details: `docs/technical/ENCHANTMENTS.md`
- TypeID collection guide: `docs/work/COLLECTION_GUIDE.md`

---

_This overview explains the purpose and structure of the `work/` folder used during OpenRadar development._
