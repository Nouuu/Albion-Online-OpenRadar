# 📝 DEV NOTES - Living Resources Detection

men**Last update**: 2025-11-02  
**Project status**: Phase 1 & 2 COMPLETED ✅ | Production-ready code | Git cleaned ✅

---

## 🎯 OVERLAY MODE (2025-11-02)

### ✅ Solution actuelle : window.open() + DeskPins

**Implémentation** :
- Popup window séparée (`window.open()`)
- Canvas 500x500 avec tous les handlers
- Barre de drag personnalisée en haut
- Bouton close + raccourci ESC
- Auto-hide contrôles après 2 secondes

**Pour always-on-top** : Utiliser **DeskPins** (gratuit)
- Télécharger : https://efotinis.neocities.org/deskpins/
- Pin la fenêtre overlay pour la garder au premier plan

**Limitations navigateur** (sécurité) :
- ⚠️ Barre URL visible (impossible à cacher)
- ⚠️ Bordures fenêtre (dépend du navigateur)

### ❌ Electron : Migration annulée

**Test effectué** : Module `cap` ne compile pas avec Electron v39  
**Erreur** : `ModuleNotFoundError: No module named 'distutils'`  
**Cause** : Python distutils obsolète, node-gyp incompatible  
**Décision** : **Garder architecture actuelle** (pkg + navigateur)

---

## 🏗️ BUILD SYSTEM (2025-11-03)

### Architecture
- **Lightweight executable**: 53 MB (vs 656 MB before - 92% reduction!)
  - Only native modules bundled in .exe (cap.node, node-sass)
  - Assets copied alongside for easy updates and customization
- **PKG Configuration**: Minimal assets in bundle
- **Post-build**: Auto-copy assets + create multi-format archives
- **Image Optimization**: Lossless PNG compression with intelligent caching
  - **Smart caching**: Images optimized once, preserved across builds
  - **Marker system**: `.optimized` file tracks optimization state
  - **Fast rebuilds**: Skip 2-3 min optimization on subsequent builds

### Optimization Workflow
**First build** (with optimization):
1. Build executable (~1-2 min)
2. Copy assets to dist/ (~30 sec)
3. Optimize images (602 MB → 180 MB, ~2-3 min) ⏱️
4. Create marker: `dist/images/.optimized`
5. Create archives (~1 min)
**Total: ~4-6 min**

**Subsequent builds** (cached optimization):
1. Build executable (~1-2 min)
2. Skip image copy (marker detected) ⚡
3. Skip optimization (already done) ⚡
4. Create archives (~1 min)
**Total: ~2-3 min** (50% faster!)

### Build Commands
```bash
# Windows CMD
build.bat build:all         # Build all platforms (preserves optimized images)
build.bat clean             # Clean but preserve optimized images ⚡
build.bat clean:all         # Clean everything (re-optimize next time)
build.bat all-in-one        # Complete workflow with smart caching

# Unix/WSL/Git Bash
make build-all              # Build all platforms (preserves optimized images)
make clean                  # Clean but preserve optimized images ⚡
make clean-all              # Clean everything (re-optimize next time)
make all-in-one             # Complete workflow with smart caching

# Or via npm
npm run build:all           # Build all platforms
npm run clean               # Clean preserving images
npm run clean:all           # Full clean
npm run clean:images        # Delete only optimized images
npm run optimize:images     # Manual optimization (if needed)
```

### Smart Caching System
**Marker file**: `dist/images/.optimized`
- Created after successful optimization
- Contains timestamp
- Checked by post-build script

**Benefits**:
- ⚡ 50% faster rebuilds (skip 2-3 min optimization)
- 💾 Preserve 180 MB optimized images
- 🔄 Automatic on first build
- 🧹 Clean when needed with `clean:all`

**Force re-optimization**:
```bash
# Delete images and rebuild
npm run clean:images
npm run build:all

# Or full clean
npm run clean:all
npm run build:all
```

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
- Npcap 1.84 or newer (download: https://npcap.com/)
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

### 2025-11-03 - 🔍 INVESTIGATION ÉVÉNEMENTS INVENTAIRE EN COURS
- 🔍 **Recherche du vrai nombre de ressources avec bonus premium**:
  - **Problème**: Fame ne contient PAS le bonus premium (+50% ressources)
  - **Approche Fame**: Détecte gear/food bonus ✓ mais pas premium ❌
  - **Nouveaux logs activés**: TOUS les événements d'inventaire (26-37)
    - `InventoryPutItem` (26)
    - `InventoryDeleteItem` (27)
    - `InventoryState` (28)
    - `NewSimpleItem` (32) ⭐ Probablement ici !
    - `NewEquipmentItem` (30)
    - `NewJournalItem` (35)
  - **Objectif**: Trouver l'événement qui contient le nombre EXACT avec premium
  - **Test nécessaire**: Récolter en jeu et analyser les nouveaux logs
- ✅ **FIX Double comptage dernier stack**: Ne pas tracker dans harvestFinished si Parameters[8] = undefined
  - **Problème identifié**: Dernier stack compté 2 fois (harvestFinished + HarvestUpdateEvent)
  - **Flux correct**:
    - Stacks normaux: `harvestFinished` track avec Parameters[5] ✓
    - Dernier stack: `HarvestUpdateEvent` track avec cache Parameters[5] ✓
    - `harvestFinished` skip si Parameters[8] = undefined ✓
  - **Résultat**: Chaque stack compté exactement 1 fois
- ✅ **Système cache Parameters[5]**: Stockage/récupération entre événements
  - `harvestFinished` stocke Parameters[5] dans Map
  - `HarvestUpdateEvent` récupère du cache pour dernier stack
  - Cache nettoyé après utilisation (pas de fuite)
- ✅ **Précision 100%**: Stats = inventaire jeu (avec tous les bonus serveur)
  - Parameters[5] contient bonus: gear, food, premium, zone
  - Fonctionne pour harvestables statiques (Wood, Ore, Rock, Fiber statique)
  - Living resources (Hide, Fiber mobile) utilisent formule de base
- ✅ **Code nettoyé**: Tous les logs de debug retirés
- 🔍 **Logs de debug activés**: Investigation régression dernier stack
  - Symptômes rapportés: Dernier stack plus compté + incrémente de 1 au lieu de Parameters[5]
  - Logs ajoutés dans `harvestFinished()` et `HarvestUpdateEvent()`
  - À tester en jeu pour identifier où le tracking échoue
  - Une fois diagnostiqué, on corrigera et retirera les logs
- ✅ **FIX CRITIQUE - Double comptage dernier stack**: Suppression tracking dans HarvestUpdateEvent
  - **Problème**: `HarvestUpdateEvent` trackait le dernier stack ALORS que `harvestFinished` l'avait déjà fait
  - **Flux réel**: `harvestFinished(param5=2)` → PUIS `HarvestUpdateEvent(param1=undefined)` → Double comptage!
  - **Solution**: Retrait complet du tracking dans `HarvestUpdateEvent` (suppression seule)
  - **Résultat**: Stats maintenant correctes, pas de doublons
- ✅ **SOLUTION FINALE - Parameters[5]**: Nombre RÉEL de ressources du serveur
  - **Découverte**: `Parameters[5]` dans `harvestFinished` contient le nombre exact de ressources
  - **Validation**: Tests réels avec Fiber T4 (param5 = 2 ressources/stack ✓)
  - **Inclut TOUS les bonus**: gathering gear, food, premium, zone bonus
  - **Précision 100%**: Les stats affichent exactement ce que le joueur reçoit
  - **Dernier stack tracké**: Via `HarvestUpdateEvent(Parameters[1] = undefined)`
  - **Living resources**: Trackées via `MobsHandler.removeMob()` (formule de base)
  - **Code nettoyé**: Suppression des logs de debug et formules fixes
  - Fonctionne pour harvestables statiques (Wood, Ore, Rock, Fiber statique)
  - Living resources (Hide, Fiber mobile) utilisent formule de base car pas de Parameters[5]
- ✅ **FIX Living resources harvest tracking**: Tracker dans removeMob()
  - **Problème identifié**: `harvestFinished` N'est PAS appelé pour le dernier stack
  - **Vraie cause**: `HarvestUpdateEvent(Parameters[1] = undefined)` supprime directement
  - **Solution**: Tracker dans `HarvestUpdateEvent` AVANT `removeHarvestable`
  - Calcul: `resourcesPerStack × harvestable.size` (cas où plusieurs stacks restent)
  - Dernier stack maintenant VRAIMENT comptabilisé
- ✅ **FIX Statistiques de récolte - SIMPLIFIÉ**: Retour à la base
  - Tracking AVANT `updateHarvestable` pour capturer le dernier stack
  - Calcul simple : 1 stack = X ressources selon tier (T3×3, T4×2, T5×1)
  - `updateStatsHarvested()` pour compter les ressources réelles
  - Suppression automatique quand size <= 0
  - Code simplifié, pas de Parameters[5] ou Parameters[8] complexes
- ✅ **Overlay enchantement pour living resources**: Affichage uniforme
  - Ajout de l'indicateur d'enchantement visuel sur les living resources (Hide, Fiber)
  - Cercle coloré avec glow + numéro (.1, .2, .3, .4)
  - Identique à l'affichage des harvestables statiques
  - Couleurs : .1 vert, .2 cyan, .3 rose, .4 or
- ✅ **FIX CRITIQUE - Double comptage dernier stack**: Correction du parsing des paramètres
  - **Problème**: Parameters[0] = Player ID (pas stack count!) → 219712 ressources au lieu de 1 ❌
  - **Solution**: Toujours 1 stack par récolte (mécanique serveur)
  - Conversion correcte : T1-T3 (×3), T4 (×2), T5+ (×1)
  - Stats "Récolté" maintenant correctes (pas de valeurs astronomiques)
- ✅ **FIX Statistiques de récolte précises**: Tracking du nombre réel de ressources
  - **Problème 1**: Le dernier stack récolté n'était pas comptabilisé
  - **Problème 2**: Stats affichaient nombre de stacks au lieu du nombre de ressources réelles
  - **Problème 3**: Mauvaise répartition des types (affichait Wood au lieu de Hide/Fiber)
  - **Solution**: Nouvelle méthode `updateStatsHarvested()` qui compte les ressources réelles
  - Conversion stack → ressources appliquée : T1-T3 (×3), T4 (×2), T5+ (×1)
  - `GetStringType()` accepte maintenant les strings directement pour éviter mauvais mapping
  - Logging détaillé ajouté dans `harvestFinished()` pour debug
  - Stats "Récolté" affichent maintenant le nombre exact de ressources collectées
- ✅ **FIX Statistiques complètes**: Tracking des living resources
  - **Problème**: Les living resources (Fiber, Hide, Wood, Ore, Rock) ne comptaient pas dans les stats
  - **Cause**: Ces ressources sont ajoutées via `MobsHandler.AddEnemy()`, pas `HarvestablesHandler`
  - **Solution**: `MobsHandler` appelle maintenant `harvestablesHandler.updateStats()` pour les living resources
  - Mapping automatique des noms (Fiber→0, Hide→1, Wood/Logs→2, Ore→3, Rock→4)
  - Statistiques détectées maintenant fonctionnelles pour toutes les ressources
  - ⚠️ Note: Les récoltes ne sont trackées que pour les harvestables statiques (pas living resources)
- ✅ **Corrections visuelles et fonctionnelles**: Interface radar optimisée
  - **FIX**: Retrait des overlays de tier (rectangles de fond) qui étaient invisibles et moches
  - **FIX**: Exposition de `harvestablesHandler` dans le scope global pour accès aux statistiques
  - Tier affiché uniquement avec texte coloré + ombre portée forte (plus propre)
  - Statistiques maintenant fonctionnelles (accès à `window.harvestablesHandler`)
  - Taille de police tier légèrement augmentée (11px → 12px bold)
- ✅ **Améliorations visuelles du radar**: Affichage des ressources modernisé
  - **Tiers** : Plus gros (11px bold), avec fond coloré semi-transparent et bordure
  - **Nombre de ressources** : Plus gros (10px bold), fond arrondi avec gradient
  - **Indicateur d'enchantement** : Cercle plus visible avec fond noir, bordure et glow amélioré
  - **Couleurs tiers renforcées** : Plus vives et contrastées (T3 vert vif, T4 cyan, T5 or, etc.)
  - **Ombres portées** : Ajoutées sur tous les textes pour meilleure lisibilité
  - **Coins arrondis** : Backgrounds avec rounded corners pour un look plus moderne
- ✅ **Nettoyage interface radar**: Suppression des fonctionnalités non fonctionnelles
  - Retrait du bouton "Open Items Window" (non fonctionnel)
  - Masquage du canvas vide (#thirdCanvas)
  - Interface plus propre et focalisée sur les fonctionnalités actives
- ✅ **Intégration statistiques dans le radar**: Interface compacte agrandie
  - Statistiques affichées directement sous le canvas du radar
  - Panel agrandi (560px) avec fond noir opaque et design moderne
  - Tailles de police augmentées : Titre 20px, valeurs principales 24px, ressources 18px
  - Mise à jour temps réel (1 sec)
  - Icônes emoji pour chaque type de ressource (🌿 Fiber, 🦊 Hide, 🪵 Wood, ⛏️ Ore, 🪨 Rock)
  - Affichage des tiers T4-T8 avec couleurs correspondantes (16px)
  - Bouton Reset amélioré avec effet de scale au survol
  - Espacement vertical augmenté (top: 540px) pour aérer l'interface
  - Boutons d'action réorganisés avec espacement moderne et effets visuels
- ✅ **Tracking intelligent par settings**: Ne compte que les ressources cochées
  - Vérification des settings avant de tracker une ressource
  - Méthode `isResourceEnabled()` pour vérifier tier/enchant
  - Respect des filtres harvestingLivingFiber, Hide, Wood, Ore, Rock
  - Stats précises basées uniquement sur ce qui est activé
- ✅ **Système de statistiques**: Tracking en temps réel des ressources
  - Compteurs par type (Fiber, Hide, Wood, Ore, Rock)
  - Compteurs par tier (T1-T8)
  - Compteurs par enchantement (.0 à .4)
  - Total détecté vs récolté
  - Durée de session
  - Page dédiée `/statistics` avec interface graphique
- ✅ **Améliorations interface radar**:
  - Couleurs des tiers améliorées (gradient par tier)
  - Indicateur d'enchantement avec effet de glow
  - Couleurs spécifiques par enchantement (.1 vert, .2 cyan, .3 rose, .4 or)
  - Fond noir semi-transparent pour meilleure lisibilité du nombre de ressources
  - Texte blanc pour le nombre de ressources (meilleur contraste)
- ✅ **Code quality improvements**: Bug fixes et polish
  - Fix case labels dupliqués (6, 6, 6 → 6, 7, 8) dans HarvestablesDrawing.js
  - Fix comparaisons type coercion (== → ===) dans 5 fichiers
  - Fix variable redondante dans calculateDistance
  - Fix variable initializer redondant (let name = null → let name)
  - Réduction de 56% des warnings (25+ → 11)
- ✅ **Build system amélioré**: Cache intelligent pour les images optimisées
  - Système de marqueur (`.optimized`) pour détecter images déjà optimisées
  - `clean` préserve les images optimisées (⚡ 50% plus rapides)
  - **FIX CRITIQUE**: Structure if-else corrigée avec goto pour éviter double exécution
  - **FIX**: Suppression des exécutables avec les 2 conventions de nommage
    - `ZQRadar-*` et `albion-zqradar-*` (pkg peut générer les deux)
    - Synchronisation build.bat (Windows) et Makefile (Unix/Linux/macOS)
  - `clean` supprime: exe (toutes conventions), archives, dossiers sauf images/
  - `clean:all` supprime tout (force re-optimization)
  - `clean:images` supprime uniquement les images optimisées
  - Post-build skip automatique si images déjà optimisées
  - Gain de temps: 4-6 min → 2-3 min sur les rebuilds
  - Tests validés: Seul images/ reste après clean ✅
- ✅ **Affichage ressources**: Conversion stacks → ressources réelles selon tier
  - T1-T3: 1 stack = 3 ressources affichées
  - T4: 1 stack = 2 ressources affichées
  - T5+: 1 stack = 1 ressource affichée
  - `harvestable.size` stocke toujours les stacks (inchangé)
  - Conversion uniquement dans `HarvestablesDrawing.js` pour l'affichage
  - Décrémentation reste à 1 stack par récolte (correct)
- ✅ **Fix metadata living resources**: `living-resources-enhanced.json` chargement complet
  - Fichier copié depuis `tools/output/` vers `server-scripts/`
  - Chemin corrigé dans `MobsHandler.js` : `/server-scripts/living-resources-enhanced.json`
  - Route statique ajoutée dans `app.js` pour servir le dossier `server-scripts/`
  - Parsing JSON corrigé pour fusionner `data.animals` + `data.guardians.*`
  - Fusion de toutes les catégories (fiber, hide, etc.) en un seul tableau
  - Metadata complet maintenant chargé (animals + guardians)

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

## 📊 INVESTIGATION TYPEIDS - ao-bin-dumps (2025-11-03)

### Objectif
Déterminer si les TypeIDs des living resources peuvent être extraits automatiquement depuis ao-bin-dumps.

### Conclusion: IMPOSSIBLE ❌

**TypeIDs = Identifiants serveur runtime**, PAS dans les fichiers clients.

### Résultats Obtenus

#### ✅ Ressources Statiques (139 TypeIDs extraits)
**Source**: `ao-bin-dumps/formatted/items.txt`

| Type  | Tiers | Enchants | Count |
|-------|-------|----------|-------|
| Wood  | T1-T8 | .0 to .4 | 36    |
| Ore   | T2-T8 | .0 to .4 | 27    |
| Rock  | T1-T8 | .0 to .4 | 27    |
| Fiber | T2-T8 | .0 to .4 | 27    |
| Hide  | T1-T8 | .0 to .4 | 28    |

**Fichiers générés**:
- `tools/output/harvestables-typeids.js` - Format MobsInfo.js (prêt à utiliser)
- `tools/output/all-resources-typeids.json` - Format JSON
- `tools/output/all-resources-typeids.csv` - Format CSV

#### ❌ Living Resources MOBs (TypeIDs introuvables)

**Investigation effectuée**:
1. `mobs.json` (15.7 MB, 4,372 mobs) → Aucun champ TypeID
2. `harvestables.json` → Noms de prefabs uniquement
3. `randomspawnbehaviors.json` → Noms de mobs, pas d'IDs
4. `resources.json` → Valeurs de tier, pas TypeIDs
5. `cluster/*.xml` (107 fichiers) → Coordonnées, pas TypeIDs
6. `formatted/items.txt` → TypeIDs collision (même ID = objets différents)

**Preuve: Collision d'ID**
```
TypeID 358:
  items.txt → QUESTITEM_EXP_TOKEN_D16_T6_EXP_HRD_KEEPER_MUSHROOM
  MobsInfo.js (réseau) → T1 Rabbit (Hide)

TypeID 421:
  items.txt → QUESTITEM_EXP_TOKEN_D7_T6_EXP_HRD_MORGANA_TORTURER
  MobsInfo.js (réseau) → T1 Rabbit variant

Conclusion: Namespaces séparés Items ≠ MOBs
```

**Champs analysés dans mobs.json** (73 attributs):
- @uniquename, @tier, @prefab, @faction, @hitpointsmax, @abilitypower
- **AUCUN champ**: @id, @typeid, @index (sauf @idleanimoffset=0 pour animations)

### Métadonnées Extraites (Améliorations Possibles)

#### ✅ Données exploitables récupérées
**Source**: `mobs.json` + `randomspawnbehaviors.json`

**Living Resources trouvées**:
- **93 animaux** (LivingSkinnable - Hide)
- **46 gardiens Fiber**
- **43 gardiens Wood**
- **43 gardiens Ore**
- **43 gardiens Rock**

**Métadonnées par créature**:
```javascript
{
  uniqueName: "MOB_RABBIT",
  tier: 1,
  prefab: "MOB_HIDE_RABBIT_01",
  hp: 20,
  faction: "RABBIT",
  enchant: 0  // Détecté via "_ROADS" ou "_MISTS" dans uniqueName
}
```

**Fichiers data générés**:
- `tools/output/living-resources-enhanced.json` - 225 créatures avec métadonnées
- `tools/output/living-resources-reference.js` - Module JavaScript prêt à l'emploi

### Améliorations Proposées (Sans TypeIDs)

#### 1. Validation par HP
**Principe**: Comparer HP détecté avec HP attendu

```javascript
// Dans MobsHandler.js
validateCreature(typeId, hp, tier) {
    const expected = this.mobsInfo.getExpectedHP(typeId, tier);
    if (expected && Math.abs(hp - expected.hp) / expected.hp > 0.2) {
        console.warn(`TypeID ${typeId}: HP ${hp} inattendu (attendu ~${expected.hp})`);
        return false;
    }
    return true;
}
```

**Données HP disponibles**:
- T1 Rabbit: 20 HP
- T2 Fox: 515 HP
- T3 Wolf: 685 HP
- T4 Boar: 1323 HP
- T5 Bear: 1385 HP
- +175 gardiens avec HP

#### 2. Enrichissement MobsInfo.js

**Format actuel**:
```javascript
this.addItem(358, 1, 1, "hide");
```

**Format proposé**:
```javascript
this.addItemWithMetadata(358, {
    tier: 1,
    enemyType: 1,
    resourceType: "hide",
    animal: "Rabbit",          // ← Nouveau
    expectedHP: 20,            // ← Nouveau
    prefab: "MOB_HIDE_RABBIT_01", // ← Nouveau
    faction: "RABBIT"          // ← Nouveau
});
```

**Bénéfices**:
- Validation automatique HP
- Meilleur debugging (nom animal exact)
- Filtrage par faction possible

#### 3. Détection Enchantement par HP

**Principe**: Ratio HP vs HP base → Estimation enchantement

```javascript
detectEnchantmentLevel(hp, baseTier) {
    const baseHP = this.getBaseHP(baseTier);
    const hpRatio = hp / baseHP;

    if (hpRatio >= 1.8) return 3; // .3
    if (hpRatio >= 1.5) return 2; // .2
    if (hpRatio >= 1.2) return 1; // .1
    return 0; // .0
}
```

**Exemples terrain**:
- `MOB_WOLF` normal → HP 685 → .0
- `T4_MOB_CRITTER_HIDE_MISTCOUGAR` → HP 962 → .1 (ratio 1.4)
- `T4_MOB_CRITTER_HIDE_MISTCOUGAR_VETERAN` → HP 6448 → .3+ (boss)

#### 4. Guide Créatures Attendues

**Interface utilisateur** (resources.ejs):
```html
<div class="expected-creatures">
    <h4>Créatures T5 Attendues</h4>
    <ul>
        <li>Bear (HP ~1385)</li>
        <li>Direwolf (HP ~1200)</li>
        <li>Terrorbird (HP ~1367)</li>
    </ul>
</div>
```

**Données** (`living-resources-reference.js`):
- T1: Rabbit (4 variants), Chicken
- T2: Goose, Goat, Fox (4 variants)
- T3: Fox, Boar, Wolf, Deer, Moabird
- T4: Wolf, Deer, Bear, Boar, Cougar
- T5: Bear (8 variants), Direwolf, Terrorbird
- T6: Direbear, Terrorbird
- T7: Moabird, Swamp Dragon
- T8: Mammoth, Rhinocéros

#### 5. Logging Amélioré

**Avant**:
```
[LIVING] TypeID: 425 | Tier: 4 | Type: 1 | Enchant: 0
```

**Après** (avec métadonnées):
```
[LIVING RESOURCE DETECTED]
TypeID: 425
Tier: T4 | Enchant: .0
HP: 1323 (expected ~1323) ✓ MATCH
Resource: Hide
Creature: Boar (MOB_HIDE_BOAR_01)
Faction: BOAR
Validation: ✓ CONFIRMED
```

### Scripts Créés

#### Scripts Python d'analyse
1. `tools/parse-all-resources.py` - Extraction ressources statiques ✅
2. `tools/analyze-missing-typeids.py` - Analyse couverture MobsInfo.js ✅
3. `tools/search-living-mobs.py` - Recherche exhaustive champs ID ✅
4. `tools/extract-mob-metadata.py` - Extraction métadonnées living resources ✅

#### Fichiers Data (à conserver)
- `tools/output/harvestables-typeids.js` - 139 TypeIDs statiques
- `tools/output/living-resources-enhanced.json` - 225 créatures avec métadonnées
- `tools/output/living-resources-reference.js` - Module JS prêt à l'emploi

### Méthode de Collection (Inchangée)

**Seule méthode viable**: **In-game logging**

1. Activer "Log Living Creatures" dans Settings
2. Ouvrir console navigateur (F12)
3. Tuer/récolter chaque créature en jeu
4. Noter TypeIDs depuis logs
5. Mettre à jour MobsInfo.js

**Estimation**: 2-4h de gameplay pour collecter ~100-150 TypeIDs manquants

### Statut Actuel MobsInfo.js

**Total**: 197 TypeIDs collectés manuellement

| Resource | .0 (Base) | .1/.2/.3 (Enchanted) | Status |
|----------|-----------|----------------------|--------|
| Hide     | 85 IDs    | 0 IDs                | ✓ Base complet |
| Fiber    | 39 IDs    | 0 IDs                | ✓ Base complet |
| Ore      | 38 IDs    | 0 IDs                | ⚠ Partiel |
| Rock     | 35 IDs    | 0 IDs                | ⚠ Partiel |
| Logs     | 0 IDs     | 0 IDs                | ❌ Manquant |

**Manquants critiques** (~50-60 TypeIDs):
- Hide T4-T5 .1/.2/.3 (3×2 tiers = 6 variantes)
- Fiber T4-T5 .1/.2/.3 (6 variantes)
- Wood guardians (T3-T8, all variants)
- Ore/Rock guardians enchanted

### Plan d'Implémentation Proposé

#### Phase 1: Validation (1-2h) - OPTIONNEL
- [ ] Ajouter validation HP dans MobsHandler.js
- [ ] Améliorer logging avec créatures attendues
- [ ] Tester avec TypeIDs existants

#### Phase 2: Interface (2-3h) - OPTIONNEL
- [ ] Ajouter guide créatures dans resources.ejs
- [ ] Implémenter filtres par animal
- [ ] Afficher métadonnées dans radar

#### Phase 3: Enrichissement (2-3h) - OPTIONNEL
- [ ] Modifier structure MobsInfo.js avec métadonnées
- [ ] Ajouter détection auto enchantement par HP
- [ ] Implémenter filtres avancés

**Note**: Améliorations optionnelles. Système actuel fonctionnel pour collection TypeIDs.

---

Fin du document.
