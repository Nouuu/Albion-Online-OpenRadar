# 🎯 Player Detection & Movement - Status Investigation

**Dernière mise à jour**: 2025-11-17
**Statut**: En investigation - Régression majeure corrigée, mouvement à réparer

---

## 📊 Executive Summary

### ✅ Ce qui fonctionne (après revert 2025-11-17)
- Mobs apparaissent sur le radar
- Resources (static) apparaissent sur le radar
- Chests, dungeons, fish détectés correctement
- Event Code 3 (Move) reçus pour mobs/resources
- Architecture client/serveur clarifiée

### ❌ Ce qui NE fonctionne PAS
- **Mobs/Resources** : Visibles mais **NE BOUGENT PAS** (positions ne se mettent pas à jour)
- **Players** : **N'apparaissent PAS du tout** sur le radar
- Event Code 29 (NewCharacter) pour players non détectés ou non traités

### 🎯 Priorité #1
**Réparer le mouvement des mobs/resources** avant de toucher aux players.
Cause identifiée : Utils.js lit `Parameters[4]` et `Parameters[5]`, Protocol16Deserializer les set correctement, mais **handlers ne mettent pas à jour les positions**.

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
3. **RÉSULTAT** : Entités réapparaissent mais **ne bougent plus**

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
- ✅ Appelle `updateMobPosition()`
- ❌ **MAIS les mobs ne bougent PAS à l'écran**

### Problème Restant

**Hypothèse** : `MobsHandler.updateMobPosition()` ne met pas à jour la position visuelle
- La méthode existe (ligne 703 de MobsHandler.js)
- Elle modifie `m.posX` et `m.posY` dans `mobsList`
- MAIS peut-être que le rendu ne se rafraîchit pas?
- Ou les positions sont en format incompatible?

**À vérifier** :
1. `MobsDrawing.interpolate()` - Est-ce que ça lit `mob.posX/posY`?
2. `HarvestablesDrawing.interpolate()` - Même question pour resources
3. Format des positions - radar coords vs world coords?

---

## 🎯 Prochaines Étapes (Checklist)

### Priorité 1 : Réparer mouvement mobs/resources

- [ ] Vérifier `MobsHandler.updateMobPosition()` ligne 703
- [ ] Vérifier `MobsDrawing.interpolate()` - lit-il `mob.posX/posY`?
- [ ] Vérifier `HarvestablesHandler` - même logique?
- [ ] Tester avec logs : positions mises à jour dans `mobsList`?
- [ ] Comparer avec code fonctionnel (commit HEAD~6)

### Priorité 2 : Investigation players (APRÈS mouvement fixé)

- [ ] Analyser pourquoi Event Code 29 (NewCharacter) absent ou rare
- [ ] Vérifier si players apparaissent AVANT le lancement de l'app
- [ ] Chercher conditions de déclenchement Event 29
- [ ] Analyser param[7] de NewCharacter (Buffer positions players)

### Priorité 3 : Nettoyage (APRÈS validation complète)

- [ ] Supprimer code debug verbeux si tout fonctionne
- [ ] Supprimer logs excessifs
- [ ] Nettoyer commentaires temporaires

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

**Dernière modification** : 2025-11-17 13h30
**Prochain objectif** : Réparer mouvement mobs/resources (param[4]/[5] → handlers → rendu)