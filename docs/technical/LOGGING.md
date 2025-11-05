# 📊 Système de Logging - ZQRadar

> **Dernière mise à jour:** 2025-11-05  
> **Statut:** Plan de refactorisation documenté

---

## 🎯 Objectif

Créer un système de logging unifié pour débugger les problèmes de détection, notamment les **living resources T6-T8** qui ne sont plus détectées correctement.

---

## 📋 Architecture Actuelle

```
Albion Online (UDP 5056)
    ↓
app.js (capture paquets Photon)
    ↓ WebSocket (port 5002)
scripts/Utils/Utils.js (dispatch événements)
    ↓
scripts/handlers/*.js (gestion événements)
```

**Problèmes actuels :**
- ❌ Logs éparpillés avec `console.log`
- ❌ Logs perdus au refresh du navigateur
- ❌ Impossible de tracer un cycle complet de récolte
- ❌ Pas de format structuré pour analyse

---

## 🏗️ Architecture Proposée

### Structure des Dossiers

```
C:\Projets\Albion-Online-ZQRadar\
├── logs/                           # 🆕 Logs persistés
│   ├── sessions/                   # Logs par session
│   │   ├── session_2025-11-05_14-30-00.jsonl
│   │   └── session_2025-11-05_15-45-00.jsonl
│   ├── errors/                     # Erreurs critiques
│   │   └── errors_2025-11-05.log
│   └── debug/                      # Logs de debug détaillés
│       └── harvestables_2025-11-05.jsonl
│
├── scripts/Utils/
│   ├── Logger.js                   # 🆕 Client-side logger
│   └── LoggerConfig.js             # 🆕 Configuration
│
├── server-scripts/
│   └── LoggerServer.js             # 🆕 Server-side logger
│
└── app.js                          # Intégration du logger serveur
```

### Format de Log Unifié

**Format JSON par ligne (JSONL) :**

```json
{
  "timestamp": "2025-11-05T14:30:45.123Z",
  "level": "DEBUG",
  "category": "HARVESTABLE",
  "event": "NewHarvestableObject",
  "data": {
    "id": 12345,
    "typeId": 167890,
    "tier": 7,
    "enchant": 2,
    "posX": 1234.56,
    "posY": 7890.12,
    "charges": 12,
    "size": 3
  },
  "context": {
    "sessionId": "uuid-here",
    "mapName": "RandomDungeon001",
    "playerPos": { "x": 1200, "y": 7800 }
  }
}
```

**Niveaux de log :**
- `DEBUG` - Détails de debug
- `INFO` - Informations générales
- `WARN` - Avertissements
- `ERROR` - Erreurs
- `CRITICAL` - Erreurs critiques

**Catégories :**
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
            fs.mkdirSync(sessionsDir, { recursive: true });
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
            context: { ...context, sessionId: this.sessionId }
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
            logger?.debug('HARVESTABLE', 'HarvestStart', { /* ... */ });
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

| Fichier | Rôle | Modification |
|---------|------|-------------|
| `server-scripts/LoggerServer.js` | 🆕 Serveur de logs | Créer |
| `scripts/Utils/Logger.js` | 🆕 Client logger | Créer |
| `scripts/Utils/LoggerConfig.js` | 🆕 Configuration | Créer (optionnel) |
| `app.js` | Serveur principal | +3 lignes |
| `scripts/Utils/Utils.js` | Dispatch événements | Init logger + logs |
| `scripts/handlers/HarvestablesHandler.js` | Gestion ressources | Logs debug |
| `scripts/handlers/MobsHandler.js` | Gestion mobs | Logs debug |
| `tools/analyze-logs.py` | 🆕 Analyse logs | Créer |

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

