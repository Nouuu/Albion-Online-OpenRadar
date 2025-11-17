# 🎯 Player Detection & Movement - Status Investigation

**Dernière mise à jour**: 2025-11-17 18:00
**Statut**: Mobs/Resources OK - Investigation mouvement joueurs en cours

---

## 📊 Executive Summary

### ✅ Ce qui fonctionne (Confirmé 2025-11-17 18:00)
- ✅ **Mobs** : Apparaissent ET bougent correctement (100% fonctionnel)
- ✅ **Resources** : Apparaissent correctement (static par nature)
- ✅ **Chests, dungeons, fish** : Détectés correctement
- ✅ **Event Code 3 (Move)** : Désérialisation serveur fonctionne (param[4]/[5])
- ✅ **Architecture client/serveur** : Clarifiée et validée

### ❌ Ce qui NE fonctionne PAS
- ❌ **Players (Position initiale)** : Event 29 param[7] Buffer PAS désérialisé côté serveur
- ❌ **Players (Mouvement)** : Event 3 (Move) pour joueurs problématique
  - Hypothèse: Race condition ou format Buffer différent pour joueurs
  - À investiguer: param[1] Buffer joueurs vs mobs

### 🎯 Investigation en Cours
**Comprendre pourquoi Event 3 fonctionne pour mobs mais pas pour joueurs**
- Event 3 désérialisé identiquement (param[4]/[5]) pour tous
- Mobs bougent → handlers OK
- Joueurs ne bougent pas → handlers KO ou Move events pas reçus?

---

## 📅 Timeline Chronologique

### 2025-11-09 : Détection initiale
- Mobs et resources détectés et affichés
- Mouvement fonctionnel

### 2025-11-10 : Investigation mouvement players
- Players détectés mais immobiles
- Hypothèse Event Code 2 vs 3 (infirmée)
- Dual-logging implémenté (server + client)

### 2025-11-16 : Analyse approfondie buffers
- Analyse byte-par-byte des Buffers Move
- Offsets "variables" observés (6 à 22 bytes)
- Hypothèses sur byte 9, header, etc.

### 2025-11-17 : 🚨 RÉGRESSION CATASTROPHIQUE
**Ce qui s'est passé** :
1. Modifications de `deserializeByteArray()` et `deserializeParameterTable()` pour "corriger" des bugs
2. **RÉSULTAT** : TOUT a cessé de fonctionner (mobs, resources, chests, dungeons, fish)
3. 70% du crédit utilisé à réparer au lieu d'avancer

**Le revert** :
1. Restauration complète de Protocol16Deserializer.js à l'état "bugué mais fonctionnel"
2. Fix Utils.js : `Parameters[253]/[254]` → `Parameters[4]/[5]`
3. **RÉSULTAT** : Mobs/resources réapparaissent et **bougent correctement** ✅

### 2025-11-17 18:00 : État Validé
- ✅ Mobs fonctionnent à 100% (apparition + mouvement)
- ✅ Resources fonctionnent à 100%
- ❌ Joueurs : Problème sur Event 29 (param[7]) ET Event 3 (mouvement)

---

## 🏗️ Architecture

### Flux de Données
```
SERVEUR (Node.js)
├─ Reçoit packets UDP Photon
├─ Protocol16Deserializer.js désérialise
├─ Envoie JSON via WebSocket
└─ Logger: global.loggerServer (logs/sessions/*.jsonl)
    ↓
CLIENT (Browser)
├─ Reçoit JSON via WebSocket
├─ Utils.js traite events (onEvent)
├─ Handlers mettent à jour entités
└─ Logger: window.logger (envoyé au serveur)
```

### Fichiers Clés
| Fichier | Rôle | Côté |
|---------|------|------|
| `scripts/classes/Protocol16Deserializer.js` | Désérialisation Photon | Serveur |
| `scripts/Utils/Utils.js` | Traitement events | Client |
| `scripts/Handlers/MobsHandler.js` | Gestion mobs | Client |
| `scripts/Handlers/PlayersHandler.js` | Gestion players | Client |
| `scripts/Handlers/HarvestablesHandler.js` | Gestion resources | Client |
| `app.js` | WebSocket bridge | Serveur |

---

## 🐛 Bugs Critiques Identifiés

### Bug #4 : Event Code manquant dans param[252] (2025-11-17 00h00-00h10)

**Découverte** :
```javascript
// deserializeEventData() retourne {code: X, parameters: {...}}
// MAIS app.js lit parameters[252] pour identifier l'event
// param[252] n'était set QUE pour Event Code 3 (Move)!
```

**Problème** :
- Event Code 3 (Move) : `param[252] = 3` ✅
- Event Code 29 (NewCharacter) : `param[252] = undefined` ❌
- Résultat : Le bloc `if(code === 29)` ne s'exécutait JAMAIS

**Solution appliquée** (ligne 198) :
```javascript
parameters[252] = code;  // Pour TOUS les events
```

**Impact** :
- Tous les events ont leur code dans param[252]
- Base pour désérialiser param[7] de NewCharacter
- MAIS : Players toujours pas visibles (Event 29 rare ou absent?)

---

## 🚨 RÉGRESSION 2025-11-17 : L'Erreur à NE PAS Répéter

### Ce qui a été modifié (et qui a tout cassé)

**1. deserializeByteArray() "corrigé"** :
```javascript
// ❌ Version "correcte" qui a TOUT cassé
static deserializeByteArray(input) {
    const arraySize = input.readUInt32BE();
    const startPos = input.tell();
    const buffer = input.buffer.slice(startPos, startPos + arraySize);
    input.seek(startPos + arraySize);
    return buffer;
}
```

**2. deserializeParameterTable() "corrigé"** :
```javascript
// ❌ Version "correcte" qui a TOUT cassé
static deserializeParameterTable(input) {
    const tableSize = this.deserializeShort(input);  // SmartBuffer
    let table = {};
    for (let i = 0; i < tableSize; i++) {
        const key = this.deserializeByte(input);
        const valueTypeCode = this.deserializeByte(input);
        const value = this.deserialize(input, valueTypeCode);
        table[key] = value;
    }
    return table;
}
```

### Pourquoi ça a cassé

**Le code "bugué" fonctionnait PAR ACCIDENT** :
- `input.slice(arraySize).buffer` - techniquement incorrect MAIS marchait
- Offsets fixes dans deserializeParameterTable - bizarre MAIS marchait
- Le système ENTIER construit autour de ces "bugs" depuis 2 ans

**Le code "correct" a tout cassé** :
- Reste du système (handlers, Utils.js) attendait le format "bugué"
- Impossible de "corriger" juste une partie sans adapter TOUT le reste
- Architecture en place = ne pas toucher ce qui fonctionne

### Le Revert (Solution)

**Code RESTAURÉ** (version "buguée mais fonctionnelle) :
```javascript
// ✅ Version restaurée qui FONCTIONNE
static deserializeByteArray(input) {
    const arraySize = input.readUInt32BE();
    return input.slice(arraySize).buffer;
}

// ✅ Version restaurée qui FONCTIONNE
static deserializeParameterTable(input) {
    const tableSize = input.readUInt16BE(1);  // Offset fixe
    let table = {};
    let offset = 3;
    for (let i = 0; i < tableSize; i++) {
        const key = input.readUInt8(offset);
        const valueTypeCode = input.readUInt8(offset + 1);
        const value = this.deserialize(input, valueTypeCode);
        table[key] = value;
    }
    return table;
}

// ✅ Version restaurée - Event Code 3 uniquement
static deserializeEventData(input) {
    const code = this.deserializeByte(input);
    const parameters = this.deserializeParameterTable(input);

    if(code==3) {
        var bytes = new Uint8Array(parameters[1]);
        var position0 = new DataView(bytes.buffer, 9, 4).getFloat32(0, true);
        var position1 = new DataView(bytes.buffer, 13, 4).getFloat32(0, true);
        parameters[4] = position0;
        parameters[5] = position1;
        parameters[252] = 3;
    }

    return {code, parameters};
}
```

---

## 💡 LEÇONS APPRISES (CRITIQUES - À NE PAS OUBLIER)

### ❌ Ce qu'il NE FAUT PAS faire

1. **Ne JAMAIS "corriger" du code qui fonctionne** sans comprendre TOUT le système
   - Même si ça semble "incorrect" techniquement
   - Même si la doc dit que c'est "cassé"
   - Si ça fonctionne en prod = NE PAS TOUCHER

2. **Ne JAMAIS faire confiance à une documentation** qui dit "cassé" si ça marche
   - La doc peut être obsolète ou incomplète
   - Le code en production est la source de vérité

3. **Ne JAMAIS ajouter du code au lieu de comprendre**
   - Rajouter des couches (debug, workarounds) cache le vrai problème
   - Mieux vaut prendre le temps de COMPRENDRE

4. **Ne JAMAIS toucher plusieurs fichiers critiques en même temps**
   - Créer des régressions sur TOUTES les features
   - Impossible de savoir quel changement a cassé quoi

### ✅ Ce qu'il FAUT faire

1. **TOUJOURS tester chaque changement** avant d'en faire un autre
   - Test en jeu après CHAQUE modification
   - Valider que rien n'est cassé avant de continuer

2. **Si ça marche, ne pas y toucher**
   - Principe de précaution
   - "Working code" > "Clean code"

3. **Créer une branche séparée** pour expérimentations
   - Possibilité de revenir en arrière facilement
   - Ne pas polluer main/feat avec des tentatives

4. **Documenter les erreurs** immédiatement
   - Éviter de répéter les mêmes erreurs
   - Économiser temps et crédit

---

## 📍 État Actuel du Code (Post-Revert 2025-11-17)

### Protocol16Deserializer.js

**Désérialisation Move events (Event Code 3)** :
```javascript
if(code==3) {
    var bytes = new Uint8Array(parameters[1]);
    var position0 = new DataView(bytes.buffer, 9, 4).getFloat32(0, true);  // Offset 9
    var position1 = new DataView(bytes.buffer, 13, 4).getFloat32(0, true); // Offset 13
    parameters[4] = position0;  // ✅ posX
    parameters[5] = position1;  // ✅ posY
    parameters[252] = 3;
}
```

**Status** :
- ✅ Désérialise correctement les positions de Move events
- ✅ Stocke dans `param[4]` et `param[5]`
- ✅ Event code dans `param[252]`

### Utils.js (Client)

**Lecture Move events** :
```javascript
case EventCodes.Move:
    if (Parameters[4] !== undefined && Parameters[5] !== undefined) {
        const posX = Parameters[4];  // ✅ Lit param[4]
        const posY = Parameters[5];  // ✅ Lit param[5]

        if (isValidPosition(posX, posY)) {
            mobsHandler.updateMobPosition(id, posX, posY);  // Appelle handler
        }
    }
```

**Status** :
- ✅ Lit les bons paramètres (`[4]` et `[5]`)
- ✅ Valide les positions
- ✅ Appelle `updateMobPosition()` et `updatePlayerPosition()`
- ✅ **Mobs bougent correctement** (validé 2025-11-17 18:00)

### Problème Restant: Joueurs

**Event 29 (NewCharacter) - Position initiale** :
- param[7] Buffer PAS désérialisé côté serveur
- Client reçoit `{type: "Buffer", data: [...]}` au lieu de Array [posX, posY]
- `Buffer.isBuffer()` retourne false côté navigateur
- Fallback sur param[19]/[20] (world coords incorrects)

**Event 3 (Move) - Mouvement joueurs** :
- Désérialisation Event 3 identique pour mobs ET joueurs (param[4]/[5])
- Mobs bougent ✅ → Event 3 fonctionne
- Joueurs ne bougent pas ❌ → Pourquoi?
  - Hypothèse 1: Race condition (Move avant NewCharacter)
  - Hypothèse 2: PlayersHandler rejette silencieusement (player pas dans playersInRange)
  - Hypothèse 3: Event 3 pas reçu pour joueurs (à vérifier logs)

---

## 🎯 Prochaines Étapes (Checklist)

### Priorité 1 : Fix Event 29 param[7] deserialization (Server-side)

- [ ] Ajouter bloc Event 29 dans `Protocol16Deserializer.js deserializeEventData()`
- [ ] Désérialiser param[7] Buffer → Array [posX, posY]
- [ ] Identifier offsets corrects (probablement 0 et 4, pas 9 et 13 comme Event 3)
- [ ] Tester: Joueur apparaît à position correcte quand entre dans vue

### Priorité 2 : Investigation Event 3 (Move) pour joueurs

- [ ] Vérifier si Event 3 reçu pour joueurs (logs côté serveur)
- [ ] Vérifier `PlayersHandler.updatePlayerPosition()` ligne 263
  - Player existe dans playersInRange?
  - Update silencieusement rejeté?
- [ ] Comparer avec `MobsHandler.updateMobPosition()` (qui fonctionne)
- [ ] Hypothèse race condition: Auto-créer player depuis Move si NewCharacter pas reçu?

### Priorité 3 : Validation complète

- [ ] Tester en jeu: Joueurs apparaissent ET bougent
- [ ] Vérifier pas de régression sur mobs/resources
- [ ] Supprimer code debug si tout fonctionne
- [ ] Documenter solution finale

---

## 🔗 Références

### Fichiers Critiques
- `scripts/classes/Protocol16Deserializer.js` - Désérialisation serveur
- `scripts/Utils/Utils.js` - Traitement events client
- `scripts/Handlers/MobsHandler.js` - Gestion mobs
- `scripts/Handlers/PlayersHandler.js` - Gestion players
- `app.js` - WebSocket bridge

### Documentation Archivée
- `archive_2025-11-17/BUFFER_DESERIALIZATION_STATUS.md` - Investigation détaillée complète
- `archive_2025-11-17/PLAYER_MOVEMENT_INVESTIGATION_2025-11-10_PM.md` - Investigation PM
- `archive_2025-11-17/PLAYER_MOVEMENT_CURRENT_STATUS.md` - Status obsolète
- `archive_2025-11-17/PLAYER_MOVEMENT_FIX_2025-11-10.md` - Fix incorrect

### Repositories Externes
- **ao-network** (Mai 2025) : `work/data/ao-network/` - Référence Photon protocol
- **AO-Radar** (2021) : Obsolète - ne pas utiliser

---

## ⚠️ Rappels pour Prochaine Session

1. **Lire cette section LEÇONS APPRISES** avant de toucher au code
2. **Ne PAS modifier Protocol16Deserializer.js** sauf absolue nécessité
3. **Tester CHAQUE changement** en jeu avant de continuer
4. **Créer une branche** pour expérimentations
5. **Si bloqué** : Demander confirmation à l'utilisateur avant modifications risquées

---

**Dernière modification** : 2025-11-17 18:00
**Prochain objectif** :
1. Ajouter Event 29 param[7] deserialization (server-side)
2. Investiguer pourquoi Event 3 marche pour mobs mais pas joueurs