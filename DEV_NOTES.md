# 📝 DEV NOTES - Living Resources Detection

**Dernière mise à jour**: 2025-11-01  
**État du projet**: Phase 1 & 2 TERMINÉES ✅ | Code production-ready

---

## 📊 ÉTAT ACTUEL

### ✅ Ce qui fonctionne
- **Hide Detection**: 100% (TypeID 421/423/425/427)
- **Cache localStorage**: Fonctionnel avec boutons Clear/Show
- **Cross-référence**: Harvestables → Mobs opérationnel
- **Filtrage settings**: Par Tier & Enchantement
- **Icon loading**: Robuste avec fallback cercle bleu
- **Logs JSON**: Format NDJSON uniquement (simplifié)

### ⚠️ Limitations connues
- **Fiber detection**: Partielle (~60%)
  - Cause: Bug serveur Albion (envoie typeNumber=16 Hide au lieu de 14 Fiber)
  - TypeID 530/531 = Fiber mais jeu dit Hide
  - Solution: EventNormalizer (Phase 3)

- **TypeID 65535**: Blacklisté du cache
  - ID générique instable (oscille Fiber↔Wood↔Hide)
  - Utilisé pour cadavres transitoires uniquement
  - Ne déclanche pas NewMobEvent pour spawns vivants

### ❌ Nécessite Phase 3 (EventNormalizer)
- Race conditions SPAWN vs STATIC
- Données incorrectes du jeu
- TypeID partagés/transitoires
- Heuristiques globales

---

## 🗂️ ARCHITECTURE

### Flux de données

```
LIVING RESOURCES (spawns vivants):
NewMobEvent → MobsHandler.AddEnemy()
    ↓
Classification (mobinfo > staticInfo > default)
    ↓
Filtrage par settings utilisateur
    ↓
MobsDrawing → Affichage radar


STATIC RESOURCES (cadavres):
HarvestablesHandler.newHarvestableObject()
    ↓
registerStaticResourceTypeID(typeId, typeNumber, tier)
    ↓
Cache localStorage (sauf TypeID 65535)
    ↓
Cross-référence pour spawns futurs
```

### Système de priorité (3-tier)

1. **Priority 1**: `mobinfo[typeId]` (database)
2. **Priority 2**: `staticResourceTypeIDs.get(typeId)` (cross-reference)
3. **Priority 3**: Default (EnemyType.Enemy)

### Cache localStorage

**Clé**: `cachedStaticResourceTypeIDs`  
**Format**: `[[typeId, {type, tier}], ...]`  
**Blacklist**: TypeID 65535 (filtré au save/load)

---

## 🔧 FICHIERS PRINCIPAUX

### Handlers
- `scripts/Handlers/MobsHandler.js` (359 lignes)
  - AddEnemy() : Classification living resources
  - registerStaticResourceTypeID() : Cross-référence
  - Cache localStorage : save/load/clear/show

- `scripts/Handlers/HarvestablesHandler.js`
  - addHarvestable() : Appelle registerStaticResourceTypeID()
  - Cross-référence AVANT filtrage settings

### Settings
- `scripts/Utils/Settings.js`
  - logLivingResources : Toggle logs JSON
  - harvestingLiving{Type} : Filtres par type/tier/enchant

### UI
- `views/main/resources.ejs`
  - Checkboxes filtrage living resources
  - Bouton Clear TypeID Cache

- `views/main/drawing.ejs`
  - Boutons Clear/Show TypeID Cache (radar)

---

## 📋 TypeID MAPPINGS CONFIRMÉS

| TypeID | Type  | Tier | Source          | Notes                    |
|--------|-------|------|-----------------|--------------------------|
| 421    | Hide  | 1    | Terrain ✅      | Fonctionne parfaitement  |
| 423    | Hide  | 3    | Terrain ✅      | Fonctionne parfaitement  |
| 425    | Hide  | 4    | Terrain ✅      | Fonctionne parfaitement  |
| 427    | Hide  | 5    | Terrain ✅      | Fonctionne parfaitement  |
| 530    | Fiber | 4    | User report ⚠️  | Jeu envoie typeNumber=16 (Hide!) |
| 531    | Fiber | 5    | User report ⚠️  | Jeu envoie typeNumber=16 (Hide!) |
| 65535  | Mixed | Var  | Transitoire ❌  | Blacklisté (instable)    |

---

## 🧪 TESTS

### Tests disponibles
```bash
node test_consolidated_detection.js  # Test 3-tier priority
node test_invalid_typeids.js         # Test filtrage TypeID 0/65535
node test_mobshandler.js             # Test général
```

### Résultats
- ✅ 3/3 tests PASS
- ✅ JSON correctement structuré
- ✅ Cache fonctionne (erreurs localStorage normales en Node.js)

---

## 🚀 PROCHAINES ÉTAPES

### Court terme (FAIT ✅)
- ✅ Phase 1: Infrastructure & cross-référence
- ✅ Phase 2: UI & filtrage
- ✅ Code propre sans workarounds
- ✅ Cache localStorage
- ✅ Documentation consolidée

### Moyen terme (Phase 3 - NÉCESSAIRE)
**EventNormalizer**: Refactoring architectural
- Buffer temporel 300ms pour résoudre race conditions
- Centralisation des décisions
- Heuristiques globales cohérentes
- Métriques override_rate
- Feature flag pour rollout progressif

### Long terme
- Documenter autres living resources (Wood, Ore, Rock)
- Enrichir MobsInfo.js avec TypeID confirmés
- Tuning heuristics (health thresholds)
- Monitoring qualité détection

---

## 📝 CHANGELOG

### 2025-11-01
- ✅ **Nettoyage complet**: Retiré tous overrides manuels et heuristiques complexes
- ✅ **Suppression human-readable**: Logs JSON/NDJSON uniquement
- ✅ **Cache localStorage**: Implémenté avec boutons Clear/Show
- ✅ **Documentation**: Consolidée en un seul fichier (ce document)

### 2025-10-30
- ✅ Phase 1 & 2 implémentées
- ✅ Cross-référence Harvestables → Mobs
- ✅ Filtrage par settings utilisateur
- ✅ Icon loading robuste

---

## 🐛 BUGS CONNUS

### Bug serveur Albion Online
**TypeID 530/531 envoyés avec typeNumber incorrect**:
- Fiber T4 (530) → typeNumber=16 (Hide) au lieu de 14 (Fiber)
- Fiber T5 (531) → typeNumber=16 (Hide) au lieu de 14 (Fiber)

**Impact**: 
- Cache peut enregistrer Fiber comme Hide
- Détection partielle des Fiber vivants

**Workaround actuel**: 
- Aucun (code propre sans pansements)
- Attendre EventNormalizer (Phase 3)

---

## 🧪 PROTOCOLE DE TEST FIBER/HIDE

### Préparation
1. Radar ouvert → **🗑️ Clear TypeID Cache**
2. Recharger page (F5)
3. Settings > Resources → ✅ **"🔍 Log Living Resources to Console"**

### Test
1. Zone Fiber/Hide T3-T5
2. Tuer 5+ Fiber et 5+ Hide
3. Observer comportement

### Récupération logs
1. Console (F12) → Ctrl+A → Ctrl+C
2. Console → `localStorage.getItem('cachedStaticResourceTypeIDs')`
3. Copier résultat
4. M'envoyer tout

---

## 🧪 PROTOCOLE DE TEST - MobsInfo_Enriched

### Objectif
Valider que les 230 TypeIDs détectent correctement les living resources (Fiber surtout)

### Préparation
1. Radar ouvert → **🗑️ Clear TypeID Cache**
2. Recharger page (F5)
3. Settings > Resources → ✅ **"🔍 Log Living Resources to Console"**
4. Console (F12) → vérifier log: `[Utils] 📊 Merged moblist: ... TypeIDs`

### Test rapide (5-10 min)
1. **Zone T3-T5 Fiber/Hide** (Steppes, Forest)
2. **Tuer 3+ Fiber vivants** → Observer radar
3. **Tuer 3+ Hide vivants** → Observer radar
4. **Vérifier logs JSON**:
   ```json
   {"event":"SPAWN","name":"Fiber","tier":4,...}  ← Doit afficher "Fiber" !
   ```

### Résultat attendu
- ✅ **Fiber affichés AVANT kill** (spawn vivant visible)
- ✅ **Fiber nommés "Fiber"** dans logs (pas null, pas "Hide")
- ✅ **Hide affichés normalement** (pas de régression)
- ✅ **Tier correct** (T3/T4/T5 selon zone)

### Si ça fonctionne
🎉 **EventNormalizer peut-être PAS nécessaire !**
- Le problème était juste la base de données incomplète
- 230 TypeIDs résolvent les race conditions côté priorité mobinfo

### Si ça ne fonctionne toujours pas
- Copier les logs complets
- M'envoyer cache localStorage
- On passera à EventNormalizer (Phase 3)

**C'est tout !** Les logs sont automatiques, rien à modifier.

---

## 🌐 SOURCES DE DONNÉES EXTERNES

### Base de données TypeID disponibles

#### 1. **AlbionOnline2D.com** ⭐ RECOMMANDÉ
- URL: https://albiononline2d.com/
- **Avantages**:
  - Base de données complète et à jour
  - API accessible
  - Icons haute qualité
  - Tous les items/mobs/ressources
- **Utilisation potentielle**:
  - Scraper les TypeID living resources
  - Télécharger icons manquants
  - Valider nos mappings

#### 2. **Albion Online Data Project**
- URL: https://www.albion-online-data.com/
- Focus: Prix marché, pas TypeID mobs

#### 3. **GitHub: ao-data**
- URL: https://github.com/broderickhyman/ao-bin-dumps
- Dumps binaires du client Albion
- Nécessite parsing

### 📋 TypeID Living Resources - Base de données complète

**✅ Fusion FINALE dans MobsInfo.js unique** :

**📊 Total: 235 TypeIDs** répartis comme suit:
- **Fiber**: 38 TypeIDs (T3-T8 complet)
- **Hide**: 85 TypeIDs (T1-T8 complet + variantes)
- **Wood**: 38 TypeIDs (T3-T8 complet)
- **Ore**: 38 TypeIDs (T3-T8 complet)
- **Rock**: 36 TypeIDs (T3-T8 complet)

**🔧 Corrections appliquées** (confirmées logs terrain 2025-11-01):
- TypeID 421, 423, 425, 427: AJOUTÉS (absents original)
- TypeID 528: **Rock T4 → Fiber T3** (CORRIGÉ terrain)
- TypeID 530: **Rock T6 → Fiber T4** (CORRIGÉ terrain)
- TypeID 531: **Rock T7 → Fiber T5** (CORRIGÉ terrain)
- **Noms corrigés**: "fiber"→"Fiber", "hide"→"Hide", "Wood"→"Log" (majuscules + compatibilité HarvestableType)
- **HarvestablesHandler**: Utilise mobinfo pour override typeNumber du jeu (cadavres Fiber correctement affichés)

## ⚠️ COMPORTEMENT ATTENDU

### "Superposition" living resource + cadavre
**Symptôme**: Fiber/Hide vivant + cadavre affichés ensemble

**Analyse logs** : Ce sont des **entités DIFFÉRENTES** !
- Fiber vivant (entityId=253682) reste affiché
- Cadavre d'un AUTRE Fiber (entityId=266729) créé à proximité
- Les deux sont **corrects**, ce sont des objets distincts

**Ce n'est PAS un bug** : C'est le comportement normal du jeu.
- Plusieurs ressources vivantes peuvent être proches
- Quand vous en tuez une, le cadavre apparaît
- Les autres vivants restent affichés (correct)

**Pourquoi ça "semble" superposé** :
- Les ressources spawnt souvent par groupes
- Position GPS proche (~1-2 mètres)
- Visuellement, ça semble être le même objet

**Vérification** : Comparer les entityId dans les logs
- SPAWN entityId=X → Mob vivant
- 💀 Entity killed entityId=Y → Cadavre
- Si X ≠ Y → **Objets différents** ✅

**Workaround si gênant** :
- S'éloigner pour déclencher `Leave` (retire vivants hors range)
- Ou tuer TOUS les Fiber du groupe

**Fix nécessaire** : Aucun, comportement correct.

---

## 🚨 BUG SERVEUR ALBION CONFIRMÉ
- **HarvestablesHandler** override via mobinfo priority (cadavres) ✅
- 12 autres TypeID suspects dans range 523-537 à vérifier en jeu (voir `tools/find_suspect_typeids.js`)

**⚠️ Vérification interne** : Aucun TypeID manquant dans les ranges connus (330-639)

**⚠️ Vérification externe** : À faire manuellement via ao-bin-dumps (voir `VERIFICATION_TYPEID_MANUELLE.md`)

**Fichier unique**: `scripts/Handlers/MobsInfo.js` (tout fusionné)

---

## 💡 NOTES TECHNIQUES

### Pourquoi TypeID 65535 est blacklisté
- ID générique réutilisé par le jeu
- Change de type dynamiquement (Fiber→Wood→Hide)
- Utilisé pour cadavres transitoires
- Ne déclenche PAS NewMobEvent pour spawns vivants
- Solution: Filtré du cache pour éviter pollution

### Format logs JSON (NDJSON)
```json
{
  "timestamp": "2025-11-01T18:40:22.221Z",
  "module": "MobsHandler",
  "event": "SPAWN",
  "entityId": 1001,
  "reportedTypeId": 425,
  "resolvedBy": "cross-reference",
  "classification": "LIVING_RESOURCE",
  "health": 1203,
  "tier": 4,
  "name": "Hide",
  "emoji": "🌿"
}
```

---

## 🎯 RECOMMANDATIONS

### Production
✅ **Code actuel OK pour production**
- Hide fonctionne parfaitement
- Fiber limité mais documenté
- Pas de régression sur autres features
- Code propre et maintenable

### Développement
🔴 **EventNormalizer indispensable moyen terme**
- Résoudra race conditions
- Corrigera détection Fiber
- Architecture scalable

---

Fin du document.

