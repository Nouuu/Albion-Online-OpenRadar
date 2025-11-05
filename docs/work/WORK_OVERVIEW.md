# 🛠️ Scripts Utilitaires - ZQRadar

> **Documentation des scripts Python utilitaires**  
> **Dossier:** `work/` (git-ignoré sauf README)

---

## 📋 Scripts Disponibles (work/scripts/)

### 🌟 Scripts Principaux

#### 1. `parse-living-logs.py` ⭐
**Objectif:** Parser les logs de collecte de TypeIDs

**Usage:**
```bash
python work/scripts/parse-living-logs.py logs-session-2025-11-05.txt
```

**Sortie:**
- Résumé des TypeIDs collectés
- Statistiques de validation HP
- Analyse de couverture (enchantements manquants)
- Entrées `MobsInfo.js` prêtes à copier

---

#### 2. `analyze-typeids.py`
**Objectif:** Analyser les TypeIDs manquants dans `MobsInfo.js`

**Usage:**
```bash
python work/scripts/analyze-typeids.py
```

**Sortie:**
- Liste des TypeIDs non mappés
- Analyse des collisions potentielles
- Recommandations

---

#### 3. `extract-metadata.py`
**Objectif:** Extraire les métadonnées des mobs depuis les dumps officiels

**Usage:**
```bash
python work/scripts/extract-metadata.py
```

**Génère:** `work/data/living-resources.json` (225 créatures)

---

## 📁 Structure du Dossier work/

```
work/
├── README.md                          ✅ Documentation
├── .gitignore                         ✅ Tout ignoré sauf README
├── data/                              ← Données sources et générées
│   ├── ao-bin-dumps-master/          ⭐ Dumps officiels Albion
│   ├── living-resources.json         ← 225 métadonnées créatures
│   └── all-typeids.json              ← Base complète TypeIDs
└── scripts/                           ← Scripts Python utilitaires
    ├── parse-living-logs.py          ⭐ Parser logs
    ├── analyze-typeids.py            ← Analyser TypeIDs
    └── extract-metadata.py           ← Extraire métadonnées
```

---

## 🗂️ Données (work/data/)

### ao-bin-dumps-master/ ⭐
Dumps officiels d'Albion Online
- **Source:** https://github.com/ao-data/ao-bin-dumps
- **Contenu:** `mobs.json`, `items.txt`, etc.
- **Utilité:** Référence pour TypeIDs et métadonnées

### living-resources.json
225 métadonnées de créatures (HP, prefabs, factions)

### all-typeids.json
Base de données complète TypeID → Item/Resource

---

## 🎯 Workflows Courants

### Workflow 1: Collecter de nouveaux TypeIDs

1. **Activer le logging dans le jeu**
   - Settings → Debug → "Log Living Creatures"
   
2. **Farmer des ressources vivantes**
   - Tuer des créatures de différents tiers
   - Les logs s'enregistrent automatiquement

3. **Parser les logs**
   ```bash
   python work/scripts/parse-living-logs.py logs-session-2025-11-05.txt
   ```

4. **Copier les entrées dans `MobsInfo.js`**

---

### Workflow 2: Mettre à jour les bases de données

```bash
# Extraire les métadonnées des mobs
python work/scripts/extract-metadata.py

# Les données sont dans work/data/
```

---

## 📖 Guides Détaillés

### Pour Collecter des TypeIDs
👉 **[COLLECTION_GUIDE.md](./COLLECTION_GUIDE.md)**
- Guide complet de collecte
- Méthode de validation
- Templates et exemples

### Pour Démarrer Rapidement
👉 **[QUICK_START.md](./QUICK_START.md)**
- Setup rapide
- Premiers pas
- Commandes essentielles

---

## 🔄 Migration tools/ → work/ (2025-11-05)

**Changements:**
- ✅ Dossier `tools/` supprimé
- ✅ Dossier `work/` créé avec seulement l'essentiel
- ✅ 3 scripts Python principaux conservés (au lieu de 8)
- ✅ Données essentielles dans `work/data/`
- ✅ Documentation mise à jour

**Fichiers conservés:**
- `work/scripts/parse-living-logs.py` ⭐
- `work/scripts/analyze-typeids.py`
- `work/scripts/extract-metadata.py`
- `work/data/ao-bin-dumps-master/` ⭐
- `work/data/living-resources.json`
- `work/data/all-typeids.json`

**Philosophie:**
Le dossier `work/` contient **uniquement l'essentiel** pour le développement, contrairement à l'ancien `tools/` qui accumulait beaucoup de scripts redondants.

---

## ⚠️ Notes Importantes

### Dossier work/ Git-Ignoré
- Le dossier `work/` est git-ignoré (sauf README.md et .gitignore)
- **Raison:** Contient des scripts utilitaires et données volumineuses
- **Documentation:** Dans `docs/work/` pour référence

### Régénération des Données
Tous les fichiers dans `work/data/` peuvent être régénérés :
```bash
python work/scripts/extract-metadata.py
```

### Sources Officielles
`work/data/ao-bin-dumps-master/` contient les dumps officiels d'Albion Online:
- **Source:** https://github.com/ao-data/ao-bin-dumps
- **Mise à jour:** Manuellement quand une nouvelle version du jeu sort

---

## 🔗 Liens Utiles

- **Documentation principale:** `docs/README.md`
- **Système de logging:** `docs/technical/LOGGING.md`
- **Enchantements:** `docs/technical/ENCHANTMENTS.md`
- **TODOs:** `docs/project/TODO.md`

---

*Scripts Python utilitaires pour le développement de ZQRadar*

