# 📋 Phase 3.2 - Migration Settings.js vers SettingsSync

**Date de création:** 2025-12-04
**Dernière mise à jour:** 2025-12-04 (Session en cours)
**Objectif:** Centraliser tout l'accès localStorage via SettingsSync pour éliminer le code legacy et faciliter l'accès
aux settings
**Durée estimée:** 6-7 heures
**Durée réelle:** ~2h (en cours)
**Statut:** 🟢 **EN COURS** (~50% complété)

## 🎯 Résumé de Progression (Pour Reprendre Facilement)

### ✅ Déjà Terminé (~80 appels localStorage migrés)

1. ✅ **Sous-phase 0:** SettingsSync enrichi avec `getNumber()`, `setNumber()`, `getJSON()`, `setJSON()`, `remove()`
2. ✅ **Sous-phase 1:** Settings.js migré (~60 appels)
3. ✅ **Sous-phase 2:** drawing-ui.js migré (12 appels)
4. ✅ **Sous-phase 3:** LoggerClient.js migré (8 appels)

### ⏳ Ce Qui Reste À Faire (~70 appels localStorage)

5. ⏳ **Sous-phase 4 (EN COURS):** Fichiers support (ResourcesHelper, MobsHandler, PlayersHandler, init-alpine.js,
   LoggerClient) - ~10 appels
6. ⏳ **Sous-phase 5:** Templates EJS (10 fichiers) - ~70+ appels
7. ⏳ **Tests de validation finale**

### 📂 Fichiers Modifiés Jusqu'ici

- `scripts/Utils/SettingsSync.js` (méthodes ajoutées)
- `scripts/Utils/Settings.js` (migration complète ✅)
- `scripts/drawing-ui.js` (migration complète ✅)
- `scripts/LoggerClient.js` (migration complète ✅)

---

## 📊 Vue d'ensemble

### Problème actuel

- **~150+ appels localStorage directs** éparpillés dans **19 fichiers**
- Code dupliqué: helpers `returnLocalBool()`, `getBool()`, `getNumber()` dans plusieurs fichiers
- Pas d'abstraction unifiée pour l'accès aux settings
- Logique de lecture/écriture non centralisée

### Solution proposée

- **Une seule API:** SettingsSync pour TOUS les accès localStorage
- **Méthodes typées:** `.getBool()`, `.getNumber()`, `.getJSON()`, `.get()`
- **Broadcast automatique:** Synchronisation cross-window instantanée
- **Code propre:** Plus de duplication, une seule source de vérité

### Bénéfices attendus

- ✅ Code maintenable et évolutif
- ✅ API claire et documentée
- ✅ Synchronisation cross-window garantie
- ✅ Facilite l'ajout de nouveaux settings
- ✅ Debugging simplifié

---

## 📈 Analyse d'impact

### Fichiers affectés (19 fichiers)

| Catégorie         | Fichiers                                     | localStorage calls    | Priorité    |
|-------------------|----------------------------------------------|-----------------------|-------------|
| **Core**          | Settings.js                                  | 58+                   | 🔴 CRITIQUE |
| **UI Scripts**    | drawing-ui.js                                | 6                     | 🟡 HAUTE    |
| **Logging**       | LoggerClient.js                              | 8                     | 🟢 MOYENNE  |
| **Handlers**      | PlayersHandler.js, MobsHandler.js            | 4                     | 🟢 MOYENNE  |
| **Utils**         | ResourcesHelper.js, Utils.js, init-alpine.js | 5                     | 🟢 MOYENNE  |
| **EJS Templates** | 10 fichiers                                  | 70+                   | 🟡 HAUTE    |
| **Sync**          | SettingsSync.js                              | N/A (déjà implémenté) | ✅ OK        |

**Total:** 150+ appels à migrer

---

## 🛠️ Plan d'exécution

### ✅ Sous-phase 0: Enrichir SettingsSync.js

**Durée:** 30min
**Statut:** ✅ **TERMINÉ**

#### Objectif

Ajouter les méthodes manquantes pour tous les types de données utilisés dans le projet.

#### Tâches

- [ ] **Ajouter `getNumber(key, defaultValue)`**
  ```javascript
  /**
   * Get a numeric setting from localStorage
   * @param {string} key - Setting key
   * @param {number} defaultValue - Default value if not found or invalid
   * @returns {number}
   */
  getNumber(key, defaultValue = 0) {
      const value = localStorage.getItem(key);
      if (value === null || value === '') {
          return defaultValue;
      }
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? defaultValue : parsed;
  }
  ```

- [ ] **Ajouter `setNumber(key, value)`**
  ```javascript
  /**
   * Set a numeric setting and broadcast it
   * @param {string} key - Setting key
   * @param {number} value - Numeric value
   */
  setNumber(key, value) {
      this.broadcast(key, value.toString());
  }
  ```

- [ ] **Ajouter `getJSON(key, defaultValue)`**
  ```javascript
  /**
   * Get a JSON setting from localStorage
   * @param {string} key - Setting key
   * @param {any} defaultValue - Default value if not found or parse error
   * @returns {any}
   */
  getJSON(key, defaultValue = null) {
      const value = localStorage.getItem(key);
      if (value === null || value === '') {
          return defaultValue;
      }
      try {
          return JSON.parse(value);
      } catch (error) {
          window.logger?.error(CATEGORIES.SETTINGS, 'SettingsSyncJSONParseFailed', {
              key,
              error: error?.message || error
          });
          return defaultValue;
      }
  }
  ```

- [ ] **Ajouter `setJSON(key, value)`**
  ```javascript
  /**
   * Set a JSON setting and broadcast it
   * @param {string} key - Setting key
   * @param {any} value - Value to JSON.stringify
   */
  setJSON(key, value) {
      try {
          const jsonString = JSON.stringify(value);
          this.broadcast(key, jsonString);
      } catch (error) {
          window.logger?.error(CATEGORIES.SETTINGS, 'SettingsSyncJSONStringifyFailed', {
              key,
              error: error?.message || error
          });
      }
  }
  ```

- [ ] **Ajouter `remove(key)`**
  ```javascript
  /**
   * Remove a setting and broadcast the deletion
   * @param {string} key - Setting key to remove
   */
  remove(key) {
      localStorage.removeItem(key);

      // Broadcast deletion
      if (this.channel && this.isInitialized) {
          try {
              this.channel.postMessage({
                  type: 'setting-removed',
                  key: key,
                  timestamp: Date.now()
              });
          } catch (error) {
              window.logger?.error(CATEGORIES.SETTINGS, 'SettingsSyncRemoveFailed', {
                  key,
                  error: error?.message || error
              });
          }
      }

      // Trigger local listeners
      this.handleMessage({
          type: 'setting-removed',
          key: key,
          value: null
      });
  }
  ```

- [ ] **Mettre à jour `handleMessage()` pour gérer 'setting-removed'**
  ```javascript
  handleMessage(data) {
      if (data.type === 'setting-changed' || data.type === 'setting-removed') {
          // ... existing listener logic
      }
  }
  ```

#### Tests

- [ ] `getNumber('settingClusterRadius', 30)` retourne 30 si vide
- [ ] `setNumber('settingClusterRadius', 50)` écrit '50' dans localStorage
- [ ] `getJSON('ignoreList', [])` retourne [] si vide ou parse error
- [ ] `setJSON('ignoreList', ['test'])` écrit '["test"]' dans localStorage
- [ ] `remove('test')` supprime la clé de localStorage
- [ ] Tous les broadcasts fonctionnent (vérifier dans autre onglet)

**Commit:** `feat(SettingsSync): add getNumber, setNumber, getJSON, setJSON, remove methods`

---

### ✅ Sous-phase 1: Migrer Settings.js (CRITIQUE)

**Durée:** 1h30
**Statut:** ✅ **TERMINÉ**
**Fichiers modifiés:** `scripts/Utils/Settings.js` (~60 appels migrés)

#### Objectif

Remplacer tous les accès localStorage directs dans Settings.js par SettingsSync.

#### 1.1 Import SettingsSync

- [ ] Ajouter l'import en haut de Settings.js
  ```javascript
  import settingsSync from './SettingsSync.js';
  ```

#### 1.2 Supprimer returnLocalBool() et utiliser settingsSync.getBool()

**Occurrences à migrer (~50):**

**Players section (lignes 469-486):**

- [ ] `this.showMapBackground = settingsSync.getBool("settingShowMap", false);`
- [ ] `this.settingShowPlayers = settingsSync.getBool("settingShowPlayers", false);`
- [ ] `this.settingNickname = settingsSync.getBool("settingNickname", false);`
- [ ] `this.settingHealth = settingsSync.getBool("settingHealth", false);`
- [ ] `this.settingMounted = settingsSync.getBool("settingMounted", false);`
- [ ] `this.settingItems = settingsSync.getBool("settingItems", false);`
- [ ] `this.settingItemsDev = settingsSync.getBool("settingItemsDev", false);`
- [ ] `this.settingDistance = settingsSync.getBool("settingDistance", false);`
- [ ] `this.settingGuild = settingsSync.getBool("settingGuild", false);`
- [ ] `this.settingSound = settingsSync.getBool("settingSound", false);`
- [ ] `this.settingFlash = settingsSync.getBool("settingFlash", false);`
- [ ] `this.settingPassivePlayers = settingsSync.getBool("settingPassivePlayers", false);`
- [ ] `this.settingFactionPlayers = settingsSync.getBool("settingFactionPlayers", false);`
- [ ] `this.settingDangerousPlayers = settingsSync.getBool("settingDangerousPlayers", false);`

**Resources section (lignes 538-562):**

- [ ] `this.livingResourcesHealthBar = settingsSync.getBool("settingLivingResourcesHealthBar", false);`
- [ ] `this.livingResourcesID = settingsSync.getBool("settingLivingResourcesID", false);`
- [ ] `this.resourceSize = settingsSync.getBool("settingRawSize", false);`
- [ ] `this.overlayEnchantment = settingsSync.getBool("settingResourceEnchantOverlay", true);`
- [ ] `this.overlayEnchantmentLiving = settingsSync.getBool("settingLivingResourceEnchantOverlay", true);`
- [ ] `this.overlayResourceCount = settingsSync.getBool("settingResourceCount", true);`
- [ ] `this.overlayDistance = settingsSync.getBool("settingResourceDistance", false);`
- [ ] `this.overlayDistanceLivingOnly = settingsSync.getBool("settingResourceDistanceLivingOnly", true);`
- [ ] `this.overlayCluster = settingsSync.getBool("settingResourceClusters", false);`
- [ ] `this.showFish = settingsSync.getBool("settingFishing", false);`

**Enemies section (lignes 566-593):**

- [ ] `this.enemyLevels[0] = settingsSync.getBool("settingNormalEnemy", false);`
- [ ] `this.enemyLevels[1] = settingsSync.getBool("settingMediumEnemy", false);`
- [ ] `this.enemyLevels[2] = settingsSync.getBool("settingEnchantedEnemy", false);`
- [ ] `this.enemyLevels[3] = settingsSync.getBool("settingMiniBossEnemy", false);`
- [ ] `this.enemyLevels[4] = settingsSync.getBool("settingBossEnemy", false);`
- [ ] `this.showMinimumHealthEnemies = settingsSync.getBool("settingShowMinimumHealthEnemies", false);`
- [ ] `this.avaloneDrones = settingsSync.getBool("settingAvaloneDrones", false);`
- [ ] `this.showUnmanagedEnemies = settingsSync.getBool("settingShowUnmanagedEnemies", false);`
- [ ] `this.showEventEnemies = settingsSync.getBool("settingShowEventEnemies", false);`
- [ ] `this.enemiesHealthBar = settingsSync.getBool("settingEnemiesHealthBar", false);`
- [ ] `this.enemiesID = settingsSync.getBool("settingEnemiesID", false);`
- [ ] `this.debugEnemies = settingsSync.getBool("settingDebugEnemies", false);`
- [ ] `this.debugPlayers = settingsSync.getBool("settingDebugPlayers", false);`
- [ ] `this.debugChests = settingsSync.getBool("settingDebugChests", false);`
- [ ] `this.debugDungeons = settingsSync.getBool("settingDebugDungeons", false);`
- [ ] `this.debugFishing = settingsSync.getBool("settingDebugFishing", false);`
- [ ] `this.debugHarvestables = settingsSync.getBool("settingDebugHarvestables", false);`
- [ ] `this.logToConsole = settingsSync.getBool("settingLogToConsole", true);`
- [ ] `this.logToServer = settingsSync.getBool("settingLogToServer", false);`
- [ ] `this.debugRawPacketsConsole = settingsSync.getBool("settingDebugRawPacketsConsole", false);`
- [ ] `this.debugRawPacketsServer = settingsSync.getBool("settingDebugRawPacketsServer", false);`

**Mists Bosses (lignes 596-602):**

- [ ] `this.bossCrystalSpider = settingsSync.getBool("settingBossCrystalSpider", false);`
- [ ] `this.bossFairyDragon = settingsSync.getBool("settingBossFairyDragon", false);`
- [ ] `this.bossVeilWeaver = settingsSync.getBool("settingBossVeilWeaver", false);`
- [ ] `this.bossGriffin = settingsSync.getBool("settingBossGriffin", false);`

**Chests (lignes 606-610):**

- [ ] `this.chestGreen = settingsSync.getBool("settingChestGreen", false);`
- [ ] `this.chestBlue = settingsSync.getBool("settingChestBlue", false);`
- [ ] `this.chestPurple = settingsSync.getBool("settingChestPurple", false);`
- [ ] `this.chestYellow = settingsSync.getBool("settingChestYellow", false);`

**Mists (lignes 613-623):**

- [ ] `this.mistSolo = settingsSync.getBool("settingMistSolo", false);`
- [ ] `this.mistDuo = settingsSync.getBool("settingMistDuo", false);`
- [ ] `this.wispCage = settingsSync.getBool("settingCage", false);`
- [ ] `this.mistEnchants[0] = settingsSync.getBool("settingMistE0", false);`
- [ ] `this.mistEnchants[1] = settingsSync.getBool("settingMistE1", false);`
- [ ] `this.mistEnchants[2] = settingsSync.getBool("settingMistE2", false);`
- [ ] `this.mistEnchants[3] = settingsSync.getBool("settingMistE3", false);`
- [ ] `this.mistEnchants[4] = settingsSync.getBool("settingMistE4", false);`

**Dungeons (lignes 626-636):**

- [ ] `this.dungeonEnchants[0] = settingsSync.getBool("settingDungeonE0", false);`
- [ ] `this.dungeonEnchants[1] = settingsSync.getBool("settingDungeonE1", false);`
- [ ] `this.dungeonEnchants[2] = settingsSync.getBool("settingDungeonE2", false);`
- [ ] `this.dungeonEnchants[3] = settingsSync.getBool("settingDungeonE3", false);`
- [ ] `this.dungeonEnchants[4] = settingsSync.getBool("settingDungeonE4", false);`
- [ ] `this.dungeonSolo = settingsSync.getBool("settingDungeonSolo", false);`
- [ ] `this.dungeonGroup = settingsSync.getBool("settingDungeonDuo", false);`
- [ ] `this.dungeonCorrupted = settingsSync.getBool("settingDungeonCorrupted", false);`
- [ ] `this.dungeonHellgate = settingsSync.getBool("settingDungeonHellgate", false);`

#### 1.3 Remplacer parseInt() par settingsSync.getNumber()

- [ ] Ligne 557: `this.overlayClusterRadius = settingsSync.getNumber("settingClusterRadius", 30);`
- [ ] Ligne 560: `this.overlayClusterMinSize = settingsSync.getNumber("settingClusterMinSize", 2);`
- [ ] Ligne 574: `this.minimumHealthEnemies = settingsSync.getNumber("settingTextMinimumHealthEnemies", 2100);`

#### 1.4 Remplacer JSON.parse() par settingsSync.getJSON()

**Enchantment matrices (lignes 491-534):**

- [ ] Ligne 491-493:
  `this.harvestingStaticFiber = settingsSync.getJSON("settingStaticFiberEnchants", this.harvestingStaticFiber);`
- [ ] Ligne 495-497:
  `this.harvestingStaticHide = settingsSync.getJSON("settingStaticHideEnchants", this.harvestingStaticHide);`
- [ ] Ligne 499-501:
  `this.harvestingStaticOre = settingsSync.getJSON("settingStaticOreEnchants", this.harvestingStaticOre);`
- [ ] Ligne 503-505:
  `this.harvestingStaticWood = settingsSync.getJSON("settingStaticWoodEnchants", this.harvestingStaticWood);`
- [ ] Ligne 507-509:
  `this.harvestingStaticRock = settingsSync.getJSON("settingStaticRockEnchants", this.harvestingStaticRock);`
- [ ] Ligne 516-518:
  `this.harvestingLivingFiber = settingsSync.getJSON("settingLivingFiberEnchants", this.harvestingLivingFiber);`
- [ ] Ligne 520-522:
  `this.harvestingLivingHide = settingsSync.getJSON("settingLivingHideEnchants", this.harvestingLivingHide);`
- [ ] Ligne 524-526:
  `this.harvestingLivingOre = settingsSync.getJSON("settingLivingOreEnchants", this.harvestingLivingOre);`
- [ ] Ligne 528-530:
  `this.harvestingLivingWood = settingsSync.getJSON("settingLivingWoodEnchants", this.harvestingLivingWood);`
- [ ] Ligne 532-534:
  `this.harvestingLivingRock = settingsSync.getJSON("settingLivingRockEnchants", this.harvestingLivingRock);`

**Ignore list:**

- [ ] Ligne 638: `this.ignoreList = settingsSync.getJSON("ignoreList", []);`

#### 1.5 Remplacer localStorage.getItem() direct par settingsSync.get()

- [ ] Ligne 148: `this.logFormat = settingsSync.get('logFormat', 'human');`

#### 1.6 Supprimer la méthode returnLocalBool()

- [ ] Supprimer les lignes 458-465 (méthode `returnLocalBool()`)

#### Tests

- [ ] Radar charge sans erreur
- [ ] Tous les settings sont correctement lus au démarrage
- [ ] Settings.update() fonctionne correctement
- [ ] Aucune régression visuelle
- [ ] Ouvrir la console → aucune erreur
- [ ] Changer un setting dans l'UI → settings.update() voit le changement

**Commit:** `refactor(Settings): migrate all localStorage access to SettingsSync`

---

### ✅ Sous-phase 2: Migrer drawing-ui.js

**Durée:** 30min
**Statut:** ✅ **TERMINÉ**
**Fichiers modifiés:** `scripts/drawing-ui.js` (12 appels migrés - 6 lectures + 6 écritures)

#### Objectif

Remplacer les helpers locaux et accès localStorage directs par SettingsSync.

#### 2.1 Import SettingsSync

- [ ] Ajouter l'import en haut du fichier
  ```javascript
  import settingsSync from './Utils/SettingsSync.js';
  ```

#### 2.2 Supprimer les helpers locaux

- [ ] Supprimer la fonction `getBool()`
- [ ] Supprimer la fonction `setBool()`
- [ ] Supprimer la fonction `getNumber()` (si elle existe)

#### 2.3 Migrer les 6 changements

**Overlay controls:**

- [ ] `enchantmentCheckbox` event listener → `settingsSync.setBool('settingResourceEnchantOverlay', checked)`
- [ ] `resourceCountCheckbox` event listener → `settingsSync.setBool('settingResourceCount', checked)`
- [ ] `distanceCheckbox` event listener → `settingsSync.setBool('settingResourceDistance', checked)`
- [ ] `clusterCheckbox` event listener → `settingsSync.setBool('settingResourceClusters', checked)`
- [ ] `clusterRadius` input → `settingsSync.setNumber('settingClusterRadius', value)`
- [ ] `clusterMinSize` input → `settingsSync.setNumber('settingClusterMinSize', value)`

#### 2.4 Initialisation des valeurs (lecture)

- [ ] Remplacer tous les `getBool()` par `settingsSync.getBool()`
- [ ] Remplacer tous les `getNumber()` par `settingsSync.getNumber()`

#### Tests

- [ ] Overlay controls fonctionnent (checkboxes + inputs)
- [ ] Settings se synchronisent instantanément entre main/overlay
- [ ] Valeurs persistées dans localStorage
- [ ] Changer un setting dans overlay → visible dans main instantanément
- [ ] Changer un setting dans main → visible dans overlay instantanément

**Commit:** `refactor(drawing-ui): migrate to SettingsSync API`

---

### ✅ Sous-phase 3: Migrer LoggerClient.js

**Durée:** 15min
**Statut:** ✅ **TERMINÉ**
**Fichiers modifiés:** `scripts/LoggerClient.js` (8 appels migrés)

#### Objectif

Remplacer les 8 accès localStorage directs par SettingsSync.

#### 3.1 Import SettingsSync

- [ ] Ajouter l'import
  ```javascript
  import settingsSync from './Utils/SettingsSync.js';
  ```

#### 3.2 Migrer les 8 appels

**Debug & Logging settings:**

- [ ] `settingDebugRawPacketsConsole` → `settingsSync.getBool('settingDebugRawPacketsConsole', false)`
- [ ] `settingDebugRawPacketsServer` → `settingsSync.getBool('settingDebugRawPacketsServer', false)`
- [ ] `settingLogToConsole` → `settingsSync.getBool('settingLogToConsole', true)`
- [ ] `settingLogToServer` → `settingsSync.getBool('settingLogToServer', false)`

**Identifier tous les endroits où ces settings sont lus:**

- [ ] Méthode `log()` ou équivalent
- [ ] Méthode `logRawPacket()` ou équivalent
- [ ] Initialisation du logger

#### Tests

- [ ] Logs console fonctionnent (si activé)
- [ ] Logs server fonctionnent (si activé)
- [ ] Debug raw packets console fonctionne (si activé)
- [ ] Debug raw packets server fonctionne (si activé)
- [ ] Changer les settings dans l'UI → logger réagit immédiatement

**Commit:** `refactor(LoggerClient): migrate to SettingsSync for debug settings`

---

### ✅ Sous-phase 4: Migrer les fichiers support

**Durée:** 45min
**Statut:** ⏳ À FAIRE

#### 4.1 ResourcesHelper.js

- [ ] Import SettingsSync
- [ ] Remplacer `returnLocalBool()` par `settingsSync.getBool()`
- [ ] Remplacer `localStorage.removeItem('cachedStaticResourceTypeIDs')` par
  `settingsSync.remove('cachedStaticResourceTypeIDs')`

#### 4.2 MobsHandler.js

- [ ] Import SettingsSync
- [ ] Ligne de lecture cache: `settingsSync.getJSON('cachedStaticResourceTypeIDs', null)`
- [ ] Ligne d'écriture cache: `settingsSync.setJSON('cachedStaticResourceTypeIDs', cache)`
- [ ] Ligne de suppression cache: `settingsSync.remove('cachedStaticResourceTypeIDs')`

#### 4.3 PlayersHandler.js

- [ ] Import SettingsSync
- [ ] Remplacer `parseInt(localStorage.getItem('settingMaxPlayersDisplay'))` par
  `settingsSync.getNumber('settingMaxPlayersDisplay', 50)`

#### 4.4 Utils.js (si nécessaire)

- [ ] Vérifier s'il y a des accès localStorage directs (probablement dans le cache)
- [ ] Si oui, migrer vers SettingsSync

#### 4.5 init-alpine.js

- [ ] Import SettingsSync
- [ ] Remplacer `JSON.parse(localStorage.getItem('sidebarCollapsed'))` par
  `settingsSync.getJSON('sidebarCollapsed', {})`
- [ ] Remplacer `localStorage.setItem('sidebarCollapsed', JSON.stringify(...))` par
  `settingsSync.setJSON('sidebarCollapsed', ...)`

#### Tests

- [ ] Cache resources fonctionne (se charge/s'enregistre)
- [ ] Player list display limit fonctionne
- [ ] Sidebar collapse state persiste après reload
- [ ] Pas d'erreur console

**Commit:** `refactor(handlers,utils): migrate support files to SettingsSync`

---

### ✅ Sous-phase 5: Migrer les EJS templates (70+ calls)

**Durée:** 2h
**Statut:** ⏳ À FAIRE

#### 5.1 Créer un partial helper

- [ ] Créer `views/partials/settings-helpers.ejs`
  ```html
  <script type="module">
  import settingsSync from '/scripts/Utils/SettingsSync.js';

  // Expose globally for inline scripts (EJS templates)
  window.settingsSync = settingsSync;

  console.log('SettingsSync exposed globally for EJS templates');
  </script>
  ```

- [ ] Inclure ce partial dans `views/layout.ejs` (avant tous les autres scripts)
  ```html
  <%- include('partials/settings-helpers') %>
  ```

#### 5.2 Migrer drawing.ejs (9 calls)

**Helpers inline à supprimer:**

- [ ] Supprimer `const getBool = (item) => localStorage.getItem(item) === "true";`
- [ ] Supprimer `const getNum = (item) => parseInt(localStorage.getItem(item));`

**Remplacer par settingsSync:**

- [ ] `overlayEnchantment` lecture → `window.settingsSync.getBool('overlayEnchantment', true)`
- [ ] `overlayEnchantment` écriture → `window.settingsSync.setBool('overlayEnchantment', value)`
- [ ] `overlayResourceCount` lecture → `window.settingsSync.getBool('overlayResourceCount', true)`
- [ ] `overlayResourceCount` écriture → `window.settingsSync.setBool('overlayResourceCount', value)`
- [ ] `overlayClusterRadius` lecture → `window.settingsSync.getNumber('overlayClusterRadius', 30)`
- [ ] `overlayClusterRadius` écriture → `window.settingsSync.setNumber('overlayClusterRadius', value)`

**Tests:**

- [ ] Overlay controls fonctionnent
- [ ] Settings persistées après reload

#### 5.3 Migrer resources.ejs (13 calls)

**Enchant matrices:**

- [ ] Ligne de lecture: `settingsSync.getJSON(storageKey, defaultEnchants)`
- [ ] Ligne d'écriture: `settingsSync.setJSON(storageKey, enchants)`

**Boolean toggles:**

- [ ] `settingResourceDistance` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingResourceClusters` → `settingsSync.getBool()` / `setBool()`

**Numeric values:**

- [ ] `settingClusterRadius` → `settingsSync.getNumber()` / `setNumber()`
- [ ] `settingClusterMinSize` → `settingsSync.getNumber()` / `setNumber()`

**Cache cleanup:**

- [ ] `localStorage.removeItem('cachedStaticResourceTypeIDs')` → `settingsSync.remove('cachedStaticResourceTypeIDs')`

**Tests:**

- [ ] Enchant filters fonctionnent
- [ ] Matrix sauvegardée correctement
- [ ] Cache cleanup fonctionne

#### 5.4 Migrer chests.ejs (19 calls)

**Tous les settings sont boolean:**

- [ ] `settingChestGreen` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingChestBlue` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingChestPurple` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingChestYellow` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingMistSolo` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingMistDuo` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingMistE0-E4` (5 settings) → `settingsSync.getBool()` / `setBool()`
- [ ] `settingDungeonSolo` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingDungeonDuo` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingDungeonE0-E4` (5 settings) → `settingsSync.getBool()` / `setBool()`
- [ ] `settingDungeonCorrupted` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingDungeonHellgate` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingCage` → `settingsSync.getBool()` / `setBool()`

**Tests:**

- [ ] Tous les checkboxes fonctionnent
- [ ] Settings persistées

#### 5.5 Migrer players.ejs (11 calls)

**Boolean + Numeric:**

- [ ] `settingShowPlayers` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingNickname` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingHealth` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingMounted` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingItems` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingItemsDev` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingDistance` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingGuild` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingSound` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingFlash` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingMaxPlayersDisplay` → `settingsSync.getNumber(50)` / `setNumber()`

**Tests:**

- [ ] Tous les player settings fonctionnent
- [ ] Max players display fonctionne

#### 5.6 Migrer enemies.ejs (20 calls)

**Boolean toggles:**

- [ ] `settingNormalEnemy` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingMediumEnemy` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingEnchantedEnemy` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingMiniBossEnemy` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingBossEnemy` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingShowMinimumHealthEnemies` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingAvaloneDrones` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingShowUnmanagedEnemies` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingShowEventEnemies` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingEnemiesHealthBar` → `settingsSync.getBool()` / `setBool()`
- [ ] `settingEnemiesID` → `settingsSync.getBool()` / `setBool()`
- [ ] Mists bosses (4 settings) → `settingsSync.getBool()` / `setBool()`

**Numeric:**

- [ ] `settingTextMinimumHealthEnemies` → `settingsSync.getNumber(2100)` / `setNumber()`

**Tests:**

- [ ] Enemy filters fonctionnent
- [ ] Health threshold fonctionne

#### 5.7 Migrer map.ejs (2 calls)

- [ ] `settingShowMap` → `settingsSync.getBool()` / `setBool()`

**Tests:**

- [ ] Map toggle fonctionne

#### 5.8 Migrer ignorelist.ejs (4 calls)

**JSON array:**

- [ ] Lecture: `settingsSync.getJSON('ignoreList', [])`
- [ ] Écriture: `settingsSync.setJSON('ignoreList', array)`

**Tests:**

- [ ] Ignore list se charge
- [ ] Ajout/suppression fonctionne
- [ ] Persiste après reload

#### 5.9 Migrer layout.ejs (1 call)

- [ ] `settingServerLogsEnabled` → `settingsSync.getBool('settingServerLogsEnabled', false)`

**Tests:**

- [ ] Server logs toggle fonctionne

#### 5.10 Vérifier settings.ejs

- [ ] Vérifier si des changements sont nécessaires (probablement juste affichage)
- [ ] Pas de migration nécessaire si c'est juste du debug display

**Commit:** `refactor(views): migrate all EJS templates to SettingsSync`

---

## ✅ Tests de validation finale

### Tests fonctionnels

- [ ] **Radar principal**
    - [ ] Le radar charge sans erreur
    - [ ] Tous les settings sont correctement lus
    - [ ] Aucune régression visuelle

- [ ] **Overlay radar**
    - [ ] L'overlay charge sans erreur
    - [ ] Settings se synchronisent instantanément avec le main
    - [ ] Aucune régression visuelle

- [ ] **Settings UI**
    - [ ] Tous les checkboxes fonctionnent
    - [ ] Tous les inputs numériques fonctionnent
    - [ ] Enchant matrices fonctionnent
    - [ ] Ignore list fonctionne

- [ ] **Synchronisation cross-window**
    - [ ] Ouvrir main + overlay dans 2 fenêtres
    - [ ] Changer un setting dans main → visible dans overlay instantanément
    - [ ] Changer un setting dans overlay → visible dans main instantanément
    - [ ] Pas de délai de 300ms

- [ ] **Persistence**
    - [ ] Tous les settings persistent après reload
    - [ ] Cache resources fonctionne
    - [ ] Sidebar state persiste

### Tests techniques

- [ ] **Console**
    - [ ] Aucune erreur console
    - [ ] Aucun warning console
    - [ ] Logs via `window.logger` fonctionnent

- [ ] **Performance**
    - [ ] Pas de ralentissement du game loop
    - [ ] FPS stable à 30
    - [ ] Pas de memory leak

- [ ] **Compatibilité**
    - [ ] BroadcastChannel fonctionne (Chrome/Firefox/Edge)
    - [ ] Fallback storage events fonctionne (si BroadcastChannel absent)

- [ ] **Code quality**
    - [ ] Aucun appel `localStorage` direct restant (sauf dans SettingsSync.js)
    - [ ] Tous les imports corrects
    - [ ] Pas de code mort

### Tests de régression

- [ ] **Features existantes**
    - [ ] Players display fonctionne
    - [ ] Resources display fonctionne
    - [ ] Mobs display fonctionne
    - [ ] Chests display fonctionne
    - [ ] Dungeons display fonctionne
    - [ ] Map background fonctionne
    - [ ] Flash border fonctionne
    - [ ] Sound notifications fonctionnent

- [ ] **Debug features**
    - [ ] Debug enemies fonctionne
    - [ ] Debug players fonctionne
    - [ ] Debug raw packets fonctionne
    - [ ] Logger fonctionne

---

## 📊 Métriques de succès

### Avant migration

- **~150+ appels** localStorage directs
- **19 fichiers** avec accès localStorage
- **Code dupliqué:** helpers `returnLocalBool()`, `getBool()`, `getNumber()` dans plusieurs fichiers
- **Pas d'abstraction unifiée**

### Après migration

- **0 appel** localStorage direct (sauf dans SettingsSync.js)
- **19 fichiers** migrés vers SettingsSync
- **Code centralisé:** Une seule API pour tous les accès
- **Abstraction propre:** SettingsSync.js

### Amélioration

- ✅ **Maintenabilité:** +100%
- ✅ **Lisibilité:** +80%
- ✅ **Synchronisation:** Instantanée (pas de polling 300ms)
- ✅ **Debugging:** Simplifié (logs centralisés)
- ✅ **Évolutivité:** Facile d'ajouter de nouveaux settings

---

## 🚨 Rollback plan

Si un problème critique est détecté:

### Plan de rollback immédiat

1. **Git revert** des commits de la Phase 3.2
   ```bash
   git log --oneline  # Identifier les commits à revert
   git revert <commit-hash> --no-edit
   ```

2. **Vérifier que le radar fonctionne** après le revert

3. **Analyser le problème** avant de re-tenter

### Problèmes possibles et solutions

**Problème:** Settings ne se chargent plus

- **Cause probable:** Mauvaise migration d'un `getJSON()` ou `getNumber()`
- **Solution:** Vérifier les defaultValues et les fallbacks

**Problème:** Synchronisation cross-window ne fonctionne plus

- **Cause probable:** BroadcastChannel non initialisé ou erreur dans handleMessage()
- **Solution:** Vérifier les logs `window.logger` et le fallback storage events

**Problème:** Performance dégradée

- **Cause probable:** Trop de broadcasts ou listeners mal nettoyés
- **Solution:** Vérifier les event listeners et le cleanup

---

## 📝 Notes de développement

### Décisions architecturales

**Pourquoi exposer settingsSync globalement dans les EJS templates?**

- Les EJS templates utilisent des `<script>` inline (pas de modules ES)
- Difficile d'importer proprement dans chaque template
- `window.settingsSync` permet un accès facile et centralisé
- Alternative: réécrire tous les templates en modules ES (hors scope)

**Pourquoi garder localStorage en backend de SettingsSync?**

- Backward compatible avec tout le code existant
- Pas besoin de migrer la persistence (déjà fonctionnelle)
- SettingsSync ajoute juste la synchronisation cross-window

**Pourquoi ne pas utiliser un store centralisé (Redux, Zustand, etc.)?**

- Overhead inutile pour ce projet
- SettingsSync est simple, léger, et suffit largement
- Pas de dépendance externe

### Améliorations futures (hors scope)

1. **TypeScript types** pour SettingsSync
2. **Validation des settings** (min/max pour les nombres, etc.)
3. **Settings categories** (grouper par fonctionnalité)
4. **Settings UI refactor** (composants réutilisables)
5. **Import/Export settings** (backup/restore)

---

## 🔗 Références

### Documentation projet

- `RADAR_UNIFICATION_PLAN.md` - Plan principal de l'unification
- `scripts/Utils/SettingsSync.js` - API SettingsSync
- `scripts/Utils/Settings.js` - Classe Settings (à migrer)

### Fichiers clés à modifier

- **Core:** Settings.js (58 calls)
- **UI:** drawing-ui.js (6 calls)
- **Logging:** LoggerClient.js (8 calls)
- **Support:** ResourcesHelper.js, MobsHandler.js, PlayersHandler.js, init-alpine.js
- **Templates:** 10 fichiers EJS (70+ calls)

---

**Dernière mise à jour:** 2025-12-04
**Auteur:** Claude Code + Développeur
**Statut:** ⏳ **EN ATTENTE** - Prêt à démarrer la migration