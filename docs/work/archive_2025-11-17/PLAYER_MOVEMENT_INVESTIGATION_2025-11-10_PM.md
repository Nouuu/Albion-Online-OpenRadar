# 🔍 Investigation - Mouvement des Joueurs (2025-11-10 PM)

**Status**: 🔄 **EN COURS D'INVESTIGATION**

**Session**: Après-midi du 2025-11-10

---

## 📊 Contexte

### Symptômes Observés

1. **Joueurs détectés** ✅ mais **ne bougent pas** ❌
2. **Mobs s'affichent et bougent correctement** ✅
3. **Buffer decode retourne valeurs invalides** pour players (ex: `4.18e-37`)
4. **Canvas offset** mentionné mais **NON PERTINENT** (mobs utilisent même `transformPoint()`)
  - Cependant, l'utilisateur observe un decalage d'à peu près la moitié de la taille du canva sur la diagonale

### Observations Critiques

- `transformPoint()` est **PARTAGÉ** par mobs ET players (DrawingUtils.js:88-98)
- Mobs fonctionnent → pas de problème avec `transformPoint()`
- Players ne fonctionnent pas → problème **AVANT** `transformPoint()`

---

## 🔬 Investigation Comparative : Mobs vs Players

### Mobs (✅ Fonctionnent)

**Position Initiale (NewMob Event - EventCode 71):**
```javascript
// MobsHandler.js:500-502
const loc = parameters[7] || [0, 0];  // Array format
const posX = this.normalizeNumber(loc[0], 0);
const posY = this.normalizeNumber(loc[1], 0);
```

**Mise à jour Position (Move Event - EventCode 3):**
```javascript
// Utils.js:552-553
mobsHandler.updateMistPosition(id, posX, posY);
mobsHandler.updateMobPosition(id, posX, posY);

// MobsHandler.js:703-708
updateMobPosition(id, posX, posY) {
    const m = this.mobsList.find(x => x.id === id);
    if (m) {
        m.posX = posX;  // ✅ Mis à jour
        m.posY = posY;
    }
}
```

**Formule Interpolation (MobsDrawing.js:15-16):**
```javascript
const hX = -1 * mobOne.posX + lpX;
const hY = mobOne.posY - lpY;
```

**Résultat** : Mobs se déplacent correctement car :
1. Position initiale valide (param[7]) ✅
2. Buffer décodé correctement aux offsets 9/13 ✅
3. `updateMobPosition()` appelée avec nouvelles coordonnées ✅
4. Interpolation utilise posX/posY à jour ✅

---

### Players (❌ Ne Fonctionnent Pas)

**Position Initiale (NewCharacter Event - EventCode 29):**
```javascript
// PlayersHandler.js:156-164
if (Array.isArray(Parameters[12]) && Parameters[12].length >= 2) {
    initialPosX = Parameters[12][0];  // Array format
    initialPosY = Parameters[12][1];
    positionSource = 'param[12]_array';
}
```

**Mise à jour Position (Move Event - EventCode 3):**
```javascript
// Utils.js:549 - PROBLÈME ICI !
if (!isLikelyPlayer) {  // ❌ Players SKIP cette ligne
    playersHandler.updatePlayerPosition(id, posX, posY, Parameters);
}

// PlayersHandler.js:301-327
updatePlayerPosition(id, posX, posY, parameters) {
    for (const player of this.playersInRange) {
        if (player.id === id) {
            player.posX = posX;  // Ne s'exécute JAMAIS
            player.posY = posY;
            return;
        }
    }
}
```

**Formule Interpolation (PlayersDrawing.js:147-148):**
```javascript
const hX = -1 * playerOne.posX + lpX;
const hY = playerOne.posY - lpY;
```

**Résultat** : Players **NE bougent PAS** car :
1. Position initiale valide (param[12]) ✅
2. Buffer décodé **INVALIDE** aux offsets 9/13 ❌
3. `isValidPosition(posX, posY)` retourne `false` ❌
4. Workaround ligne 549 **SKIP** `updatePlayerPosition()` ❌
5. Interpolation utilise posX/posY **FIGÉES** de NewCharacter ❌

---

## 🎯 Hypothèse Principale : Photon Event Code 2 vs 3

### Référence : AO-Radar (C#)

**PacketHandler.cs ligne 25** :
```csharp
if (code == 2) {  // ← Photon Event Code 2 pour PLAYERS !
    onPlayerMovement(parameters);  // Décode Buffer offsets 9/13
    return;
}
```

**PacketHandler.cs ligne 322-323** :
```csharp
private void onPlayerMovement(Dictionary<byte, object> parameters) {
    int id = int.Parse(parameters[0].ToString());
    Byte[] a = (Byte[])parameters[1];
    Single posX = BitConverter.ToSingle(a, 9);   // Offset 9
    Single posY = BitConverter.ToSingle(a, 13);  // Offset 13
    playerHandler.UpdatePlayerPosition(id, posX, posY);
}
```

### Notre Code

**Protocol16Deserializer.js lignes 191-196** :
```javascript
if(code==3) {  // ❌ Seulement code 3 !
    // 🔍 DEBUG: Don't decode here, let Utils.js handle it
    // Just mark this as a Move event
    parameters[252] = 3;
}
```

** !!! Notre code n'écoute QUE `code == 3`**, donc si les Move events des players utilisent `code == 2`, ils ne sont **PAS marqués** avec `param[252] = 3` !

---

## 🔍 Hypothèse Détaillée

### Si Players utilisent Photon Event Code 2 :

1. **Protocol16Deserializer** reçoit event avec `code = 2`
2. Le `if(code==3)` est **FALSE** → `parameters[252]` n'est PAS mis à 3
3. **Utils.js ligne 355** `case EventCodes.Move:` ne match PAS (car param[252] != 3)
4. Le Buffer n'est **JAMAIS décodé** pour les players
5. `posX/posY` restent à 0 ou invalides
6. `updatePlayerPosition()` n'est jamais appelée
7. Players restent figés

### Si Mobs utilisent Photon Event Code 3 :

1. **Protocol16Deserializer** reçoit event avec `code = 3`
2. Le `if(code==3)` est **TRUE** → `parameters[252] = 3`
3. **Utils.js ligne 355** `case EventCodes.Move:` match !
4. Le Buffer est décodé aux offsets 9/13
5. `posX/posY` sont mis à jour avec valeurs valides
6. `updateMobPosition()` est appelée
7. Mobs bougent

---

## ⚡ DÉCOUVERTE ARCHITECTURALE CRITIQUE (2025-11-16)

### Question de l'Utilisateur

> "Question bete pour moi, qu'est ce qui est coté client et qu'est ce qui est coté serveur ?
> on ne log jamais dans le fichier de log conté serveur, on devrait ?
> est-ce qu'on est sur que le problème vient du coté client ?"

### Architecture Client/Serveur

```
┌─────────────────────────────┐
│   Albion Online (Jeu)       │
└──────────┬──────────────────┘
           │ Paquets Photon bruts (UDP port 5056)
           ▼
┌─────────────────────────────────────────┐
│   SERVEUR Node.js (app.js)              │
│   - Protocol16Deserializer.js           │ ← 🔴 DÉSÉRIALISE LES PAQUETS
│   - Logging: global.loggerServer        │ ← ⚠️ ON NE LOGGAIT JAMAIS ICI !
│   - Fichiers: ./logs/sessions/*.jsonl   │
└──────────┬──────────────────────────────┘
           │ WebSocket (port 5002)
           │ JSON: {code: "event", dictionary: {...}}
           ▼
┌─────────────────────────────────────────┐
│   CLIENT Browser (http://localhost:5001)│
│   - Utils.js                            │ ← Reçoit événements via WebSocket
│   - PlayersHandler.js                   │ ← Traite les joueurs
│   - PlayersDrawing.js                   │ ← Dessine sur canvas
│   - Logging: window.logger              │ ← ✅ TOUS NOS LOGS ÉTAIENT ICI
└─────────────────────────────────────────┘
```

### Problème Identifié

**On n'a JAMAIS loggé côté serveur !**

Si `Protocol16Deserializer.js` ne traite pas correctement les événements Photon Code 2 :
- Le serveur ne marque pas `parameters[252] = 3` pour les joueurs
- Le client ne reçoit JAMAIS les événements de mouvement via WebSocket
- Nos logs côté client ne montrent rien car les événements n'arrivent pas

**Hypothèse révisée** : Le problème pourrait être côté SERVEUR dans la désérialisation, pas côté client !

### Solution Implémentée : Dual-Logging SERVEUR + CLIENT

#### 1. LoggerServer Amélioré

**Fichier** : `server-scripts/LoggerServer.js`

**Ajout des méthodes pratiques** (lignes 89-106) :
```javascript
/**
 * Convenience methods matching LoggerClient API
 */
debug(category, event, data, context = {}) {
    this.log('DEBUG', category, event, data, context);
}

info(category, event, data, context = {}) {
    this.log('INFO', category, event, data, context);
}

warn(category, event, data, context = {}) {
    this.log('WARN', category, event, data, context);
}

critical(category, event, data, context = {}) {
    this.log('CRITICAL', category, event, data, context);
}
```

#### 2. Logger Global Côté Serveur

**Fichier** : `app.js` (ligne 210)

```javascript
// 📊 Initialize Logger Server
const logger = new LoggerServer('./logs');
global.loggerServer = logger; // Make logger globally accessible (like window.logger on client)
console.log('📊 [App] Logger initialized and exposed as global.loggerServer');
```

**Avantage** : `global.loggerServer` disponible partout côté serveur (comme `window.logger` côté client)

#### 3. Logging dans Protocol16Deserializer

**Fichier** : `scripts/classes/Protocol16Deserializer.js` (lignes 1, 191-208)

**Import des constantes** :
```javascript
const { CATEGORIES, EVENTS } = require('../constants/LoggerConstants');
```

**Logging diagnostic** :
```javascript
static deserializeEventData(input) {
    const code = this.deserializeByte(input);
    const parameters = this.deserializeParameterTable(input);

    // 🔍 DEBUG SERVEUR: Log Photon Event Codes 2 and 3 to identify player vs entity moves
    if (code === 2 || code === 3) {
        if (!global.__serverPhotonCount) global.__serverPhotonCount = {2: 0, 3: 0};
        global.__serverPhotonCount[code]++;

        if (global.__serverPhotonCount[code] <= 10) {
            global.loggerServer?.warn(CATEGORIES.PACKET_RAW, `Photon_Event_Code_${code}_SERVER`, {
                count: global.__serverPhotonCount[code],
                photonCode: code,
                id: parameters[0],
                hasBuffer: parameters[1]?.type === 'Buffer',
                bufferLength: parameters[1]?.data?.length,
                param252_before: parameters[252],
                allParamKeys: Object.keys(parameters),
                note: `[SERVER] Photon Event Code ${code} analysis - first 10 occurrences`
            });
        }
    }

    if(code==3) {
        parameters[252] = 3;
    }

    return {code, parameters};
}
```

#### 4. Logging Côté Client (Déjà Implémenté)

**Fichier** : `scripts/Utils/Utils.js` (lignes 237-256)

```javascript
// 🔍 DEBUG: Log Photon Event Codes 2 and 3 to identify player vs entity moves
const photonCode = extractedDictionary["code"];
if (photonCode === 2 || photonCode === 3) {
    if (!window.__photonCodeCount) window.__photonCodeCount = {2: 0, 3: 0};
    window.__photonCodeCount[photonCode]++;

    if (window.__photonCodeCount[photonCode] <= 5) {
        const params = extractedDictionary["parameters"];
        window.logger?.warn(CATEGORIES.PACKET_RAW, `Photon_Event_Code_${photonCode}`, {
            count: window.__photonCodeCount[photonCode],
            photonCode: photonCode,
            id: params[0],
            hasBuffer: params[1]?.type === 'Buffer',
            bufferLength: params[1]?.data?.length,
            param252: params[252],
            allParamKeys: Object.keys(params),
            note: `Photon Event Code ${photonCode} analysis - first 5 occurrences`
        });
    }
}
```

### Plan de Test Révisé

#### Test Dual-Logging

1. **Démarrer le serveur** et observer la console Node.js
2. **Ouvrir le navigateur** et observer la console browser
3. **Lancer Albion Online** et se déplacer
4. **Analyser les logs SERVEUR** : `./logs/sessions/session_*.jsonl`
   - Chercher `Photon_Event_Code_2_SERVER`
   - Chercher `Photon_Event_Code_3_SERVER`
5. **Analyser les logs CLIENT** : Console browser
   - Chercher `Photon_Event_Code_2`
   - Chercher `Photon_Event_Code_3`

#### Scénarios Possibles

**Scénario A : Code 2 arrive au serveur MAIS PAS au client**
- **Logs serveur** : `Photon_Event_Code_2_SERVER` avec IDs de joueurs ✅
- **Logs client** : PAS de `Photon_Event_Code_2` ❌
- **Conclusion** : Le serveur reçoit les événements mais ne les transmet pas car `parameters[252]` n'est pas mis à 3
- **Fix** : `if(code==2 || code==3)` dans Protocol16Deserializer.js

**Scénario B : Code 2 N'arrive PAS au serveur**
- **Logs serveur** : PAS de `Photon_Event_Code_2_SERVER` ❌
- **Logs client** : PAS de `Photon_Event_Code_2` ❌
- **Conclusion** : Le problème est AVANT le serveur (capture réseau, filtrage packets, etc.)
- **Investigation** : Vérifier capture Npcap, filtres UDP

**Scénario C : Code 3 pour players ET mobs**
- **Logs serveur** : `Photon_Event_Code_3_SERVER` avec IDs joueurs ET mobs ✅
- **Conclusion** : L'hypothèse "code 2 pour players" est fausse
- **Investigation** : Autre cause (structure Buffer différente, autres offsets, etc.)

---

## 🧪 Plan de Test

### Test 1 : Confirmer l'Hypothèse

**Ajouter logging dans Protocol16Deserializer.js** pour capturer TOUS les codes 2 et 3.

**Code à ajouter (lignes 185-198)** :
```javascript
static deserializeEventData(input) {
    const code = this.deserializeByte(input);
    const parameters = this.deserializeParameterTable(input);

    // 🔍 DEBUG: Log Photon Event Codes 2 and 3
    if ((code === 2 || code === 3)) {
        if (!window.__photonCodeCount) window.__photonCodeCount = {2: 0, 3: 0};
        window.__photonCodeCount[code]++;

        if (window.__photonCodeCount[code] <= 5) {
            console.log(`[PHOTON_CODE_${code}]`, {
                count: window.__photonCodeCount[code],
                id: parameters[0],
                hasBuffer: parameters[1]?.type === 'Buffer',
                bufferLength: parameters[1]?.data?.length
            });
        }
    }

    if(code==3) {
        parameters[252] = 3;
    }

    return {code, parameters};
}
```

**Chercher dans les logs** :
- `[PHOTON_CODE_2]` avec IDs de players connus (vérifier avec `window.__knownPlayerIds`)
- `[PHOTON_CODE_3]` avec IDs de mobs

**Résultat Attendu** :
- Si players = code 2 → **Hypothèse CONFIRMÉE** ✅
- Si players = code 3 aussi → **Hypothèse INFIRMÉE** ❌

---

## ✅ Fix Attendu (Si Hypothèse Confirmée)

### Modification 1 : Protocol16Deserializer.js ligne 191

```javascript
// AVANT :
if(code==3) {
    parameters[252] = 3;
}

// APRÈS :
if(code==2 || code==3) {  // Gérer BOTH players (2) et entities (3)
    parameters[252] = 3;   // Map both to EventCode.Move
}
```

### Modification 2 : Utils.js ligne 549

```javascript
// AVANT :
if (!isLikelyPlayer) {  // Workaround qui skip players
    playersHandler.updatePlayerPosition(id, posX, posY, Parameters);
}

// APRÈS :
playersHandler.updatePlayerPosition(id, posX, posY, Parameters);
// Supprimer la condition, appeler TOUJOURS
```

---

## 🔄 Prochaines Étapes

### Étape 1 : ✅ Documentation (Ce fichier)
**Status** : ✅ TERMINÉ

### Étape 2 : ✅ Implémenter Logging SERVEUR + CLIENT
**Fichiers modifiés** :
- ✅ `server-scripts/LoggerServer.js` - Ajout méthodes debug/info/warn/critical
- ✅ `app.js` - Exposition de `global.loggerServer`
- ✅ `scripts/classes/Protocol16Deserializer.js` - Logging Photon Event Code 2 et 3 côté serveur
- ✅ `scripts/Utils/Utils.js` - Logging Photon Event Code 2 et 3 côté client (déjà fait)
**Status** : ✅ TERMINÉ (2025-11-16)

### Étape 3 : 🔄 Tester et Analyser Logs (Dual-Logging)
**Action** :
1. Démarrer le serveur et observer la console Node.js
2. Lancer Albion Online et se déplacer
3. Analyser **logs SERVEUR** : `./logs/sessions/session_*.jsonl`
   - Chercher `Photon_Event_Code_2_SERVER`
   - Chercher `Photon_Event_Code_3_SERVER`
4. Analyser **logs CLIENT** : Console browser
   - Chercher `Photon_Event_Code_2`
   - Chercher `Photon_Event_Code_3`
5. Comparer les deux pour identifier où le problème se situe
**Status** : ⏳ EN ATTENTE (Nécessite test du jeu)

### Étape 4 : ⏳ Appliquer Fix (Selon Scénario)
**Scénario A** (Code 2 au serveur, pas au client) :
- Modifier `Protocol16Deserializer.js` ligne 210 : `if(code==2 || code==3)`

**Scénario B** (Code 2 nulle part) :
- Investiguer capture réseau Npcap

**Scénario C** (Code 3 pour players et mobs) :
- Investiguer structure Buffer différente ou autres offsets

**Status** : ⏳ EN ATTENTE (Dépend des résultats tests)

### Étape 5 : ⏳ Documenter Résultats et Conclusion
**Action** : Mettre à jour ce fichier avec résultats tests et solution finale
**Status** : ⏳ EN ATTENTE

---

## 📚 Références

- **Document précédent** : `PLAYER_MOVEMENT_FIX_2025-11-10.md` (Matin)
- **Document status** : `PLAYER_MOVEMENT_CURRENT_STATUS.md` (Obsolète après ce fix)
- **AO-Radar** : `work/data/AO-Radar/AlbionRadaro/PacketHandler.cs` (ligne 25, 322-323)
- **albion-network** : `work/data/albion-network/Albion.Network.Example/MoveEvent.cs` (ligne 13)

---

## 📝 Historique des Mises à Jour

- **2025-11-10 16:15** - Début investigation PM, hypothèse Photon Event Code 2 vs 3
- **2025-11-16** - Découverte architecturale critique, implémentation dual-logging SERVEUR + CLIENT

**Auteur** : Investigation avec Claude Code