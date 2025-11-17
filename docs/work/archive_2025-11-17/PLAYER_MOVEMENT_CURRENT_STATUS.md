# 🚧 État Actuel - Mouvement des Joueurs

**Date**: 2025-11-10
**Status**: 🔴 **EN COURS DE DÉBOGAGE**

---

## 📊 Résumé Exécutif

**Problème**: Les joueurs sont détectés et apparaissent sur le radar, mais **restent figés** à leur position initiale ou apparaissent "au centre" (position d'origine du local player).

### Ce qui fonctionne ✅

1. **Détection initiale (NewCharacter, EventCode 29)**
   - ✅ Les joueurs sont détectés via param[12] ou param[13]
   - ✅ Position initiale correcte (coordonnées locales/radar)
   - ✅ Logs `PlayerDetected` et `PlayerAdded` fonctionnent
   - ✅ Flash/son d'alerte fonctionne

2. **Affichage initial**
   - ✅ Les cercles rouges apparaissent sur le radar
   - ✅ lpX/lpY s'initialisent correctement (~650ms après spawn)

### Ce qui NE fonctionne PAS ❌

1. **Mise à jour des positions (Move, EventCode 3)**
   - ❌ Les joueurs ne bougent JAMAIS après détection
   - ❌ posX/posY restent figés aux valeurs initiales de NewCharacter
   - ❌ Quand le local player bouge, les autres joueurs semblent "glisser" vers leur position d'origine relative

2. **Affichage dynamique**
   - ❌ Les joueurs apparaissent au "centre" (là où était le local player à l'origine)
   - ❌ Pas de suivi des mouvements en temps réel

---

## 🔍 Diagnostic Actuel

### Timeline du Bug

```
t=0ms     → Joueur "Eoeo" détecté (posX=1.39, posY=5.5) ✅
t=0-650ms → lpX=0, lpY=0 (non initialisé) → interpolation skippée ✅ (fix appliqué)
t=650ms   → lpX=-0.13, lpY=-27.36 (initialisé via OnRequest_Move) ✅
t=650ms+  → Joueur rendu à transformedX=358, transformedY=151 ✅

[Joueur bouge in-game]
t=1000ms  → Move event reçu (param[252]=3)
           → Buffer param[1] décodé aux offsets 9/13
           → bufferX = 1.28e-28, bufferY = 6.2e+21 ❌ INVALIDE!
           → isValidPosition() = false
           → updatePlayerPosition() SKIPPÉE ❌
           → posX/posY restent à 1.39, 5.5 (figés)

[Local player bouge]
t=2000ms  → lpX change à -50
           → hX = -1 * 1.39 + (-50) = -51.39
           → Joueur "glisse" vers position relative incorrecte ❌
```

### Logs Diagnostiques (2025-11-10 09:50)

**DIAG_MoveBuffer_Structure** montre que le Buffer est reçu:
```json
{
  "bufferLength": 30,
  "bufferBytes": [3,65,195,237,155,62,32,222,8,76,106,34,17,6,70,168,99,104,51,51,17,65,39,104,168,110,28,75,247,99],
  "param4": 1.2812301918109557e-28,  // ❌ CORROMPU
  "param5": 6.20819744963144e+21      // ❌ CORROMPU
}
```

**DIAG_MoveBuffer_Decoded** avec offsets 9/13:
```json
{
  "bufferX": 1.2812301918109557e-28,  // ❌ IDENTIQUE à param4 - PAS de décodage réel!
  "bufferY": 6.20819744963144e+21,     // ❌ IDENTIQUE à param5
  "isValid": false
}
```

**OBSERVATION CRITIQUE**: Les offsets 9/13 donnent les **MÊMES valeurs** que param[4]/[5], ce qui suggère que:
- Soit les offsets sont toujours incorrects
- Soit le Buffer contient param[4]/[5] déjà désérialisés (pas les vraies coordonnées)

---

## 🧪 Hypothèses en Investigation

### Hypothèse 1: Photon Event Code 2 vs 3

**Référence**: AO-Radar PacketHandler.cs ligne 25
```csharp
if (code == 2) {  // ← Photon Event Code, PAS param[252]!
    onPlayerMovement(parameters);  // Utilise Buffer offsets 9/13
}
```

**Notre code**: On écoute seulement `param[252] = 3` (Move générique)

**Action**: Vérifier si les Move events des joueurs arrivent avec un Photon Event Code différent.

**Logs à analyser**: `Event_Full_Dictionary` (ajouté dans Utils.js:224)

### Hypothèse 2: Buffer Format Différent

**Observation**: Le Buffer commence par `[3, 65, 195, ...]`
- Byte 0 = 3 (EventCode?)
- Bytes suivants = données inconnues

**Possibilité**: Le format du Buffer varie selon le type d'entité (joueur vs mob vs harvestable)

**Action**: Comparer les Buffers de Move events pour:
- Joueurs (param[252]=3, id dans __knownPlayerIds)
- Mobs (param[252]=3, id pas dans __knownPlayerIds)

### Hypothèse 3: Workaround Actif Bloque les Joueurs

**Code actuel** (Utils.js:529):
```javascript
// 🚨 WORKAROUND: Skip player position updates
const isLikelyPlayer = !isValidPosition(posX, posY);
if (!isLikelyPlayer) {
    playersHandler.updatePlayerPosition(id, posX, posY, Parameters);
}
```

**Problème**: Si posX/posY sont invalides, isLikelyPlayer=true → updatePlayerPosition() jamais appelé!

**Solution envisagée**: Les joueurs doivent TOUJOURS être mis à jour, mais avec param[19]/[20] (World coords) du Move event, pas param[4]/[5]!

---

## 📁 Fichiers Modifiés (Session 2025-11-10)

### Corrections Appliquées

1. **PlayersDrawing.js** (Lignes 94-159)
   - ✅ Ajout garde lpX/lpY=0 dans interpolate()
   - ✅ Skip interpolation si non initialisés
   - ✅ Logs DIAG_Interpolate_Skipped/Resumed

2. **PlayersDrawing.js** (Lignes 186-192)
   - ✅ Filtre hX/hY en plus de posX/posY
   - ❌ ATTENTION: Empêche affichage des joueurs non interpolés!

3. **Utils.js** (Lignes 224-235)
   - ✅ Log Event_Full_Dictionary (3 premiers events)
   - 🔍 Pour trouver Photon Event Code

4. **Utils.js** (Lignes 397-430)
   - ✅ Logs DIAG_MoveBuffer_Structure (5 premiers)
   - ✅ Logs DIAG_MoveBuffer_Decoded
   - 🔍 Pour analyser structure du Buffer

### Logs Diagnostiques Actifs

```javascript
// Premiers 3 events
Event_Full_Dictionary → Cherche Photon Event Code

// Premiers 5 Buffers corrompus
DIAG_MoveBuffer_Structure → Bytes bruts du Buffer
DIAG_MoveBuffer_Decoded   → Valeurs décodées offsets 9/13

// Tracking joueurs
DIAG_PlayerCreated     → Coordonnées initiales
DIAG_Interpolate       → Calcul hX/hY
DIAG_BeforeFilter      → Avant filtre position
DIAG_AfterFilter       → Après filtre
DIAG_Rendering         → Coordonnées transformées
```

---

## 🎯 Actions Suivantes

### Priorité 1: Analyser les Nouveaux Logs

1. Chercher `Event_Full_Dictionary` dans les logs
   - Identifier si Photon Event Code est accessible
   - Voir si Move events joueurs ont code=2 au lieu de 3

2. Analyser `DIAG_MoveBuffer_Structure`
   - Comparer structure Buffer joueurs vs mobs
   - Identifier patterns dans les bytes

3. Tester différents offsets
   - Si 9/13 donnent mêmes valeurs que param[4]/[5]
   - Essayer d'autres offsets (0-3, 4-7, etc.)

### Priorité 2: Vérifier Repos de Référence

Comparer notre décodage avec:
- AO-Radar/AlbionRadaro/PacketHandler.cs (C#)
- albion-network/Albion.Network.Example/MoveEvent.cs
- ao-network (JavaScript - s'il existe)

Points à vérifier:
- Format exact du Buffer (longueur, structure)
- Différence entre Photon Event Code (fonction param) vs param[252]
- Gestion des joueurs vs autres entités

### Priorité 3: Solutions Alternatives

**Si Buffer décodage échoue**:
- Utiliser param[19]/[20] (World coords) dans Move events?
- Calculer position relative à partir de lpX/lpY et param[19]/[20]?

**Si EventCode différent**:
- Écouter Photon Event Code 2 en plus de param[252]=3
- Router différemment selon type d'entité

---

## 📚 Contexte Historique

### 2025-11-09: "Solution" param[12]/[13] et offsets 9/13

**Document**: `PLAYER_DETECTION_SOLUTION.md`

**Status**: ✅ Partiellement correct
- NewCharacter (param[12]/[13]) fonctionne
- Move (offsets 9/13) NE fonctionne PAS (valeurs invalides)

**Erreur**: Document conclut "problème résolu" alors que seule la détection initiale fonctionne, pas le mouvement.

### Avant 2025-11-09: Multiples Investigations

**Archivé dans**: `docs/work/archive_2025-11-09/`

Documents obsolètes/trompeurs:
- PLAYER_COORDINATES_INVESTIGATION_PLAN.md
- BUFFER_DECODING_REFERENCE.md
- PLAYERS_VS_MOBS_PROTOCOL_DIFFERENCES.md
- etc.

**Raison de l'archivage**: Conclusions basées sur hypothèses incorrectes (protocole différent, chiffrement, etc.)

---

## ⚠️ IMPORTANT

**Ce document remplace** `PLAYER_DETECTION_SOLUTION.md` qui est **OBSOLÈTE** et **TROMPEUR**.

Le problème n'est PAS résolu. Les joueurs:
- ✅ Sont détectés
- ✅ Apparaissent initialement
- ❌ Ne bougent JAMAIS

**Prochaine session**: Analyser logs `Event_Full_Dictionary` et `DIAG_MoveBuffer_*` pour identifier la vraie cause.

---

**Dernière mise à jour**: 2025-11-10 (Session de débogage avec Claude)