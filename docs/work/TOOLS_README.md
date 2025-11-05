# 🛠️ Tools - Albion Online ZQRadar

Outils d'analyse et de diagnostic pour le développement du radar.

> 🚀 **Nouveau ?** Commencez par le [Quick Start Guide](QUICK_START.md) pour collecter des TypeIDs immédiatement !

---

## 📂 Structure

```
tools/
├── README.md                          ← Ce fichier
├── COLLECTION_GUIDE.md                ← Guide de collecte TypeIDs
├── parse-living-logs.py               ← Parser de logs JSON
├── analyze-missing-typeids.py         ← Analyse des TypeIDs manquants
├── extract-mob-metadata.py            ← Extraction métadonnées mobs
├── list-living-resources.py           ← Liste ressources vivantes
├── parse-all-resources.py             ← Parse toutes les ressources
├── search-living-mobs.py              ← Recherche mobs vivants
└── output/                            ← Données générées
    ├── living-resources-enhanced.json ← 225 métadonnées créatures (HP, prefabs, factions)
    ├── living-resources-reference.js  ← Module JS de référence
    ├── harvestables-typeids.js        ← TypeIDs items statiques (backpacks, journals)
    ├── all-resources-typeids.json     ← Base de données complète items (JSON)
    ├── all-resources-typeids.csv      ← Base de données complète items (CSV)
    └── ao-bin-dumps-master/           ← Dumps sources (mobs.json, items.txt)
```

---

## 🔧 Scripts Principaux

### 1. `parse-living-logs.py` ⭐ NOUVEAU

**Objectif :** Parser les logs de collecte de TypeIDs

**Usage :**
```bash
python parse-living-logs.py logs-session-2025-11-03.txt
```

**Sortie :**
- Résumé des TypeIDs collectés
- Statistiques de validation HP
- Analyse de couverture (enchantements manquants)
- Entrées MobsInfo.js prêtes à copier

**Exemple :**
```
📊 LIVING RESOURCES COLLECTION REPORT
═════════════════════════════════════

🔢 Total logs: 150
🆔 Unique TypeIDs: 25

TypeID 425 → hide T4.0 | Boar ✓ | 🟢 45 🔴 12
TypeID 426 → hide T4.1 | Unknown | 🟢 12 🔴 3

📝 MobsInfo.js Entries:
    426: [4, EnemyType.LivingSkinnable, "Hide", 1],
    ...
```

---

### 2. `analyze-missing-typeids.py`

**Objectif :** Analyser les TypeIDs manquants dans MobsInfo.js

**Usage :**
```bash
python analyze-missing-typeids.py
```

**Sortie :**
- Liste des TypeIDs non mappés
- Analyse des collisions potentielles
- Recommandations d'amélioration

---

### 3. `extract-mob-metadata.py`

**Objectif :** Extraire métadonnées des mobs depuis ao-bin-dumps

**Usage :**
```bash
python extract-mob-metadata.py path/to/ao-bin-dumps/mobs.json
```

**Sortie :**
- `living-resources-enhanced.json` : Métadonnées complètes
- `living-resources-reference.js` : Module JS utilisable

**Données extraites :**
- HP par créature
- Prefab (nom interne)
- Faction
- Tier
- Enchantement

---

### 4. `list-living-resources.py`

**Objectif :** Lister toutes les ressources vivantes

**Usage :**
```bash
python list-living-resources.py
```

**Sortie :**
- Liste par type (Hide, Fiber, Wood...)
- Liste par tier
- Liste par faction

---

## 📊 Données de Référence

### `output/living-resources-enhanced.json`

**225 métadonnées de créatures** extraites d'ao-bin-dumps

**Format :**
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

**Usage dans le code :**
```javascript
// Chargé automatiquement par MobsHandler.js
const metadata = this.findCreatureMetadata(tier, resourceType, hp);
if (metadata) {
    console.log(`Animal: ${metadata.animal}, Expected HP: ${metadata.hp}`);
}
```

---

### `output/harvestables-typeids.js`

**TypeIDs d'items statiques liés au gathering** (backpacks, journals, fragments)

⚠️ **Important** : Ce ne sont **PAS** les TypeIDs des ressources harvestables elles-mêmes (arbres, rochers, fibres), mais les **items** associés au gathering (équipement, trophées).

**Format :**
```javascript
// WOOD Items
913, // T1.0 - Rough Logs
11734, // T2.0 - Novice Lumberjack's Trophy Journal (Full)
5908, // T4.1 - Adept's Lumberjack Backpack
...

// ORE Items
11762, // T2.0 - Novice Prospector's Trophy Journal (Full)
5708, // T4.1 - Adept's Miner Backpack
...
```

**Utilité :**
- Référence pour les items de gathering
- Pas utilisé pour la détection des ressources sur le radar
- Les vrais TypeIDs harvestables sont collectés in-game via logging

---

## 🎯 Workflow de Collecte

### Étape 1 : Préparation

1. Lire [`COLLECTION_GUIDE.md`](COLLECTION_GUIDE.md)
2. Vider le cache TypeID
3. Activer le logging enrichi

### Étape 2 : Session in-game

1. Se déplacer dans les zones cibles
2. Tuer des créatures enchantées
3. Observer les logs dans la console

### Étape 3 : Analyse

1. Sauvegarder les logs console
2. Exécuter `parse-living-logs.py`
3. Vérifier la couverture

### Étape 4 : Intégration

1. Copier les entrées MobsInfo.js générées
2. Mettre à jour `scripts/classes/MobsInfo.js`
3. Tester avec le radar

---

## 📝 Notes Techniques

### Métadonnées Living Resources

**Source :** ao-bin-dumps `mobs.json`

**Limitations :**
- ❌ Pas de TypeIDs (identifiants serveur runtime)
- ✅ HP par créature
- ✅ Prefab (nom interne)
- ✅ Faction/famille

**Utilité :**
- Validation HP en temps réel
- Identification automatique des animaux
- Détection des anomalies

### TypeIDs Collectés

**Méthode actuelle :** In-game logging (seule méthode viable)

**Raison :**
- TypeIDs = identifiants serveur dynamiques
- Non présents dans les dumps statiques
- Varient selon l'enchantement

**Preuve :**
Voir [DEV_NOTES.md § Investigation TypeIDs](../DEV_NOTES.md#-investigation-typeids---ao-bin-dumps-2025-11-03)

---

## 🔬 Scripts d'Analyse (ao-bin-dumps)

### `parse-all-resources.py`

Parse toutes les ressources depuis les dumps

**Usage :**
```bash
python parse-all-resources.py path/to/ao-bin-dumps/
```

### `search-living-mobs.py`

Recherche mobs vivants spécifiques

**Usage :**
```bash
python search-living-mobs.py --tier 4 --type hide
```

---

## 🤝 Contribuer

### Ajouter un nouveau script

1. Créer `tools/mon-script.py`
2. Documenter dans ce README
3. Ajouter exemples d'utilisation

### Améliorer les données

1. Collecte in-game avec logging
2. Parser avec `parse-living-logs.py`
3. Soumettre les TypeIDs collectés

---

## 📚 Références

- **Guide de collecte :** [`COLLECTION_GUIDE.md`](COLLECTION_GUIDE.md)
- **Documentation technique :** [`../DEV_NOTES.md`](../DEV_NOTES.md)
- **Investigation TypeIDs :** [DEV_NOTES.md § Investigation](../DEV_NOTES.md#-investigation-typeids---ao-bin-dumps-2025-11-03)

---

**Dernière mise à jour :** 2025-11-03

