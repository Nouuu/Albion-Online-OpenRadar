# 🎯 Plan d'Action - Fix Player Detection & Movement

**Créé**: 2025-11-17 18:30
**Statut Global**: 🔄 EN COURS
**Dernière mise à jour**: 2025-11-17 18:30

---

## 📊 Vue d'ensemble

**Problèmes identifiés** :
1. ❌ **Event 29 (NewCharacter)** : param[7] Buffer pas désérialisé côté serveur
2. ❌ **Event 3 (Move)** : Fonctionne pour mobs ✅ mais pas pour joueurs ❌

**Ce qui fonctionne** :
- ✅ Mobs : Apparition + Mouvement (100%)
- ✅ Resources : Détection (100%)
- ✅ Event 3 désérialisation serveur : param[1] Buffer → param[4]/[5]

---

## 🔧 Phase 1 : Fix Event 29 param[7] Deserialization

### ✅ Étape 1.1 : Analyser le format de param[7]
**Statut**: ✅ COMPLETED (2025-11-17 18:35)
**Objectif**: Comprendre la structure du Buffer avant de le désérialiser

**Actions**:
- [x] Ajouter logging temporaire dans `Protocol16Deserializer.js` (Event 29)
- [ ] Lancer le jeu et observer les logs
- [ ] Identifier offsets corrects (hypothèse: 0/4 ou 9/13)

**Fichier**: `scripts/classes/Protocol16Deserializer.js`

**Code ajouté** (lignes 202-225):
```javascript
// [DEBUG] Phase 1.1 - Analyse structure Buffer param[7] Event 29 (NewCharacter)
if(code == 29) {
    const param7 = parameters[7];
    if(param7 && Buffer.isBuffer(param7)) {
        console.log('[DEBUG] Event 29 param[7] analysis:');
        console.log('  - Buffer length:', param7.length);
        console.log('  - First 20 bytes:', Array.from(param7.slice(0, Math.min(20, param7.length))));

        // Test hypothèse offsets 0/4 (comme position standard)
        if(param7.length >= 8) {
            const testPosX_0 = param7.readFloatLE(0);
            const testPosY_4 = param7.readFloatLE(4);
            console.log('  - Test offset 0/4:', {posX: testPosX_0, posY: testPosY_4});
        }

        // Test hypothèse offsets 9/13 (comme Event 3)
        if(param7.length >= 17) {
            const testPosX_9 = param7.readFloatLE(9);
            const testPosY_13 = param7.readFloatLE(13);
            console.log('  - Test offset 9/13:', {posX: testPosX_9, posY: testPosY_13});
        }
    }
    parameters[252] = 29;
}
```

**Validation**: Code ajouté ✅ - En attente test en jeu

---

### ⏳ Étape 1.2 : Implémenter la désérialisation Event 29
**Statut**: ⏳ PENDING
**Objectif**: Désérialiser param[7] Buffer → Array [posX, posY]

**Actions**:
- [ ] Ajouter bloc Event 29 dans `Protocol16Deserializer.js`
- [ ] Désérialiser avec offsets identifiés (étape 1.1)
- [ ] Remplacer param[7] Buffer par Array [posX, posY]

**Fichier**: `scripts/classes/Protocol16Deserializer.js`

**Code à ajouter**:
```javascript
if(code == 29) {
    const param7 = parameters[7];
    if(param7 && Buffer.isBuffer(param7) && param7.length >= 8) {
        const posX = param7.readFloatLE(0);  // Offset à confirmer
        const posY = param7.readFloatLE(4);  // Offset à confirmer
        parameters[7] = [posX, posY];
        console.log('[DEBUG] Event 29 deserialized:', {posX, posY});
    }
    parameters[252] = 29;
}
```

**Validation**: Logs montrent `Event 29 deserialized: {posX: X.XX, posY: Y.YY}` avec valeurs cohérentes

---

### ⏳ Étape 1.3 : Test en jeu - Position initiale
**Statut**: ⏳ PENDING
**Objectif**: Vérifier que les joueurs apparaissent à la bonne position

**Actions**:
- [ ] Lancer le radar
- [ ] Demander à un joueur d'entrer dans la vue
- [ ] Vérifier position correcte (pas au centre)

**Validation**:
- ✅ Joueur apparaît sur radar
- ✅ Position correcte (pas fallback param[19]/[20])
- ✅ Logs montrent désérialisation réussie

**Si échec**: Tester offsets alternatifs (9/13 comme Event 3)

---

## 🔍 Phase 2 : Investigation Event 3 (Move) pour Joueurs

### ⏳ Étape 2.1 : Diagnostic - Event 3 reçus ?
**Statut**: ⏳ PENDING
**Objectif**: Confirmer si Event 3 (Move) est reçu pour les joueurs

**Actions**:
- [ ] Ajouter logging Event 3 avec entityId
- [ ] Ajouter logging côté client (MOB vs PLAYER)
- [ ] Observer logs quand joueur bouge

**Fichiers**:
- `scripts/classes/Protocol16Deserializer.js`
- `scripts/Utils/Utils.js`

**Validation**:
- Si Event 3 reçu serveur MAIS pas traité client → Problème handler
- Si Event 3 PAS reçu serveur → Problème protocole

---

### ⏳ Étape 2.2 : Diagnostic - PlayersHandler rejette ?
**Statut**: ⏳ PENDING
**Objectif**: Vérifier si `updatePlayerPosition()` rejette silencieusement

**Actions**:
- [ ] Ajouter logging dans `updatePlayerPosition()` (ligne 263)
- [ ] Logger si player existe dans `playersInRange`
- [ ] Identifier cause rejet

**Fichier**: `scripts/Handlers/PlayersHandler.js`

**Validation**: Identifier si race condition ou autre problème

---

### ⏳ Étape 2.3 : Comparaison MobsHandler vs PlayersHandler
**Statut**: ⏳ PENDING
**Objectif**: Comprendre pourquoi mobs bougent mais pas joueurs

**Actions**:
- [ ] Analyser `MobsHandler.updateMobPosition()` (fonctionne)
- [ ] Analyser `PlayersHandler.updatePlayerPosition()` (échoue)
- [ ] Identifier différence critique

**Validation**: Différence identifiée

---

### ⏳ Étape 2.4 : Fix Race Condition (si confirmé)
**Statut**: ⏳ PENDING
**Objectif**: Gérer le cas où Move arrive avant NewCharacter

**Actions**:
- [ ] Choisir approche (auto-création OU buffer pending moves)
- [ ] Implémenter fix
- [ ] Tester avec scénario race condition

**Fichier**: `scripts/Handlers/PlayersHandler.js`

**Options**:
- Option A: Auto-créer player depuis Move
- Option B: Buffer Move events et rejouer après NewCharacter

**Validation**: Joueurs bougent même si Move avant NewCharacter

---

## 📊 Phase 3 : Validation Complète

### ⏳ Étape 3.1 : Test Scénarios Complets
**Statut**: ⏳ PENDING

**Scénarios à valider**:
- [ ] Joueur entre dans vue → Apparaît à bonne position
- [ ] Joueur bouge → Position se met à jour
- [ ] Joueur entre en bougeant → Race condition gérée
- [ ] Mobs continuent de fonctionner (pas de régression)
- [ ] Resources continuent de fonctionner (pas de régression)

---

### ⏳ Étape 3.2 : Cleanup Logs Debug
**Statut**: ⏳ PENDING

**Actions**:
- [ ] Supprimer tous les `[DEBUG]` temporaires
- [ ] Garder uniquement logs critiques (erreurs)

---

### ⏳ Étape 3.3 : Documentation Finale
**Statut**: ⏳ PENDING

**Actions**:
- [ ] Mettre à jour `PLAYER_DETECTION_STATUS.md`
- [ ] Documenter solution Event 29
- [ ] Documenter solution Event 3 (si applicable)
- [ ] Marquer todos comme completed

---

## 📈 Progression Globale

| Phase | Étapes Complétées | Total | Progression |
|-------|-------------------|-------|-------------|
| Phase 1 | 1 / 3 | 3 | ✅⬜⬜ 33% |
| Phase 2 | 0 / 4 | 4 | ⬜⬜⬜⬜ 0% |
| Phase 3 | 0 / 3 | 3 | ⬜⬜⬜ 0% |
| **TOTAL** | **1 / 10** | **10** | **10%** |

---

## ⚠️ Rappels Critiques

### 🚨 NE PAS :
- ❌ Modifier `deserializeByteArray()` ou `deserializeParameterTable()`
- ❌ Toucher au bloc Event 3 existant (mobs fonctionnent)
- ❌ Commiter sans tester en jeu

### ✅ TOUJOURS :
- ✅ Tester en jeu après CHAQUE modification
- ✅ Vérifier pas de régression mobs/resources
- ✅ Logger valeurs avant/après désérialisation
- ✅ Mettre à jour ce fichier après chaque étape

---

## 📝 Notes de Session

### Session 2025-11-17 18:30
- Plan créé
- Prêt à démarrer Phase 1.1

### Session 2025-11-17 18:35
- ✅ Phase 1.1 complétée : Logging Event 29 param[7] ajouté
- Fichier modifié : `Protocol16Deserializer.js` (lignes 202-225)
- Logging teste 2 hypothèses : offsets 0/4 et 9/13
- **Action requise** : Lancer le jeu et observer les logs Event 29 dans la console serveur

---

**Dernière modification**: 2025-11-17 18:35
**Prochaine étape**: Tester en jeu pour identifier les offsets corrects, puis Phase 1.2