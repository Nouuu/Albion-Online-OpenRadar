# 📋 TODO - Living Resources Detection

**Dernière mise à jour**: 2025-11-01  
**État**: Phase 1 & 2 TERMINÉES ✅

> 📖 **Pour les détails techniques complets, voir [DEV_NOTES.md](DEV_NOTES.md)**

---

## ✅ TERMINÉ

- ✅ Phase 1: Infrastructure & Cross-référence
- ✅ Phase 2: UI & Filtrage utilisateur
- ✅ Cache localStorage avec Clear/Show buttons
- ✅ Hide Detection (100%)
- ✅ Logs JSON/NDJSON structurés
- ✅ Code propre sans workarounds

---

## 🔄 EN COURS / À FAIRE

### Court terme
- [x] **Scraper living resources TypeIDs** → 235 TypeIDs extraits ✅
- [x] **Fusionner dans MobsInfo.js unique** → Plus de doublons ✅
- [x] **Corriger affichage Fiber cadavres** → mobinfo priority ✅
- [x] **Corriger TypeID 528** → Fiber T3 (était Rock T4) ✅
- [x] **"Superposition"** → Analysé, comportement normal (objets différents) ✅
- [x] **Créer outils d'analyse logs** → tools/ folder ✅
- [x] **Nettoyage & organisation** → Documentation claire ✅
- [ ] **Tests terrain complets** - Valider tous types (Fiber/Hide/Wood/Ore/Rock)
- [ ] **Vérifier 12 TypeID suspects** (range 523-537) - Optionnel/Progressif
- [ ] Session longue stabilité (2h+)

### Moyen terme (Phase 3)
- [ ] **EventNormalizer** (refactoring architectural majeur)
  - Buffer temporel 300ms
  - Centralisation des décisions
  - Résolution race conditions
  - Correction détection Fiber

### Long terme
- [ ] Métriques de qualité de détection
- [ ] Feature flag pour rollout progressif
- [ ] Tuning heuristics automatique

---

## ⚠️ LIMITATIONS CONNUES

- **Fiber detection**: Partielle (~60%) - Bug serveur Albion
- **TypeID 65535**: Blacklisté (instable)
- **Race conditions**: Attente EventNormalizer (Phase 3)

---

## 📚 DOCUMENTS DE RÉFÉRENCE

- **DEV_NOTES.md** - Documentation technique complète
- **CLAUDE.md** - Notes de développement avec Claude
- **README.md** - Documentation utilisateur

---

Fin du TODO.


        // 👇 NOUVEAU BLOC - Logging spécifique pour Living Resources
        if (this.settings.logLivingCreatures) {
            if (h.type == EnemyType.LivingSkinnable || h.type == EnemyType.LivingHarvestable) {
                const typeLabel = h.type == EnemyType.LivingSkinnable ? "LivingSkinnable" : "LivingHarvestable";
                console.log(`🔍 LIVING RESOURCE FOUND:`);
                console.log(`   Type: ${typeLabel}`);
                console.log(`   Name: ${h.name}`);
                console.log(`   Tier: ${h.tier}`);
                console.log(`   TypeID: ${typeId}`);
                console.log(`   Health: ${health} ${health > 0 ? '(ALIVE ✅)' : '(DEAD ❌)'}`);
                console.log(`   Enchant: ${enchant}`);
            }
        }
        // 👆 FIN NOUVEAU BLOC

        if (h.type == EnemyType.LivingSkinnable)
        {
            /* ... reste du code inchangé ... */
```

**Alternative - Logging amélioré avec formatage CSV** :

Ajouter une méthode helper dans la classe `MobsHandler` :

```javascript
// 👇 NOUVELLE MÉTHODE - À ajouter après le constructeur (ligne ~75)
logLivingCreatureCSV(id, typeId, health, enchant, rarity, tier, type, name)
{
    const typeLabel = type == EnemyType.LivingSkinnable ? "Skinnable" : "Harvestable";
    const isAlive = health > 0 ? "ALIVE" : "DEAD";
    const timestamp = new Date().toISOString();
    
    console.log(`[LIVING_RESOURCE] ${timestamp},${typeId},${tier},${name},${typeLabel},${enchant},${health},${isAlive}`);
}
```

Puis l'utiliser dans `AddEnemy` :

```javascript
if (this.settings.logLivingCreatures) {
    if (h.type == EnemyType.LivingSkinnable || h.type == EnemyType.LivingHarvestable) {
        this.logLivingCreatureCSV(id, typeId, health, enchant, rarity, h.tier, h.type, h.name);
    }
}
```

---

### 3️⃣ `views/main/resources.ejs`

**Ligne ~847** - Ajouter une checkbox dans la section Debug :

```html
<!-- Après settingLivingResourcesID -->
<label class="flex items-center">
    <input type="checkbox" id="settingLivingResourcesID" class="h-5 w-5 text-indigo-600 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
    <span id="id-text" class="dark:text-white ml-2">Show ID</span>
</label>

<!-- 👇 NOUVEAU -->
<label class="flex items-center">
    <input type="checkbox" id="settingLogLivingCreatures" class="h-5 w-5 text-indigo-600 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
    <span class="dark:text-white ml-2">🔍 Log Living Creatures to Console</span>
</label>
```

**Ligne ~1850** - Ajouter le script d'initialisation :

```javascript
// Après settingLivingResourcesID
let settingLivingResourcesID = document.getElementById("settingLivingResourcesID");
settingLivingResourcesID.checked = returnLocalBool("settingLivingResourcesID");
settingLivingResourcesID.addEventListener("click", () => {localStorage.setItem("settingLivingResourcesID", settingLivingResourcesID.checked);});

// 👇 NOUVEAU
let settingLogLivingCreatures = document.getElementById("settingLogLivingCreatures");
settingLogLivingCreatures.checked = returnLocalBool("settingLogLivingCreatures");
settingLogLivingCreatures.addEventListener("click", () => {
    localStorage.setItem("settingLogLivingCreatures", settingLogLivingCreatures.checked);
    if (settingLogLivingCreatures.checked) {
        console.log("🔍 Living Creatures Logging ENABLED");
        console.log("📋 CSV Header: Timestamp,TypeID,Tier,Name,Type,Enchant,Health,State");
    } else {
        console.log("🔍 Living Creatures Logging DISABLED");
    }
});
```

---

### 4️⃣ `scripts/Utils/languages/english.json`

**Ligne ~52** - Ajouter la traduction :

```json
"debug": "Debug",
"size": "Show Size",
"health": "Show Health",
"id": "Show ID",
"log-living": "Log Living Creatures"
```

**Optionnel** - Ajouter dans les autres fichiers de langue (`french.json`, `russian.json`, etc.)

---

## 🧪 Tests à effectuer

### Checklist de validation

- [ ] Le checkbox "Log Living Creatures" apparaît dans l'UI
- [ ] Le paramètre se sauvegarde dans le localStorage
- [ ] Activer le logging affiche un message de confirmation dans la console
- [ ] Les logs apparaissent quand on rencontre des créatures
- [ ] Les logs contiennent toutes les informations nécessaires :
    - TypeID
    - Tier
    - Name (fiber, hide, Logs, ore, rock)
    - Type (Skinnable ou Harvestable)
    - Enchant level
    - Health
    - État (ALIVE/DEAD)

### Scénarios de test

1. **Test basique**
    - Activer le logging
    - Se déplacer en jeu
    - Vérifier que les créatures sont loggées

2. **Test des différents types**
    - Tester dans différents biomes (Forest, Mountain, Swamp, etc.)
    - Vérifier fiber, hide, wood, ore, rock
    - Tester différents tiers (T3, T4, T5, etc.)

3. **Test vivant/mort**
    - Logger une créature vivante
    - Tuer la créature
    - Vérifier si un nouveau log apparaît pour l'état mort

---

## 📊 Format de collecte des données

### Template pour noter les IDs découverts

Créer un fichier `LIVING_RESOURCES_IDS.md` :

```markdown
# Living Resources IDs Database

## Fiber (Living Harvestable)
- T3 ALIVE: TypeID ?
- T3 DEAD: TypeID 634 ✅
- T4 ALIVE: TypeID ?
- T4 DEAD: TypeID 635 ✅
- ...

## Hide (Living Skinnable)
### Rabbits
- T1 ALIVE: TypeID ?
- T1 DEAD: TypeID ?
### Fox
- T2 ALIVE: TypeID ?
- T2 DEAD: TypeID ?
...

## Wood (Living Harvestable)
...

## Ore (Living Harvestable)
...

## Rock (Living Harvestable)
...
```

---

## 🔄 Workflow de collecte

1. **Activer le logging** dans les paramètres
2. **Ouvrir la console** du navigateur (F12)
3. **Se déplacer en jeu** dans différentes zones
4. **Copier les logs** régulièrement
5. **Noter les TypeIDs** dans le fichier de tracking
6. **Répéter** pour tous les biomes et tiers

### Commande console utile

Pour filtrer uniquement les living resources dans la console :

```javascript
// Coller ça dans la console pour filtrer
console.log("=== FILTERED LIVING RESOURCES ===");
// Les logs avec [LIVING_RESOURCE] seront facilement identifiables
```

---

## 📝 Notes importantes

### Ce qui NE sera PAS fait en Phase 1
- ❌ Pas d'affichage graphique sur le radar
- ❌ Pas de distinction visuelle vivant/mort
- ❌ Pas de filtres UI pour activer/désactiver par type
- ❌ Pas de modification de `MobsInfo.js` (collecte uniquement)

### Ce qui SERA fait en Phase 1
- ✅ Système de logging fonctionnel
- ✅ Checkbox UI pour activer/désactiver
- ✅ Logs détaillés avec toutes les infos
- ✅ Format CSV pour faciliter l'analyse
- ✅ Base de données d'IDs complète

---

## 🚀 Phase 2 (Prévue après Phase 1)

Une fois les IDs collectés :

1. Ajouter les IDs dans `MobsInfo.js`
2. Créer icônes distinctes pour vivant/mort
3. Ajouter filtres UI
4. Implémenter l'affichage sur le radar
5. Tests complets

### 📚 Référence: Implémentation dans `imp-mob-ids` branch

La branche `imp-mob-ids` montre comment Phase 2 devrait être implémentée:

**Structure Settings.js modernisée:**
```javascript
// ANCIENNE structure (main branch) - À ÉVITER
this.harvestingLivingFiber = {
    e0: [false, false, ...],  // Tiers pour enchant 0
    e1: [false, false, ...],  // Tiers pour enchant 1
    // ...
}

// NOUVELLE structure (imp-mob-ids) - RECOMMANDÉE
this.harvestingLivingFiberTiers = [false, false, false, false, false, false, false, false]; // T1-T8
this.harvestingLivingFiberEnchants = [false, false, false, false, false, false]; // E0-E5
```

**Avantages de la nouvelle structure:**
- ✅ Plus simple à gérer (séparation Tiers/Enchants)
- ✅ Logique de filtrage dans MobsHandler plus lisible
- ✅ localStorage keys plus claires (`settingLivingFiberT3`, `settingLivingFiberE1`)
- ✅ UI plus intuitive avec checkboxes séparées

**Code de référence MobsHandler.js (imp-mob-ids:170-228):**
```javascript
// Exemple pour LivingHarvestable avec type "fiber"
if (h.name == "fiber") {
    if ((!this.settings.harvestingLivingFiberTiers[h.tier-1] ||
         !this.settings.harvestingLivingFiberEnchants[enchant])) {
        this.harvestablesNotGood.push(h);
        return;
    }
}
```

**Pour Phase 1 (logging):**
Si vous voulez être compatible avec `imp-mob-ids`, utilisez la nouvelle structure dès maintenant dans votre logging code.

---

## 📞 Support

Pour toute question ou partage d'IDs découverts :
- GitHub Issues: [Lien vers le repo]
- Discord: [Lien Discord du projet]
- Contact: @Nouuu

---

## ✅ Checklist finale avant commit

- [ ] Tous les fichiers modifiés sont testés
- [ ] Le code compile sans erreur
- [ ] Le logging fonctionne correctement
- [ ] La documentation est à jour
- [ ] Les commentaires sont clairs
- [ ] Le localStorage fonctionne
- [ ] La console affiche les logs au bon format

---

**Bon courage pour la collecte ! 🎮🔍**