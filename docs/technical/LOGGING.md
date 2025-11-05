# 📊 Système de Logging & Debug - ZQRadar

> **Dernière mise à jour:** 2025-11-05  
> **Statut:** ✅ Implémenté et fonctionnel  
> **Mainteneur:** Nospy

---

## 🎯 Vue d'ensemble

Le système de logging et debug de ZQRadar permet de tracer les événements du jeu en temps réel directement dans la console du navigateur. Il est **centralisé**, **dynamique** et **facile à utiliser**.

### Principes Clés

- ✅ **Centralisation** : Tous les contrôles dans Settings.ejs
- ✅ **Mise à jour dynamique** : Changements instantanés sans reload
- ✅ **Persistance** : Settings sauvegardés dans localStorage
- ✅ **Pas de duplication** : Un seul endroit pour chaque setting

---

## 📋 Architecture Actuelle

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

```
views/main/settings.ejs         # Interface utilisateur centralisée
    ↓
localStorage                     # Stockage persistant
    ↓
scripts/Utils/Utils.js          # Override setItem + listener
    ↓
scripts/Utils/Settings.js       # État global + update()
    ↓
scripts/Handlers/               # MobsHandler, HarvestablesHandler
    │
    ├── Vérifient this.settings.logXXX
    └── Loggent dans console (F12)
```

---

## 🎛️ Settings Disponibles

### Settings Globaux (Settings.ejs)

| Setting | localStorage Key | Propriété Settings | Usage |
|---------|------------------|-------------------|-------|
| 📊 Living Creatures | `settingLogLivingCreatures` | `logLivingCreatures` | Log JSON enhanced des mobs vivants |
| 🔍 Living Resources | `settingLogLivingResources` | `logLivingResources` | Log CSV des ressources récoltées |
| 🐛 Debug Enemies | `settingDebugEnemies` | `debugEnemies` | Debug verbose des ennemis |

### Settings Visuels (Pages spécialisées)

| Page | Setting | localStorage Key | Propriété |
|------|---------|------------------|-----------|
| Enemies | Health Bar | `settingEnemiesHealthBar` | `enemiesHealthBar` |
| Enemies | Show ID | `settingEnemiesID` | `enemiesID` |
| Resources | Health Bar | `settingLivingResourcesHealthBar` | `livingResourcesHealthBar` |
| Resources | Show ID | `settingLivingResourcesID` | `livingResourcesID` |

---

## 🔧 Format des Logs

### Living Creatures (Enhanced JSON)

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

### Living Resources (CSV)

```javascript
🌱 [HarvestablesHandler] HarvestStart {
    harvestableId: 67890,
    timestamp: "2025-11-05T18:30:45.123Z"
}

🆕 [ItemId Discovery] 12345 = Fiber T5.2
```

### Debug Enemies (Verbose)

```javascript
[DEBUG_ENEMY] RAW PARAMS | ID=123 TypeID=456 | 
    params[2]=255 (health normalized) 
    params[13]=1500 (maxHP) 
    params[19]=112 (rarity)
```

---

## 💻 Utilisation

### Pour l'Utilisateur

1. **Ouvrir Settings** → Cliquer sur l'onglet Settings
2. **Section "🐛 Debug & Logging"** → Descendre jusqu'à la section
3. **Cocher les options** → Activer les logs souhaités
4. **Changements instantanés** → Pas besoin de reload
5. **Ouvrir console** → F12 pour voir les logs
6. **Export** → Bouton "Download Debug Logs" pour JSON complet

### Pour le Développeur

#### Ajouter un nouveau setting de debug

**1. Settings.js (constructor + update)**
```javascript
// Constructor (~ligne 200)
this.myNewDebugSetting = false;

// update() method (~ligne 480)
this.myNewDebugSetting = this.returnLocalBool("settingMyNewDebug");
```

**2. settings.ejs (checkbox + listener)**
```html
<!-- Checkbox -->
<label class="flex items-center space-x-2">
  <input type="checkbox" id="settingMyNewDebug" class="h-5 w-5">
  <span>🆕 My New Debug</span>
</label>

<!-- Event listener -->
<script>
const checkbox = document.getElementById("settingMyNewDebug");
checkbox.addEventListener("change", (e) => {
  saveToLocalStorage("settingMyNewDebug", e.target.checked);
});
checkbox.checked = getFromLocalStorage("settingMyNewDebug") === "true";
</script>
```

**3. Handler (utilisation)**
```javascript
someMethod() {
    if (this.settings && this.settings.myNewDebugSetting) {
        console.log('🆕 [MyHandler] Debug info:', data);
    }
}
```

---

## 🚀 Mise à Jour Dynamique

### Mécanisme (scripts/Utils/Utils.js)

```javascript
// Override localStorage.setItem pour détecter changements
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    
    if (key.startsWith('setting')) {
        console.log(`🔄 [Settings] Update: ${key} = ${value}`);
        settings.update(); // ← Mise à jour instantanée !
    }
};
```

### Avantages

- ✅ Changements **instantanés** (pas de reload nécessaire)
- ✅ Fonctionne sur **même page** (storage event ne suffit pas)
- ✅ Logs de tracking dans console
- ✅ Cohérence garantie entre interface et handlers

---

## 📚 Documentation Complète

Pour plus de détails, consulter :

- **[DEBUG_LOGGING_GUIDE.md](../../work/DEBUG_LOGGING_GUIDE.md)** - Guide complet avec exemples
- **[SETTINGS.md](./SETTINGS.md)** - Configuration globale
- Memory Serena: `debug-logging-final-state.md`

### Fichiers Concernés

- `views/main/settings.ejs` - Interface centralisée
- `scripts/Utils/Settings.js` - État et logique
- `scripts/Utils/Utils.js` - Initialisation et listeners
- `scripts/Handlers/MobsHandler.js` - Utilisation logging mobs
- `scripts/Handlers/HarvestablesHandler.js` - Utilisation logging resources

---

## 🔧 Troubleshooting

### Les changements ne prennent pas effet

**Solutions:**
1. Vérifier console (F12) : Le log `🔄 [Settings] Update` apparaît ?
2. Vérifier localStorage : `localStorage.getItem("settingXXX")` = `"true"` ?
3. Vérifier que le radar est connecté au jeu

### Logs n'apparaissent pas

**Solutions:**
1. Vérifier niveau console : Warnings/Logs pas filtrés ?
2. Vérifier que l'événement se produit réellement dans le jeu
3. Vérifier que le setting est bien activé (checkbox cochée)

---

## ✅ Best Practices

### ✅ DO
- Préfixer clés localStorage par `setting`
- Vérifier `this.settings &&` avant accès
- Logger avec emojis pour clarté
- Inclure timestamp dans logs
- Utiliser formats structurés (JSON, CSV)

### ❌ DON'T
- Accéder directement à localStorage dans handlers
- Dupliquer checkboxes entre pages
- Oublier d'ajouter dans `update()`
- Logger sans vérifier le setting

---

## 🚀 Prochaines Étapes (Phase 2)

### 1. Créer le Logger Client
- [ ] Créer `scripts/Utils/Logger.js`
- [ ] Buffer des logs avant envoi
- [ ] Connexion WebSocket au serveur de logs

### 2. Créer le Logger Serveur
- [ ] Créer `server-scripts/LoggerServer.js`
- [ ] Écriture JSONL sur disque
- [ ] Rotation des fichiers de logs

### 3. Intégration
- [ ] Modifier handlers pour utiliser logger.log() au lieu de console.log()
- [ ] Créer dossier `logs/` avec sous-dossiers
- [ ] Tests de bout en bout

### 4. Outils d'Analyse
- [ ] Script Python pour parser JSONL
- [ ] Dashboard de visualisation
- [ ] Détection automatique d'anomalies

---

## 📚 Documentation Complète

### Phase 1 (Actuelle)
- **[DEBUG_LOGGING_GUIDE.md](../../work/DEBUG_LOGGING_GUIDE.md)** - Guide complet du système debug centralisé
- **[SETTINGS.md](./SETTINGS.md)** - Configuration globale
- Memory Serena: `debug-logging-final-state.md`

### Fichiers Concernés (Phase 1)
- `views/main/settings.ejs` - Interface centralisée
- `scripts/Utils/Settings.js` - État et update()
- `scripts/Utils/Utils.js` - Override localStorage
- `scripts/Handlers/MobsHandler.js` - Logs mobs
- `scripts/Handlers/HarvestablesHandler.js` - Logs resources

### À Créer (Phase 2)
- `scripts/Utils/Logger.js` - Logger client
- `server-scripts/LoggerServer.js` - Logger serveur
- `logs/` - Dossier de logs persistés

---

**Maintenu par:** Nospy  
**Dernière mise à jour:** 2025-11-05

- `HARVESTABLE` - Ressources récoltables
- `MOB` - Créatures/ennemis
- `PLAYER` - Joueurs
- `INVENTORY` - Inventaire
- `NETWORK` - Événements réseau
- `SYSTEM` - Système général

---

## 🔧 Plan d'Implémentation (3 Étapes)

### Étape 1 : Server-side Logger (20 min)

**Créer `server-scripts/LoggerServer.js` :**

```javascript
const fs = require('fs');
const path = require('path');

class LoggerServer {
    constructor(logsDir = './logs') {
        this.logsDir = logsDir;
        const sessionsDir = path.join(logsDir, 'sessions');
        if (!fs.existsSync(sessionsDir)) {
            fs.mkdirSync(sessionsDir, {recursive: true});
        }
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        this.currentSessionFile = path.join(sessionsDir, `session_${timestamp}.jsonl`);
    }

    writeLogs(logsArray) {
        if (!Array.isArray(logsArray) || logsArray.length === 0) return;
        const lines = logsArray.map(log => JSON.stringify(log)).join('\n') + '\n';
        fs.appendFileSync(this.currentSessionFile, lines, 'utf8');
    }

    log(level, category, event, data, context = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            event,
            data,
            context
        };
        this.writeLogs([logEntry]);
    }
}

module.exports = LoggerServer;
```

**Modifier `app.js` (ajouter 3 lignes) :**

```javascript
// En haut du fichier
const LoggerServer = require('./server-scripts/LoggerServer');
const logger = new LoggerServer('./logs');

// Dans la gestion WebSocket (rechercher "wss.on('connection')")
ws.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.type === 'logs') {
        logger.writeLogs(data.logs);
    }
});
```

---

### Étape 2 : Client-side Logger (30 min)

**Créer `scripts/Utils/Logger.js` :**

```javascript
class Logger {
    constructor(wsClient) {
        this.wsClient = wsClient;
        this.buffer = [];
        this.sessionId = this.generateSessionId();
        this.flushInterval = setInterval(() => this.flush(), 5000); // Flush toutes les 5s
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    log(level, category, event, data, context = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            event,
            data,
            context: {...context, sessionId: this.sessionId}
        };
        this.buffer.push(logEntry);

        if (this.buffer.length >= 50) {
            this.flush();
        }
    }

    debug(category, event, data, context) {
        this.log('DEBUG', category, event, data, context);
    }

    info(category, event, data, context) {
        this.log('INFO', category, event, data, context);
    }

    warn(category, event, data, context) {
        this.log('WARN', category, event, data, context);
    }

    error(category, event, data, context) {
        this.log('ERROR', category, event, data, context);
    }

    flush() {
        if (this.buffer.length === 0) return;
        if (this.wsClient && this.wsClient.readyState === WebSocket.OPEN) {
            this.wsClient.send(JSON.stringify({
                type: 'logs',
                logs: this.buffer
            }));
            this.buffer = [];
        }
    }

    destroy() {
        clearInterval(this.flushInterval);
        this.flush();
    }
}
```

**Modifier `scripts/Utils/Utils.js` :**

```javascript
// Import en haut
import Logger from './Logger.js';

// Dans initWebSocket() ou au début
let logger = null;

function initWebSocket() {
    // ...code existant...
    logger = new Logger(ws);
}

// Dans onEvent(), ajouter des logs pour les événements clés
function onEvent(parameters, event) {
    switch (event) {
        case photonEventIds.NewHarvestableObject:
            logger?.debug('HARVESTABLE', 'NewHarvestableObject', {
                id: /* extrait du paquet */,
                typeId: /* ... */,
                tier: /* ... */,
                enchant: /* ... */
            });
            break;

        case photonEventIds.HarvestStart:
            logger?.debug('HARVESTABLE', 'HarvestStart', { /* ... */});
            break;

        // ...autres événements...
    }
}
```

---

### Étape 3 : Script d'Analyse Python (10 min)

**Créer `tools/analyze-logs.py` :**

```python
#!/usr/bin/env python3
import json
import sys
from collections import defaultdict


def analyze_logs(filepath):
    stats = {
        'harvestables_by_tier': defaultdict(int),
        'unresolved_typeids': set(),
        'harvest_cycles': []
    }

    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            log = json.loads(line)

            if log['category'] == 'HARVESTABLE':
                if log['event'] == 'NewHarvestableObject':
                    tier = log['data'].get('tier', 0)
                    stats['harvestables_by_tier'][tier] += 1

                    if tier == 0:
                        stats['unresolved_typeids'].add(log['data']['typeId'])

    print(f"\n📊 Analyse de {filepath}\n")
    print("Détections par tier:")
    for tier in sorted(stats['harvestables_by_tier'].keys()):
        count = stats['harvestables_by_tier'][tier]
        print(f"  T{tier}: {count} détections")

    if stats['unresolved_typeids']:
        print(f"\n⚠️ TypeIDs non résolus ({len(stats['unresolved_typeids'])}):")
        for tid in sorted(stats['unresolved_typeids']):
            print(f"  - {tid}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python analyze-logs.py <session_file.jsonl>")
        sys.exit(1)

    analyze_logs(sys.argv[1])
```

---

## ✅ Checklist d'Implémentation

### Phase 1 - Infrastructure (30 min)

- [ ] Créer `server-scripts/LoggerServer.js`
- [ ] Modifier `app.js` (3 lignes)
- [ ] Créer `scripts/Utils/Logger.js`
- [ ] Tester la connexion serveur ↔ client

### Phase 2 - Intégration (30 min)

- [ ] Modifier `scripts/Utils/Utils.js` (init logger)
- [ ] Logger les 4 événements clés dans `onEvent()`:
    - `NewHarvestableObject`
    - `HarvestStart`
    - `NewSimpleItem`
    - `HarvestFinished`
- [ ] Logger dans `MobsHandler.js` (`getTypeIdInfo()`)

### Phase 3 - Analyse (20 min)

- [ ] Créer `tools/analyze-logs.py`
- [ ] Tester avec session réelle
- [ ] Identifier les TypeIDs manquants

### Phase 4 - Interface Admin (optionnel)

- [ ] Créer page de visualisation des logs
- [ ] Intégrer dans les settings
- [ ] Dashboard de monitoring

---

## 🎯 Points Critiques à Logger

### Living Resources (PRIORITÉ 1)

```javascript
logger.debug('HARVESTABLE', 'NewHarvestableObject', {
    id: obj.id,
    typeId: obj.typeId,
    tier: getTier(obj.typeId),
    enchant: getEnchantment(obj.typeId),
    posX: obj.posX,
    posY: obj.posY,
    charges: obj.charges,
    size: obj.size
});
```

### Détection de Mobs

```javascript
logger.debug('MOB', 'MobDetected', {
    typeId: mob.typeId,
    enchant: mob.enchant,
    name: mob.name || 'UNKNOWN',
    tier: mob.tier,
    health: mob.health
});
```

### Erreurs de Parsing

```javascript
logger.error('NETWORK', 'ParsingError', {
    event: eventName,
    rawData: parameters,
    error: errorMessage
});
```

---

## 📊 Utilisation

### Lancer l'Application

```bash
_RUN.bat
```

### Farmer des Ressources

- Récolter des ressources T4, T5, T6, T7, T8
- Les logs s'écrivent automatiquement

### Analyser les Logs

```bash
python tools/analyze-logs.py logs/sessions/session_2025-11-05_14-30-00.jsonl
```

**Résultat attendu :**

```
📊 Analyse de session_2025-11-05_14-30-00.jsonl

Détections par tier:
  T0: 42 détections  ⚠️ TypeIDs non résolus !
  T4: 156 détections
  T5: 89 détections
  T6: 3 détections   ⚠️ Très peu !
  T7: 0 détections   ❌ Aucune !
  T8: 0 détections   ❌ Aucune !

⚠️ TypeIDs non résolus (12):
  - 167890
  - 167891
  - 167892
  ...
```

---

## 🔍 Debug des Living Resources T6-T8

### Hypothèses à Vérifier

1. **TypeID non reconnu ?**
    - Vérifier si les TypeIDs T6-T8 sont dans la base
    - Comparer avec les logs de détection

2. **Enchantement ignoré ?**
    - Les living resources T6+ ont toujours un enchantment
    - Vérifier si le code gère correctement

3. **Filtrage trop restrictif ?**
    - Vérifier les filtres de tier dans `HarvestablesHandler.js`
    - Vérifier les settings utilisateur

4. **Événement manquant ?**
    - Comparer avec les logs T4-T5 qui fonctionnent
    - Chercher des différences dans le format des paquets

### Workflow de Debug

```
1. Activer le logging (voir ci-dessus)
2. Farmer des living T6-T8 en jeu
3. Analyser les logs avec analyze-logs.py
4. Identifier les TypeIDs T0 (non résolus)
5. Chercher ces TypeIDs dans la base officielle
6. Ajouter les mappings manquants
7. Retester
```

---

## 📁 Fichiers Concernés

| Fichier                                   | Rôle                | Modification       |
|-------------------------------------------|---------------------|--------------------|
| `server-scripts/LoggerServer.js`          | 🆕 Serveur de logs  | Créer              |
| `scripts/Utils/Logger.js`                 | 🆕 Client logger    | Créer              |
| `scripts/Utils/LoggerConfig.js`           | 🆕 Configuration    | Créer (optionnel)  |
| `app.js`                                  | Serveur principal   | +3 lignes          |
| `scripts/Utils/Utils.js`                  | Dispatch événements | Init logger + logs |
| `scripts/handlers/HarvestablesHandler.js` | Gestion ressources  | Logs debug         |
| `scripts/handlers/MobsHandler.js`         | Gestion mobs        | Logs debug         |
| `tools/analyze-logs.py`                   | 🆕 Analyse logs     | Créer              |

---

## 🎓 Best Practices

### Performance

- ✅ Buffer les logs côté client (flush toutes les 5s ou à 50 logs)
- ✅ Format JSONL (1 log par ligne, facile à parser)
- ✅ Fichiers séparés par session
- ❌ Éviter de logger dans les boucles intensives

### Structure

- ✅ Toujours inclure `timestamp`, `level`, `category`, `event`
- ✅ Données structurées dans `data`
- ✅ Contexte optionnel dans `context`
- ✅ Session ID pour tracer un cycle complet

### Debug

- ✅ Niveau `DEBUG` pour les détails
- ✅ Niveau `ERROR` pour les problèmes
- ✅ Catégories claires (`HARVESTABLE`, `MOB`, etc.)
- ✅ Données complètes pour analyse

---

## 🔗 Références

- **Documentation officielle Albion:** Structure des paquets réseau
- **Photon Protocol:** Format des événements
- **TypeIDs Database:** Mapping TypeID → Item/Resource

---

**État:** Documentation consolidée à partir de :

- `LOGGING_GUIDE.md`
- `LOGGING_REFACTORING_PLAN.md`
- `LOGGING_ACTION_PLAN.md`
- `LOGGING_ANALYSIS.md`
- `TODO_LOGGING.md`
