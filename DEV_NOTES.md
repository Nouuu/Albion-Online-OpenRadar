# 📝 DEV NOTES - Living Resources Detection

men**Last update**: 2025-11-02  
**Project status**: Phase 1 & 2 COMPLETED ✅ | Production-ready code | Git cleaned ✅

---

## 🎯 OVERLAY MODE - Solutions (2025-11-02)

### ❌ Electron : Test effectué, migration IMPOSSIBLE
**Raison** : Module `cap` ne compile pas (distutils manquant, node-gyp incompatible)  
**Décision** : Garder architecture actuelle (pkg + navigateur)

### ✅ Solutions Frontend pour Overlay

#### 1. **Solution actuelle** : window.open() avec DeskPins ⭐ **RECOMMANDÉ**
- ✅ Fonctionne aujourd'hui
- ✅ Pas de dépendance externe
- 💡 **DeskPins** pour always-on-top : https://efotinis.neocities.org/deskpins/
- ⚠️ Barre URL visible (limitation sécurité navigateurs)
- 📊 Effort : 0 jour (déjà implémenté)

#### 2. **Bibliothèques Frontend JavaScript** (Overlay dans navigateur)

**a) Winbox.js** - Fenêtres modales draggables
- URL : https://github.com/nextapps-de/winbox
- ✅ Léger (10 KB), sans dépendance
- ✅ Fenêtres draggables/redimensionnables
- ✅ Peut minimiser/maximiser
- ❌ **Reste dans la page** (pas de vraie fenêtre séparée)
- 📊 Effort : 0.5 jour

**b) Draggabilly** - Drag & drop
- URL : https://draggabilly.desandro.com/
- ✅ Très léger
- ✅ Drag & drop simple
- ❌ **Pas de fenêtre séparée**
- 📊 Effort : 0.25 jour

**c) Custom CSS + Fullscreen API**
- Utiliser `requestFullscreen()` sur l'overlay
- ✅ Pas de dépendance
- ✅ Plein écran possible
- ❌ **Pas de vraie fenêtre séparée**
- ❌ Barre URL toujours visible en mode normal
- 📊 Effort : 0.5 jour

**Conclusion** : Aucune bibliothèque frontend pure ne peut créer une **vraie fenêtre système séparée** sans framework (Electron/Tauri/etc.)

#### 3. **Alternative : Tauri** (Recommandé si refactor nécessaire)
- URL : https://tauri.app/
- ✅ Plus léger qu'Electron (Rust + WebView natif)
- ✅ Pas de Chromium embarqué (~5-10 MB)
- ✅ Fenêtre frameless, always-on-top natif
- ⚠️ **Problème potentiel** : Module `cap` (même risque qu'Electron)
- 📊 Effort : 2-3 jours migration

#### 3. **Alternative : NW.js** (Chromium + Node.js)
- URL : https://nwjs.io/
- ✅ Similaire Electron mais plus vieux/stable
- ✅ Fenêtre frameless possible
- ⚠️ **Problème potentiel** : Module `cap` (même risque)
- 📊 Effort : 2-3 jours migration

#### 4. **Alternative : Neutralinojs** (Ultra léger)
- URL : https://neutralino.js.org/
- ✅ Très léger (~3 MB)
- ✅ Pas de Node.js embarqué (WebSockets)
- ❌ **Bloquant** : Pas de modules natifs (cap impossible)
- ❌ Non compatible avec le projet

#### 5. **Alternative : WebView2 (Windows uniquement)**
- URL : https://developer.microsoft.com/en-us/microsoft-edge/webview2/
- ✅ Natif Windows, léger
- ✅ Fenêtre frameless possible
- ❌ **Windows only** (pas cross-platform)
- ⚠️ **Problème** : Intégration `cap` complexe
- 📊 Effort : 3-4 jours

### 🎯 Recommandation FINALE

**Garder solution actuelle** : pkg + navigateur + window.open()

**Pourquoi** :
1. ✅ Fonctionne parfaitement
2. ✅ Module `cap` stable
3. ✅ Multi-plateforme
4. 💡 DeskPins résout le always-on-top
5. ⚠️ Toutes les alternatives ont le même problème `cap`

**Si vraiment besoin overlay parfait** :
→ Tester **Tauri** (plus léger qu'Electron, peut-être compatible `cap`)

---

## 🏗️ BUILD SYSTEM (2025-11-02)

### Architecture
t- **Lightweight executable**: 53 MB (vs 656 MB before - 92% reduction!)
  - Only native modules bundled in .exe (cap.node, node-sass)
  - Assets copied alongside for easy updates and customization
- **PKG Configuration**: Minimal assets in bundle
- **Post-build**: Auto-copy assets + create multi-format archives
- **Image Optimization**: Lossless PNG compression available (reduces archive size)

### Release Packages (Multi-platform)
**Windows:**
- `ZQRadar-{version}-win64.zip` (~212 MB, optimized images)

**Linux:**
- `ZQRadar-{version}-linux-x64.zip` (~215 MB, optimized images)

**macOS:**
- `ZQRadar-{version}-macos-x64.zip` (~215 MB, optimized images)

**Optimization integrated**: Images automatically optimized during build (602 MB → 180 MB, 70% compression)

### Build Commands
```bash

# Windows CMD
build.bat all-in-one      # Complete workflow (includes optimization)
build.bat build:all       # Build all platforms
build.bat optimize        # Optimize images in dist/ (manual)
build.bat clean           # Clean dist/

# Unix/WSL/Git Bash
make all-in-one           # Complete workflow (includes optimization)
make build-all            # Build all platforms
make optimize-images      # Optimize images in dist/ (manual)
make clean                # Clean dist/

# Or via npm
npm run build:all         # Build all platforms
npm run optimize:images   # Optimize dist/images/ only
```

**`all-in-one` Workflow:**
1. Clean all build artifacts
2. Install all dependencies
3. Check system requirements
4. Build for all platforms (Windows, Linux, macOS)
5. Post-build: Copy assets → **Optimize images (integrated)** → Create archives
6. Display summary of created archives

**Image optimization** is now **integrated in post-build.js**:
- Runs automatically after copying assets
- 95% quality (near-lossless)
- 602 MB → ~180 MB (70% compression)
- 2-3 minutes processing time
- Archives created with optimized images

---

## 🤖 GITHUB ACTIONS CI/CD (2025-11-02)

### Automated Pipelines

#### 1. CI - Tests & Lint
**File**: `.github/workflows/ci.yml`  
**Triggers**: Pull Requests to main/develop, Push to develop  
**Platforms**: Ubuntu, Windows, macOS

**Steps**:
- Install dependencies
- Check system requirements
- Run linting (if available)
- Run tests (if available)
- Verify build (Linux quick check)

**Use case**: Quality control before merging PRs

#### 2. Build - Multi-platform
**File**: `.github/workflows/build.yml`  
**Triggers**: Push to main, Manual dispatch  
**Platforms**: All (Ubuntu runner builds for all)

**Steps**:
1. Install dependencies
2. Rebuild native modules
3. Install build tools (pkg, archiver, sharp)
4. Build all platforms (npm run build:all)
5. Post-build with optimization
6. Upload artifacts (30 days retention)

**Artifacts**:
- ZQRadar-Windows (~212 MB)
- ZQRadar-Linux (~215 MB)
- ZQRadar-macOS (~215 MB)

**Use case**: Test complete build process

#### 3. Release
**File**: `.github/workflows/release.yml`  
**Triggers**: Git tags `v*.*.*`, Manual dispatch with version input  

**Steps**:
1. Clean build artifacts
2. Install dependencies
3. Rebuild native modules
4. Build all platforms
5. Optimize images (integrated)
6. Create GitHub Release
7. Upload 3 ZIP archives
8. Generate release notes with:
   - Download links
   - Installation instructions
   - Requirements (Npcap, libpcap)
   - Feature highlights

**Release Notes Include**:
- Platform-specific download links
- Archive sizes
- Requirements per platform
- Installation guide
- Discord/GitHub links
- Optimization info (70% compression)

**Example**:
```bash
# Automatic release on tag push
git tag v1.0.0
git push origin v1.0.0

# Or manual trigger from GitHub Actions UI
```

### Workflow Benefits

✅ **Automated testing** on every PR  
✅ **Multi-platform builds** on every main push  
✅ **One-click releases** with optimized archives  
✅ **Consistent builds** (same process everywhere)  
✅ **Artifact storage** (30 days for testing)  
✅ **Professional release notes** (auto-generated)

### Configuration

**No secrets required** for basic workflows.

**Permissions needed**:
- `contents: write` - For creating releases
- `packages: write` - For uploading artifacts

**Node.js version**: 18.18.2 (pinned in all workflows)

**Build time**: ~20-25 minutes (includes 2-3 min image optimization)

### Notes

- Native modules (cap, node-sass) use `continue-on-error: true`
- Image optimization runs automatically in post-build
- Archives use ZIP only (simplified from ZIP + TAR.GZ)
- All builds use optimized images (70% compression)

> 📖 **Full workflow documentation**: `.github/README.md`

### Distribution Structure
```
dist/
├── ZQRadar.exe                          (53 MB - Windows)
├── albion-zqradar-linux                 (61 MB - Linux)
├── albion-zqradar-macos                 (66 MB - macOS)
├── README-win.txt                       (Installation guide)
├── README-linux.txt                     (Installation guide)
├── README-macos.txt                     (Installation guide)
├── views/                               (EJS templates)
├── scripts/                             (Client-side JS)
├── images/                              (Assets - can be optimized)
├── images/                              (Optimized: 180 MB - 70% compression)
├── ZQRadar-{version}-win64.zip          (~212 MB)
├── ZQRadar-{version}-linux-x64.zip      (~215 MB)
└── ZQRadar-{version}-macos-x64.zip      (~215 MB)

### System Requirements
**Windows:**
- Npcap 1.79 or newer (download: https://npcap.com/)
- Node.js v18.18.2 (for development)

**Linux:**
- libpcap-dev (`sudo apt-get install libpcap-dev` on Ubuntu/Debian)
- Node.js v18.18.2 (for development)

**macOS:**
- libpcap (usually pre-installed, or `brew install libpcap`)
- Node.js v18.18.2 (for development)

### Cross-platform Support
- **Windows**: ✅ Tested and working (node18-win-x64)
- **Linux**: 🔄 Built successfully (node18-linux-x64) - runtime testing needed
**Important:** Optimizes **dist/images/ ONLY** (source originals in images/ folder are preserved)

- **macOS**: 🔄 Built successfully (node18-macos-x64) - runtime testing needed

### Image Optimization
**Command:** `npm run optimize:images` or `make optimize-images` or `build.bat optimize`

**Important:** Optimizes **dist/images/ ONLY** (source originals in images/ folder are preserved)

Uses sharp for fast PNG compression:
- Quality: 95% (near-lossless, imperceptible loss)
- Speed: Fast (50 files in parallel)
- Typical savings: 30-40% on PNG files
- Processing time: ~2-3 minutes for 6693 files
- Strips metadata for additional savings
- **Source images/ folder: UNTOUCHED** (originals kept for development)

**Workflow:**
```bash
# Method 1: Automated (recommended)
make all-in-one              # Build + optimize automatically

# Method 2: Manual
npm run build:all
npm run optimize:images      # Optimizes dist/images/ only
```

**Result:**
- Archives ~30-40% smaller
- Development images unchanged
- 95% quality (visually identical to original)

---

## 🧹 GIT CLEANUP (2025-11-02)

### Changements annulés
❌ **MobsHandler.js** - Logique de calcul enchantement supprimée
- Code ajouté par erreur, jamais testé en session terrain
- Fonction `calculateEnchantmentFromRarity()` retirée
- Retour au code stable validé

### Changements conservés
✅ **MobsInfo.js** - Support enchantement préparé
- Ajout paramètre `enchant` à `addItem()` (défaut: 0)
- Stockage enchantement dans `moblist[id][3]`
- Documentation TypeID 425/427 (valeurs rarity incorrectes du jeu)
- Correction TypeID 528 (Fiber T3, pas Rock T4)

### Leçon apprise
**Principe**: Code minimal, tests terrain maximums !
- ✅ Préparer base de données AVANT logique
- ✅ Tester en session terrain
- ✅ Ajouter code SEULEMENT si nécessaire

---

## 📊 ÉTAT ACTUEL

### ✅ Ce qui fonctionne (2025-11-02)
- **Hide Detection**: 100% (TypeID 421/423/425/427)
- **Fiber Detection**: Améliorée avec override typeNumber
- **Cache localStorage**: Fonctionnel avec boutons Clear/Show
- **Cross-référence**: Harvestables → Mobs opérationnel
- **Filtrage settings**: Par Tier & Enchantement
- **Icon loading**: Robuste avec fallback cercle bleu
- **Logs JSON**: Format NDJSON uniquement (simplifié)
- **🆕 Détection enchantements via rarity**: Calcul automatique .1/.2/.3

### 🆕 Amélioration enchantements (2025-11-02)

#### 🔥 DÉCOUVERTE CRITIQUE : Skinnable vs Harvestable
Les valeurs `enchant` et `rarity` du jeu fonctionnent **DIFFÉREMMENT** selon le type !

**Skinnable (animaux - Hide):**
- ❌ Valeurs `enchant` et `rarity` **CONSTANTES par TypeID** (fausses !)
- Exemple: TypeID 425 (Hide T4) → TOUS envoient `enchant=1, rarity=137`
- Exemple: TypeID 427 (Hide T5) → TOUS envoient `enchant=3, rarity=257`
- ✅ Solution: Utiliser base de données TypeID → Enchantement (MobsInfo.js[3])

**Harvestable (plantes - Fiber/Ore/Wood/Rock):**
- ✅ Valeur `rarity` **VARIABLE** et correcte selon enchantement réel
- Exemple: Fiber T4 → `rarity=92` (e0), `rarity=117` (e1), `rarity=142` (e2)
- ✅ Solution: Calculer enchantement depuis formule `rarity - base_tier`

#### Formule calcul enchantement (Harvestable uniquement)
```javascript
Base par tier: T1=12, T2=32, T3=52, T4=92, T5=112, T6=132, T7=152, T8=172
diff = rarity - base
e0: diff < 20 | e1: diff < 65 | e2: diff < 110 | e3: diff < 155 | e4: diff >= 155
```

**Problème résolu**: Les living resources enchantées n'étaient pas détectées (enchant toujours à 0).

**Solution**: Calcul de l'enchantement basé sur la valeur `rarity` au lieu du paramètre `enchant` (qui ne fonctionne pas).

```javascript
// MobsHandler.calculateEnchantmentFromRarity()
Rarity   0-120  → Enchant 0  (.0)
Rarity 121-180  → Enchant 1  (.1)
Rarity 181-230  → Enchant 2  (.2)
Rarity 231-280  → Enchant 3  (.3)
Rarity 281+     → Enchant 4  (.4)
```

**Exemples validés dans logs**:
- Hide T5 .0: rarity=112 → enchant=0 ✅
- Hide T4 .1: rarity=137 → enchant=1 ✅
- Fiber T5 .2: rarity=208 → enchant=2 ✅
- Fiber T5 .3: rarity=257 → enchant=3 ✅

**Impact**: Filtrage par enchantement maintenant fonctionnel sans besoin de collecter les TypeIDs!

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

## 💡 RÉFLEXIONS & SOLUTIONS

### Pourquoi l'apprentissage automatique a échoué

**Tentative** : Corrélation automatique kill → harvestable pour apprendre les TypeID enchantés

**Échec** pour 3 raisons :
1. **Harvestables non détectés** : Événements réseau manquants ou filtrés
2. **Timing imprévisible** : Délai variable, race conditions impossibles à résoudre
3. **Complexité excessive** : Code complexe, risque corruption cache, debugging difficile

**Conclusion** : Approche retirée le 2025-11-02, code nettoyé ✅

### Solutions pour les TypeID enchantés

#### ⭐ Solution recommandée : Collecte manuelle ciblée
```
Avantages:
✅ Propre et fiable
✅ Contrôle total
✅ Pas de risque corruption

Process:
1. Session terrain 1-2h avec logs JSON activés
2. Tuer Hide/Fiber enchantés (.1, .2, .3) 
3. Noter TypeID dans logs (reportedTypeId)
4. Ajouter manuellement dans MobsInfo.js

Estimation: 20-30 TypeID principaux en 1-2h
```

#### Alternative : Scraping bases externes
```
✅ Déjà fait: albiononline2d.com (235 TypeIDs)
❌ Problème: Incomplet pour enchantés, peut être obsolète
```

#### Dernier recours : EventNormalizer
```
❌ Trop complexe pour ce problème
❌ Refactoring architectural massif
✅ Nécessaire UNIQUEMENT si race conditions Fiber persistent
```

---


## 📝 CHANGELOG

### 2025-11-02
- ❌ **Revert apprentissage automatique**: Approche non viable (harvestables non détectés)
- ✅ **Code nettoyé**: Retour état simple et propre
- ✅ **Documentation consolidée**: Fusion fichiers, organisation claire

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

### Charges restantes affichées incorrectement
**Symptôme**: La quantité affichée sur les ressources diminue trop vite et disparaît avant la fin de la récolte

**Cause**: Le serveur Albion envoie une valeur `size` qui compte les **objets récupérés** (avec bonus premium/récolte) au lieu des **charges réellement consommées**.

**Exemple** :
- Ressource a 10 charges
- Vous récoltez 1 fois → Récupérez 3 objets (avec bonus +200%)
- Le serveur dit : `size = 10 - 3 = 7` (au lieu de 9)
- Après 4 récoltes : `size = 0` mais il reste encore des charges !

**Impact** : L'affichage radar montre "0" ou disparaît avant que la ressource soit épuisée.

**Ce n'est PAS un bug du radar** : C'est la valeur envoyée par le serveur.

**Fix impossible** : On ne connaît pas :
- Le nombre de charges initiales
- Le bonus de récolte actif du joueur
- Le multiplicateur premium

**Workaround** : Ignorer l'affichage du nombre et récolter jusqu'à disparition effective.

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

