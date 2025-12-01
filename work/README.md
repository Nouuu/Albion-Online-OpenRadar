# 🔧 work/ - Developer Workspace

> **Working directory** for utility scripts and development data  
> **Git:** Versioned (except `ao-bin-dumps-master/`)

---

## 🎯 Purpose

This directory contains **tools and data required for OpenRadar development**:
- Python scripts to analyze logs and TypeIDs
- Official Albion Online dumps (data sources)
- Generated data (TypeID databases, metadata)

---

## 📁 Structure

```
work/
├── README.md                          ← This file
├── .gitignore                         ← Ignores only ao-bin-dumps-master/
│
├── 🗂️ data/                           ← Source and generated data
│   ├── ao-bin-dumps-master/          ⭐ Official Albion dumps (git-ignored)
│   ├── living-resources.json         ← 225 creature metadata entries
│   └── all-typeids.json              ← Complete TypeID database
│
└── 🐍 scripts/                        ← Python utility scripts
    ├── parse-living-logs.py          ⭐ Parse collection logs
    ├── analyze-typeids.py            ← Analyze missing TypeIDs
    └── extract-metadata.py           ← Extract mob metadata
```

---

## 🐍 Python Scripts

### parse-living-logs.py ⭐
Parse TypeID collection logs

```bash
python work/scripts/parse-living-logs.py logs-session-2025-11-05.txt
```

### analyze-typeids.py
Analyze missing TypeIDs in `MobsInfo.js`

```bash
python work/scripts/analyze-typeids.py
```

### extract-metadata.py
Extract mob metadata from official dumps

```bash
python work/scripts/extract-metadata.py
```

---

## 🗂️ Data Files

### ao-bin-dumps-master/ ⭐
Official Albion Online data dumps
- **Source:** https://github.com/ao-data/ao-bin-dumps
- **Content:** `mobs.json`, `items.txt`, etc.
- **Usage:** Reference for TypeIDs and metadata
- **Setup:** `git clone https://github.com/ao-data/ao-bin-dumps.git work/data/ao-bin-dumps-master`

### living-resources.json
225 creature metadata entries (HP, prefabs, factions)

### all-typeids.json
Complete TypeID → Item/Resource database

---

## 📚 Complete Documentation

For detailed script usage guides:
👉 **`docs/work/` - Complete guides**

---

## ⚠️ Important

- **This directory is versioned in git** ✅
- **Exception:** `data/ao-bin-dumps-master/` is git-ignored (too large)
- Python scripts and JSON data are included in commits
- New developers must download `ao-bin-dumps-master/` manually:
  ```bash
  git clone https://github.com/ao-data/ao-bin-dumps.git work/data/ao-bin-dumps-master
  ```


