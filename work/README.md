# 🔧 work/ - Zone de Travail Développeur

> **Dossier de travail** pour scripts utilitaires et données de développement  
> **Git:** Versionné (sauf `ao-bin-dumps-master/`)

---

## 🎯 Objectif

Ce dossier contient les **outils et données nécessaires au développement** de ZQRadar :
- Scripts Python pour analyser les logs et TypeIDs
- Dumps officiels Albion Online (sources de données)
- Données générées (bases TypeIDs, métadonnées)

---

## 📁 Structure

```
work/
├── README.md                          ← Ce fichier
├── .gitignore                         ← Ignore seulement ao-bin-dumps-master/
│
├── 🗂️ data/                           ← Données sources et générées
│   ├── ao-bin-dumps-master/          ⭐ Dumps officiels Albion (git-ignoré)
│   ├── living-resources.json         ← 225 métadonnées créatures
│   └── all-typeids.json              ← Base complète TypeIDs
│
└── 🐍 scripts/                        ← Scripts Python utilitaires
    ├── parse-living-logs.py          ⭐ Parser logs de collecte
    ├── analyze-typeids.py            ← Analyser TypeIDs manquants
    └── extract-metadata.py           ← Extraire métadonnées mobs
```

---

## 🐍 Scripts Python

### parse-living-logs.py ⭐
Parser les logs de collecte de TypeIDs

```bash
python work/scripts/parse-living-logs.py logs-session-2025-11-05.txt
```

### analyze-typeids.py
Analyser les TypeIDs manquants dans `MobsInfo.js`

```bash
python work/scripts/analyze-typeids.py
```

### extract-metadata.py
Extraire les métadonnées des mobs depuis les dumps officiels

```bash
python work/scripts/extract-metadata.py
```

---

## 🗂️ Données

### ao-bin-dumps-master/ ⭐
Dumps officiels d'Albion Online
- **Source:** https://github.com/ao-data/ao-bin-dumps
- **Contenu:** `mobs.json`, `items.txt`, etc.
- **Utilité:** Référence pour TypeIDs et métadonnées
- **Setup:** `git clone https://github.com/ao-data/ao-bin-dumps.git work/data/ao-bin-dumps-master`

### living-resources.json
225 métadonnées de créatures (HP, prefabs, factions)

### all-typeids.json
Base de données complète TypeID → Item/Resource

---

## 📚 Documentation Complète

Pour plus de détails sur l'utilisation des scripts :
👉 **`docs/work/` - Guides complets**

---

## ⚠️ Important

- **Ce dossier est versionné dans git** ✅
- **Exception:** `data/ao-bin-dumps-master/` est git-ignoré (trop volumineux)
- Les scripts Python et données JSON sont inclus dans les commits
- Nouveaux développeurs doivent télécharger `ao-bin-dumps-master/` manuellement:
  ```bash
  git clone https://github.com/ao-data/ao-bin-dumps.git work/data/ao-bin-dumps-master
  ```


