# 🐛 Debug & Logging System - Guide Complet

> **Date:** 2025-11-05  
> **Version:** 2.0 - Système centralisé avec mise à jour dynamique

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Contrôles Utilisateur](#contrôles-utilisateur)
4. [Système Technique](#système-technique)
5. [Guide Développeur](#guide-développeur)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Vue d'ensemble

### Objectif
Fournir un système de debug et logging **centralisé**, **dynamique** et **facile d'utilisation** pour tracer les événements dans le radar Albion Online.

### Principes
- ✅ **Centralisation** : Tous les contrôles dans Settings.ejs
- ✅ **Pas de duplication** : Un seul endroit pour chaque setting
- ✅ **Mise à jour dynamique** : Changements instantanés sans reload
- ✅ **Persistance** : Settings sauvegardés dans localStorage

---

## 🏗️ Architecture

### Flux de Données

```
┌─────────────────┐
│  Settings.ejs   │ ← Utilisateur change une checkbox
│  (Interface)    │
└────────┬────────┘
         │ onChange event
         ▼
┌─────────────────┐
│  localStorage   │ ← Sauvegarde automatique
│   (Storage)     │
└────────┬────────┘
         │ Custom setItem override
         ▼
┌─────────────────┐
│   Settings.js   │ ← settings.update() appelé automatiquement
│   (État)        │
└────────┬────────┘
         │ Propriétés mises à jour
         ▼
┌─────────────────┐
│   Handlers      │ ← Vérifient this.settings.logXXX
│  (Logique)      │
└─────────────────┘
```

### Composants

#### 1. **Interface Utilisateur** (views/main/settings.ejs)
- **Section "🐛 Debug & Logging"**
- 3 checkboxes globales
- Bouton Download Debug Logs
- Liens vers pages spécialisées

#### 2. **Stockage** (localStorage)
- Clés préfixées par `setting`
- Valeurs: `"true"` ou `"false"` (strings)
- Persistant entre sessions

#### 3. **État Global** (scripts/Utils/Settings.js)
- Classe `Settings` avec propriétés
- Méthode `update()` pour rafraîchir
- Méthode `returnLocalBool()` pour lire

#### 4. **Handlers** (scripts/Handlers/*.js)
- Vérifient `this.settings.logXXX`
- Loggent conditionnellement
- Accès en lecture seule

---

## 🎛️ Contrôles Utilisateur

### Settings Page (Centralisé)

#### Global Logging Toggles

| Checkbox | localStorage Key | Propriété Settings | Usage |
|----------|------------------|-------------------|-------|
| 📊 Living Creatures (mobs) | `settingLogLivingCreatures` | `this.logLivingCreatures` | Log JSON enhanced des mobs vivants |
| 🔍 Living Resources (CSV) | `settingLogLivingResources` | `this.logLivingResources` | Log CSV des ressources récoltées |
| 🐛 Debug Enemies (verbose) | `settingDebugEnemies` | `this.debugEnemies` | Debug verbose des ennemis |

#### Visual Overlays (Pages Spécialisées)

| Page | Contrôles | localStorage Keys |
|------|-----------|-------------------|
| **Enemies** | Health Bar, Show ID | `settingEnemiesHealthBar`, `settingEnemiesID` |
| **Resources** | Health Bar, Show ID | `settingLivingResourcesHealthBar`, `settingLivingResourcesID` |

#### Actions

| Bouton | Localisation | Fonction |
|--------|-------------|----------|
| 💾 Download Debug Logs | Settings | Exporte JSON avec session info + tous les settings |
| 📋 Log Enemies | Drawing (Radar) | Log la liste des ennemis actuels dans console |
| 👁️ View Cache | Resources | Affiche le cache TypeID dans console |
| 🗑️ Clear Cache | Resources | Vide le cache TypeID et propose reload |

---

## ⚙️ Système Technique

### 1. Mise à Jour Dynamique

#### Mécanisme (scripts/Utils/Utils.js)

```javascript
// Override localStorage.setItem pour détecter les changements
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    
    if (key.startsWith('setting')) {
        console.log(`🔄 [Settings] Update: ${key} = ${value}`);
        settings.update(); // ← Mise à jour instantanée
    }
};
```

#### Avantages
- ✅ Changements **instantanés** (pas de reload nécessaire)
- ✅ Fonctionne sur **même page** (storage event ne suffit pas)
- ✅ Logs de debug pour tracking

### 2. Utilisation dans les Handlers

#### MobsHandler.js

```javascript
NewMobEvent(parameters) {
    // ...
    
    // 🐛 DEBUG: Log raw parameters
    if (this.settings && this.settings.debugEnemies) {
        console.log(`[DEBUG_ENEMY] RAW PARAMS | ID=${id} TypeID=${typeId}`);
    }
    
    // 📊 LOG: Living creatures enhanced
    if (this.settings && this.settings.logLivingCreatures) {
        this.logLivingCreatureEnhanced(id, typeId, health, ...);
    }
}
```

#### HarvestablesHandler.js

```javascript
onHarvestStart(harvestableId) {
    // ...
    
    if (this.settings && this.settings.logLivingResources) {
        console.log(`🌱 [HarvestablesHandler] HarvestStart`, {
            harvestableId,
            timestamp: new Date().toISOString()
        });
    }
}
```

### 3. Format des Logs

#### Living Creatures (Enhanced JSON)

```javascript
[LIVING_JSON] {
    "timestamp": "2025-11-05T18:30:45.123Z",
    "typeId": 12345,
    "entity": {
        "name": "Rabbit",
        "tier": 4,
        "enchant": 1,
        "type": "Hide"
    },
    "state": {
        "health": 850,
        "alive": true,
        "rarity": 112
    },
    "validation": {
        "animal": "Rabbit",
        "expectedHP": 850,
        "match": true
    }
}
```

#### Living Resources (CSV)

```
🌱 [HarvestablesHandler] HarvestStart
{
    harvestableId: 67890,
    timestamp: "2025-11-05T18:30:45.123Z"
}
```

#### Debug Enemies (Verbose)

```
[DEBUG_ENEMY] RAW PARAMS | ID=123 TypeID=456 | params[2]=255 (normalized) params[13]=1500 (maxHP) params[19]=112 (rarity)
```

---

## 👨‍💻 Guide Développeur

### Ajouter un Nouveau Setting de Debug

#### 1. Ajouter la propriété dans Settings.js

```javascript
// Constructor (ligne ~200)
this.myNewDebugSetting = false;

// update() method (ligne ~480)
this.myNewDebugSetting = this.returnLocalBool("settingMyNewDebug");
```

#### 2. Ajouter le checkbox dans settings.ejs

```html
<label class="flex items-center space-x-2">
  <input 
    type="checkbox" 
    id="settingMyNewDebug" 
    class="h-5 w-5 text-indigo-600 border-gray-300 rounded-md"
  >
  <span class="text-gray-600 dark:text-gray-300">🆕 My New Debug Feature</span>
</label>
```

#### 3. Ajouter l'event listener dans settings.ejs

```javascript
const settingMyNewDebugCheckbox = document.getElementById("settingMyNewDebug");

settingMyNewDebugCheckbox.addEventListener("change", function (event) {
  saveToLocalStorage("settingMyNewDebug", event.target.checked);
  if (event.target.checked) {
    console.log("🆕 My New Debug ENABLED");
  } else {
    console.log("🆕 My New Debug DISABLED");
  }
});

// Initialize
settingMyNewDebugCheckbox.checked = getFromLocalStorage("settingMyNewDebug") === "true";
```

#### 4. Utiliser dans un Handler

```javascript
someMethod() {
    if (this.settings && this.settings.myNewDebugSetting) {
        console.log('🆕 [MyHandler] Debug info:', data);
    }
}
```

### Best Practices

#### ✅ DO
- Préfixer toutes les clés localStorage par `setting`
- Vérifier `this.settings &&` avant accès
- Logger avec emojis pour clarté (🐛 📊 🔍 etc.)
- Utiliser des formats structurés (JSON, CSV)
- Inclure timestamp dans les logs

#### ❌ DON'T
- Ne pas accéder directement à localStorage dans les handlers
- Ne pas dupliquer les checkboxes entre pages
- Ne pas oublier d'ajouter dans `update()`
- Ne pas logger sans vérifier le setting
- Ne pas utiliser `console.log()` sans condition

---

## 🔧 Troubleshooting

### Les changements ne prennent pas effet

**Symptôme:** Checkbox changée mais logs n'apparaissent pas

**Solutions:**
1. ✅ Vérifier console (F12) : Le log `🔄 [Settings] Update` apparaît ?
2. ✅ Vérifier localStorage : `localStorage.getItem("settingXXX")` = `"true"` ?
3. ✅ Vérifier Settings.js : La propriété est dans `update()` ?
4. ✅ Vérifier Handler : Condition `if (this.settings.XXX)` présente ?

### Logs n'apparaissent pas dans console

**Symptôme:** Setting activé mais rien dans console

**Solutions:**
1. ✅ Vérifier niveau console : Warnings/Logs pas filtrés ?
2. ✅ Vérifier radar connecté : Handlers pas initialisés avant connexion
3. ✅ Vérifier événement : L'action loguée se produit vraiment ?
4. ✅ Vérifier F12 : Console ouverte et visible ?

### "Cannot read properties of undefined (reading 'logXXX')"

**Symptôme:** Erreur au chargement

**Solutions:**
1. ✅ Ajouter vérification : `this.settings &&` avant accès
2. ✅ Vérifier constructeur : Handler reçoit bien `settings` ?
3. ✅ Vérifier initialisation : Utils.js charge Settings avant handlers ?

### Download Debug Logs ne fonctionne pas

**Symptôme:** Bouton ne répond pas ou erreur

**Solutions:**
1. ✅ Vérifier event listener : `downloadLogsBtn.addEventListener` présent ?
2. ✅ Vérifier fonction : `downloadDebugLogs()` définie ?
3. ✅ Vérifier console : Erreur JavaScript visible ?
4. ✅ Vérifier popup blocker : Navigateur bloque le download ?

---

## 📊 État des Settings

### Settings Implémentés ✅

| Setting | Interface | localStorage | Settings.js | Handlers |
|---------|-----------|--------------|-------------|----------|
| Log Living Creatures | ✅ | ✅ | ✅ | ✅ MobsHandler |
| Log Living Resources | ✅ | ✅ | ✅ | ✅ HarvestablesHandler |
| Debug Enemies | ✅ | ✅ | ✅ | ✅ MobsHandler |
| Enemies Health Bar | ✅ | ✅ | ✅ | ✅ Drawing |
| Enemies ID | ✅ | ✅ | ✅ | ✅ Drawing |
| Living Resources Health Bar | ✅ | ✅ | ✅ | ✅ Drawing |
| Living Resources ID | ✅ | ✅ | ✅ | ✅ Drawing |

### Ancien Système Supprimé ❌

| Composant | État | Date Suppression |
|-----------|------|------------------|
| DebugConfig.js | ❌ Supprimé | 2025-11-05 |
| window.debugLogs | ❌ Supprimé | 2025-11-05 |
| 15 références window.debugLogs | ❌ Migrées | 2025-11-05 |

---

## 🎯 Prochaines Évolutions

### Court Terme
- [ ] Ajouter settings pour autres types d'entités (chests, dungeons)
- [ ] Filtres de log par tier/enchant
- [ ] Export logs vers fichier texte

### Moyen Terme
- [ ] Interface de visualisation des logs dans l'app
- [ ] Statistiques de logging (nombre d'événements par type)
- [ ] Log replay pour debug

### Long Terme
- [ ] Système de profils de logging
- [ ] API pour plugins externes
- [ ] Cloud sync des settings

---

## 📝 Changelog

### v2.0 - 2025-11-05
- ✅ Centralisation complète dans Settings.ejs
- ✅ Mise à jour dynamique sans reload
- ✅ Suppression ancien système window.debugLogs
- ✅ Migration HarvestablesHandler
- ✅ Documentation complète

### v1.0 - 2025-11-04
- Système initial avec checkboxes distribuées
- window.debugLogs pour logs techniques
- Pas de mise à jour dynamique

---

## 📚 Références

- **Code Source:**
  - `views/main/settings.ejs` - Interface utilisateur
  - `scripts/Utils/Settings.js` - État et logique
  - `scripts/Utils/Utils.js` - Initialisation et listeners
  - `scripts/Handlers/MobsHandler.js` - Utilisation logging
  - `scripts/Handlers/HarvestablesHandler.js` - Utilisation logging

- **Documentation:**
  - `work/DEBUG_LOGGING_GUIDE.md` - Ce fichier
  - Memory Serena: `debug-logging-centralization.md`

---

**Maintenu par:** Équipe ZQRadar  
**Dernière mise à jour:** 2025-11-05

