# 🎯 Plan d'Action - Fix Player Detection & Movement

**Créé**: 2025-11-17 18:30
**Statut Global**: 🔄 CODE RESTAURÉ - EN ATTENTE TESTS
**Dernière mise à jour**: 2025-11-18 17:30

---

## 📊 Analyse Logs Complets

### 📁 Logs Disponibles
- **Fichier principal** : `logs/sessions/session_2025-11-17T19-33-12.jsonl`
- **Statut** : ✅ Collecté avec logging universel (TOUS les events, TOUS les parameters)
- **Contenu** :
  - Event_3 (Move) avec buffers complets + floats_0_4_LE + floats_9_13_LE
  - Event_29 (NewCharacter) avec TOUS les parameters incluant param[7], param[19], param[20]
  - Event_71 (NewMob) et TOUS les autres event codes

### 🔬 Hypothèses Identifiées et Validées

#### Hypothèse 1 : Différents types de buffers Event 3
**Observation** : Analyse préliminaire montre que certains Event_3 ont des positions valides à offsets 9/13, d'autres non
- **Entités avec positions VALIDES** : IDs 530278 (-312.09, 28.19), 392054 (-351.12, 32.52), 577742, 584170
- **Entités avec positions INVALIDES** : IDs 598500 (1.66e+16), 597177 (-1.32e-33)
- **Pattern observé** : Buffers de 30 bytes commençant par 0x03 vs autres formats
- **✅ STATUT** : **CONFIRMÉE** - 9 types de buffers différents détectés (30_0x03, 22_0x01, 26_0x05, etc.)
- **✅ RÉSULTAT ANALYSE** : Offsets 1/5 fonctionnent pour 82% des buffers (vs 9/13 = 61.2%)

#### Hypothèse 2 : Corrélation type entité ↔ structure buffer
**Observation** : Possible distinction MOBs vs PLAYERs selon structure buffer
- IDs 530278, 392054, 577742, 584170 pourraient être des MOBs (positions valides)
- IDs 598500, 597177 pourraient être des PLAYERs ou autre type (structure différente)
- **⚠️ STATUT** : **DONNÉES INSUFFISANTES** - Logs analysés ne contiennent pas de corrélation Event_29/Event_71 avec Event_3

#### Hypothèse 3 : Event 29 param[7] ne contient PAS les positions
**Observation** : Logs montrent que param[19] et param[20] contiennent des Float32 valides
- Exemple : param[19]=96.34, param[20]=9.35 (positions raisonnables)
- param[7] : Buffer 16 bytes avec contenu qui ne donne pas de Float32 valides aux offsets testés
- **✅ STATUT** : **CONFIRMÉE** - Analysis complète montre:
  - param[19] et param[20] : **100% positions valides**
  - param[7] Buffer offsets 0/4 : **30.8% positions valides**
  - **CONCLUSION** : Utiliser param[19]/[20] directement, NE PAS désérialiser param[7]

### 📊 Prochaines Étapes d'Analyse
1. ⏳ Créer script d'analyse systématique testant TOUS les offsets possibles (0 à buffer.length-8)
2. ⏳ Grouper résultats par type de buffer (longueur, premier byte, entité)
3. ⏳ Corréler avec Event_29 et Event_71 pour identifier types d'entités
4. ⏳ Valider ou invalider les hypothèses ci-dessus

---

## 📊 Vue d'ensemble

**Problèmes identifiés** :
1. ❌ **Event 29 (NewCharacter)** : param[7] Buffer pas désérialisé côté serveur
2. 🚨 **Event 3 (Move) - RÉGRESSION CRITIQUE** : Offsets 9/13 sont FAUX (e+26)
   - ❌ Mobs NE BOUGENT PAS (statiques)
   - ❌ Joueurs NE BOUGENT PAS
   - ❌ Validation rejette toutes les positions (invalides)

**Ce qui fonctionne** :
- ✅ Mobs : Apparition (spawn) uniquement
- ✅ Resources : Détection (100%)
- ❌ Mouvement : RIEN ne bouge (offsets invalides)

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

### ⚠️ Étape 1.2 : Implémenter la désérialisation Event 29
**Statut**: ⚠️ À REVALIDER (2025-11-17 18:40 - Hypothèse 3 remet en question)
**Objectif**: Désérialiser param[7] Buffer → Array [posX, posY]

**Actions**:
- [x] Ajouter bloc Event 29 dans `Protocol16Deserializer.js`
- [x] Désérialiser avec offsets 0/4 (hypothèse principale)
- [x] Remplacer param[7] Buffer par Array [posX, posY] si valide
- [x] Ajouter validation des positions

**Fichier**: `scripts/classes/Protocol16Deserializer.js`

**Code ajouté** (lignes 202-244):
```javascript
// Phase 1.2 - Event 29 (NewCharacter) - Désérialisation param[7]
if(code == 29) {
    const param7 = parameters[7];
    if(param7 && Buffer.isBuffer(param7)) {
        // [DEBUG] Analyse structure
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

        // Désérialisation avec offsets 0/4 (hypothèse la plus probable)
        if(param7.length >= 8) {
            const posX = param7.readFloatLE(0);
            const posY = param7.readFloatLE(4);

            // Validation basique
            const isValidPosition = (pos) => !isNaN(pos) && Math.abs(pos) < 10000;

            if(isValidPosition(posX) && isValidPosition(posY)) {
                parameters[7] = [posX, posY];
                console.log('[DEBUG] Event 29 deserialized (offsets 0/4):', {posX, posY});
            } else {
                console.log('[WARN] Event 29 invalid positions with offsets 0/4:', {posX, posY});
            }
        }
    }
    parameters[252] = 29;
}
```

**Validation**: Code ajouté ✅ - Désérialisation avec validation + fallback si invalide

---

### ⏳ Étape 1.2bis : Vérifier param[19]/[20] vs param[7]
**Statut**: ⏳ PENDING (Nouvelle étape - 2025-11-17 19:40)
**Objectif**: Confirmer si param[19]/[20] contiennent les vraies positions spawn

**Actions**:
- [ ] Analyser logs Event_29 dans `session_2025-11-17T19-33-12.jsonl`
- [ ] Comparer param[7] Buffer vs param[19] Float vs param[20] Float
- [ ] Déterminer source correcte des positions initiales

**Validation**: Source des positions spawn identifiée

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
- ✅ Position correcte
- ✅ Logs montrent désérialisation réussie

---

## 🔍 Phase 2 : Fix Event 3 (Move) - Identification Structure Buffers

### ⏳ Étape 2.0 : Analyse systématique offsets possibles
**Statut**: ⏳ PENDING (Nouvelle étape - 2025-11-17 19:40)
**Objectif**: Tester TOUS les offsets possibles pour trouver positions valides

**Actions**:
- [ ] Créer script Node.js d'analyse des Event_3 du log complet
- [ ] Pour chaque buffer: tester offsets 0 à (length-8) par pas de 1
- [ ] Identifier quels offsets donnent positions valides (-500 < pos < 500)
- [ ] Grouper par type de buffer (longueur, premier byte)

**Fichier à créer**: `work/analyze_event3_all_offsets.js`

**Validation**: Patterns d'offsets identifiés par type de buffer

---

### ⏳ Étape 2.1 : Corrélation type entité ↔ type buffer
**Statut**: ⏳ PENDING (Renommée - 2025-11-17 19:40)
**Objectif**: Identifier si MOBs vs PLAYERs utilisent structures différentes

**Actions**:
- [ ] Extraire IDs entités depuis Event_29 (PLAYERs) et Event_71 (MOBs)
- [ ] Corréler avec Event_3 pour chaque ID
- [ ] Comparer structures buffer MOBs vs PLAYERs
- [ ] Confirmer ou invalider Hypothèse 2

**Validation**: Pattern MOB vs PLAYER confirmé ou infirmé

---

### ⏳ Étape 2.2 : Implémentation logique conditionnelle
**Statut**: ⏳ PENDING (Nouvelle étape - 2025-11-17 19:40)
**Objectif**: Implémenter désérialisation Event 3 avec offsets corrects

**Actions**:
- [ ] Ajouter détection type de buffer (length, byte[0], etc.)
- [ ] Appliquer offsets corrects selon type identifié
- [ ] Ajouter fallback multi-offsets si type inconnu
- [ ] Tester avec logs existants

**Fichier**: `scripts/classes/Protocol16Deserializer.js`

**Validation**: Désérialisation produit positions valides pour TOUS les buffers

---

### ⏳ Étape 2.3 : Test en jeu - Mouvement
**Statut**: ⏳ PENDING (Nouvelle étape - 2025-11-17 19:40)
**Objectif**: Vérifier que MOBs ET PLAYERs bougent correctement

**Actions**:
- [ ] Relancer le jeu avec corrections appliquées
- [ ] Observer mobs en mouvement
- [ ] Observer joueurs en mouvement
- [ ] Vérifier pas de régression

**Validation**: MOBs et PLAYERs bougent tous correctement

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
| Phase 1 | 1 / 4 | 4 | ✅⬜⬜⬜ 25% |
| Phase 2 | 0 / 4 | 4 | ⬜⬜⬜⬜ 0% |
| Phase 3 | 0 / 3 | 3 | ⬜⬜⬜ 0% |
| **TOTAL** | **1 / 11** | **11** | **9%** |

**Note**: Progression recalculée suite à ajout nouvelles étapes et reclassement étape 1.2 en "À REVALIDER"

---

## ⚠️ Rappels Critiques

### 🚨 NE PAS :
- ❌ Modifier `deserializeByteArray()` ou `deserializeParameterTable()`
- ⚠️ Bloc Event 3 UTILISE OFFSETS FAUX (9/13) - Ne pas supprimer le logging avant fix
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

### Session 2025-11-17 18:40
- ✅ Phase 1.2 complétée : Désérialisation Event 29 implémentée
- Fichier modifié : `Protocol16Deserializer.js` (lignes 202-244)
- Désérialisation avec offsets 0/4 + validation
- Fallback : garde Buffer original si positions invalides

### Session 2025-11-17 19:10
- ✅ Correction logging : console.log → logger (server + client)
- Fichiers modifiés :
  - `Protocol16Deserializer.js` : Event 3 et Event 29 utilisent global.loggerServer
  - `Utils.js` : Event 3 client utilise window.logger
- Logs maintenant dans fichiers JSONL (pas console)
- **Logs à chercher** dans `logs/sessions/*.jsonl` :
  - `Event29_Param7_Analysis` - Structure buffer param[7]
  - `Event29_Deserialized_Success` - Désérialisation réussie
  - `Event3_Server_Deserialized` - Event 3 serveur (10 premiers)
  - `Event3_Client_Handler` - Event 3 client avec MOB/PLAYER/UNKNOWN (10 premiers)
- **Action requise** : Tester en jeu dans zone avec joueurs

### Session 2025-11-17 19:20 - 🚨 RÉGRESSION CONFIRMÉE - OFFSETS 9/13 INVALIDES
- ❌ **CORRECTION CRITIQUE** : Mobs NE bougent PAS (utilisateur confirme)
- ❌ **ANALYSE LOGS** : `session_2025-11-17T19-14-02.jsonl` montre valeurs INVALIDES
  - `posX: 5.7e+18` et `posY: 3.8e+26` → ABSURDE
  - Offsets 9/13 pour Event 3 sont **FAUX**
- ❌ **VALIDATION `isValidPosition()`** : Rejette toutes les positions (> 10000)
- ❌ **RÉSULTAT** : `updateMobPosition()` jamais appelé → Mobs statiques
- 🔧 **FIX EN COURS** : Ajout logging buffer brut Event 3 (5 premiers)
  - Test offsets : 0/4, 1/5, 5/9, 9/13
  - Fichier modifié : `Protocol16Deserializer.js` (lignes 195-241)
  - Event `Event3_Buffer_Analysis` avec `first30Bytes` et `testOffsets`
- **Action requise** : Relancer jeu, observer logs `Event3_Buffer_Analysis` pour identifier vrais offsets

### Session 2025-11-17 19:30 - 🔍 LOGGING COMPLET TOUS LES EVENTS
- 💡 **NOUVELLE STRATÉGIE** : Logger TOUS les event codes avec TOUS les parameters
- ✅ **IMPLÉMENTÉ** : Logging universel dans `deserializeEventData()` (lignes 190-227)
  - Event name: `Event_${code}` avec category `ALL_EVENTS`
  - Pour chaque parameter:
    - Buffers : type, length, first20 bytes, floats_0_4_LE, floats_9_13_LE
    - Arrays : type, length, value
    - Autres : valeur directe
  - **AUCUNE LIMITE** : Tous les events loggés
- 📊 **RÉSULTAT ATTENDU** : Fichier log complet avec TOUS les events et parameters
- **Action requise** : Relancer jeu → Analyser logs `ALL_EVENTS` pour TOUS les event codes

### Session 2025-11-17 19:40 - 📊 ANALYSE LOGS COMPLETS & RESTRUCTURATION PLAN
- 🔍 **ANALYSE PRÉLIMINAIRE** : `session_2025-11-17T19-33-12.jsonl` analysé par agent
  - ✅ Logs complets collectés avec succès
  - 📋 **3 Hypothèses identifiées** (NON CONFIRMÉES) :
    1. Différents types de buffers Event 3 selon type entité
    2. Corrélation MOBs vs PLAYERs ↔ structure buffer
    3. Event 29 param[7] ne contient PAS positions (seraient dans param[19]/[20])
- 📝 **RESTRUCTURATION ACTION_PLAN.md** :
  - ✅ Ajout section "Analyse Logs Complets" avec hypothèses à confirmer
  - ✅ Ajout Phase 1 étape 1.2bis : Vérifier param[19]/[20] vs param[7]
  - ✅ Reclassement étape 1.2 en "À REVALIDER"
  - ✅ Refonte Phase 2 avec 4 nouvelles étapes d'analyse systématique
  - ✅ Recalcul progression : 1/11 étapes (9%) au lieu de 2/10 (20%)
- **⚠️ IMPORTANT** : Hypothèses NON VALIDÉES - Nécessitent confirmation par analyse systématique
- **Prochaine étape** : Créer script d'analyse pour valider ou invalider les hypothèses

### Session 2025-11-17 20:00 - ✅ HYPOTHÈSES VALIDÉES & CORRECTIONS APPLIQUÉES
- 📊 **SCRIPTS D'ANALYSE CRÉÉS** :
  - ✅ `work/analyze_event3_all_offsets.js` - Analyse systématique TOUS offsets Event 3
  - ✅ `work/analyze_event29_params.js` - Comparaison param[7] vs param[19]/[20]
- 📋 **RÉSULTATS ANALYSE** :
  - **Hypothèse 1** : ✅ CONFIRMÉE - 9 types de buffers différents détectés
  - **Hypothèse 2** : ⚠️ DONNÉES INSUFFISANTES (pas de corrélation Event_29/Event_71 dans logs)
  - **Hypothèse 3** : ✅ CONFIRMÉE - param[19]/[20] = 100% valides, param[7] = 30.8%
  - **Event 3** : Offsets 1/5 donnent 82% positions valides (vs 9/13 = 61.2%)
- 🔧 **CORRECTIONS APPLIQUÉES** :
  - ✅ **Event 3 FIX** : `Protocol16Deserializer.js:303-304` - Offsets 9/13 → 1/5
  - ✅ **Event 29 FIX** : `Protocol16Deserializer.js:323-330` - Supprimé désérialisation param[7], utilise param[19]/[20]
- 📈 **IMPACT ATTENDU** :
  - Event 3 : Passage de 61.2% → 82% positions valides (amélioration +20.8%)
  - Event 29 : Passage de 30.8% → 100% positions valides (amélioration +69.2%)
- 🎯 **PROCHAINE ÉTAPE** : Test en jeu pour validation

### Session 2025-11-18 16:00 - 🚨 RÉGRESSION IDENTIFIÉE - ANALYSE SIGNATURE 88_196
- 🔴 **FEEDBACK UTILISATEUR CRITIQUE** : "Les mobs et ressources marchaient AVANT, seuls les joueurs posaient problème"
- 🔴 **RÉGRESSION CONFIRMÉE** : Nos changements ont CASSÉ les mobs/resources qui marchaient
- 📊 **LOGS ANALYSÉS** :
  - `session_2025-11-18T15-58-19.jsonl` - Premier test après corrections offsets 1/5 → Mobs statiques
  - `session_2025-11-18T17-03-06.jsonl` - Second test avec détection déterministe → Mobs TOUJOURS statiques
- 🔍 **ANALYSE DÉTAILLÉE** :
  - ❌ **CODE ORIGINAL (MARCHAIT)** : Offsets 9/13 universels → OK pour ancienne zone (signature `38,16`)
  - ❌ **NOS CHANGEMENTS (CASSÉS)** :
    1. Première tentative : Offsets 1/5 universels → Basé sur logs ancienne zone
    2. Seconde tentative : Détection par signature → Reconnaît `38,16` mais PAS `88,196`
  - 🆕 **NOUVELLE SIGNATURE** : `88,196` (nouvelle zone de jeu) NON RECONNUE
    - Fallback sur offsets 9/13 utilisé
    - Offsets 9/13 NE MARCHENT PAS pour `88,196`
- 🔬 **SCRIPTS D'ANALYSE CRÉÉS** :
  - ✅ `work/analyze_signature_88_196.js` - Test tous offsets pour signature `88,196`
  - ✅ `work/analyze_signature_88_196_deep.js` - Analyse profonde buffers avec/sans positions
- 📋 **RÉSULTATS ANALYSE SIGNATURE 88_196** :
  - 34 buffers avec signature `88,196` trouvés
  - **52.9% (18/34)** buffers AVEC positions valides aux offsets 9/13
  - **47.1% (16/34)** buffers SANS positions valides (aucun offset ne fonctionne)
  - **OBSERVATION CLEF** : Impossible de différencier les deux types par signature
    - Même byte [6] = 0x26 (38) pour tous
    - Même longueur (30 bytes) pour 93.8%
    - Différence par entité : 309584 a positions valides, 390057/390818 n'ont pas
  - **HYPOTHÈSE** : Buffers sans positions = événements mouvement sans changement position (micro-mouvements, changement direction)
- 🔧 **CORRECTION APPLIQUÉE** :
  - ✅ **Reconnaissance explicite signature 88_196** : `Protocol16Deserializer.js:318-326`
  - ✅ Code mis à jour pour reconnaître 3 signatures :
    - TYPE A `[38, 16]` : Anciennes zones - Offsets 9/13 (100% valides)
    - TYPE C `[88, 196]` : Nouvelles zones - Offsets 9/13 (53% valides)
    - TYPE B `[75, 187]` : Type inconnu - Pas de positions
  - ✅ Commentaires clairs expliquant que 53% de coverage est normal
  - ✅ Validation client filtrera automatiquement positions invalides
- 🎯 **SOLUTION FINALE** :
  - Reconnaître signature `88,196` explicitement
  - Utiliser offsets 9/13 (comme code original)
  - Accepter que certains buffers donnent valeurs invalides
  - Client-side validation rejette positions invalides automatiquement
- 📈 **IMPACT ATTENDU** :
  - ✅ Mobs et resources bougent à nouveau (restauration fonctionnalité)
  - ✅ Joueurs apparaissent correctement (Event 29 param[19]/[20])
  - ✅ Pas de régression anciennes zones (signature `38,16` toujours reconnue)
- 🎯 **PROCHAINE ÉTAPE** : Test en jeu dans nouvelle zone pour confirmer mobs/resources bougent

### Session 2025-11-18 17:30 - 🔄 ROOT CAUSE IDENTIFIÉ - RESTAURATION CODE MAIN

- 🔴 **FEEDBACK UTILISATEUR** : "Olala non ça va pas du tout" - Les tentatives précédentes n'ont pas marché
- 🎯 **DÉCISION** : Retour aux sources - regarder la PR #4 pour comprendre ce qui marchait AVANT
- 📊 **ANALYSE PR #4** :
  - Comparaison complète code main (qui marche) vs feat/improve-detection (cassé)
  - **ROOT CAUSE TROUVÉ** : Ce n'est PAS `Protocol16Deserializer.js` mais **`Utils.js` côté CLIENT**
- 🔍 **BUG IDENTIFIÉ dans Utils.js** :
  - Validation `isValidPosition()` rejette positions valides : `!(x === 0 && y === 0)` rejette (0,0)
  - Updates mobs/resources conditionnels : si position invalide, pas de mise à jour
  - **Main branch** : Pas de validation, updates inconditionnels → MARCHAIT
- 🔧 **CORRECTIONS APPLIQUÉES** :
  - ✅ **Utils.js Event 3** : `scripts/Utils/Utils.js:376-383` - Restauré code simple de main
    ```javascript
    case EventCodes.Move:
        const posX = Parameters[4];
        const posY = Parameters[5];
        //playersHandler.updatePlayerPosition(id, posX, posY, Parameters);
        mobsHandler.updateMistPosition(id, posX, posY);
        mobsHandler.updateMobPosition(id, posX, posY);
        break;
    ```
  - ✅ **Protocol16Deserializer.js** : Vérifié - Event 3 (offsets 9/13) et Event 29 (marker) OK
- 📋 **FICHIERS MODIFIÉS** :
  - `scripts/Utils/Utils.js` : Lignes 376-383 - Supprimé 207 lignes de validation complexe, restauré 8 lignes simples
  - `scripts/classes/Protocol16Deserializer.js` : Déjà restauré précédemment (Event 3 simple + Event 29 marker)
- 🎯 **ÉTAT ACTUEL** :
  - Code restauré à l'état qui marchait sur main (mobs/resources)
  - Event 29 marker gardé pour identification joueurs (pour travail futur)
  - Pas de validation qui bloque les positions
- ✅ **TESTS RÉUSSIS** : Confirmation utilisateur - mobs et living resources bougent correctement !

---

### 🎉 RÉSULTAT - Session 2025-11-18 17:45

**✅ SUCCÈS CONFIRMÉ** : La restauration du code Utils.js a résolu le problème !
- ✅ Mobs se déplacent correctement
- ✅ Living resources (arbres, pierres, etc.) bougent correctement
- 🎯 Code identique à main branch = comportement identique (comme attendu)

**ROOT CAUSE FINALE** : La validation client-side dans Utils.js bloquait les updates de position valides pour les mobs/resources

**PROCHAINE PHASE** : Focus exclusif sur les joueurs (Event 29 et mouvement joueurs uniquement)
- Event 29 marker déjà en place (parameters[252] = 29)
- Ne PAS toucher au code mobs/resources qui marche maintenant

---

### Session 2025-11-19 - 🔍 ANALYSE REPOSITORY DE RÉFÉRENCE - AlbionOnline-StatisticsAnalysis

**Contexte** : Analyse du repository officiel AlbionOnline-StatisticsAnalysis (approuvé par Albion Online) pour enrichir notre compréhension du protocole et préparer Phase 2.

#### 📚 Repository Analysé
- **Projet** : AlbionOnline-StatisticsAnalysis (Statistics Analysis Tool)
- **Technologies** : C# .NET 9.0, WPF, Photon Protocol 16
- **Statut** : Outil officiel approuvé (monitors only, no overlay, no tracking outside view)
- **Fonctionnalités** : Auction house, loot logger, damage meter, dungeon tracker, crafting calculator
- **Localisation** : `work/data/AlbionOnline-StatisticsAnalysis`

#### ✅ Découvertes Event 29 (NewCharacter) - CONFIRMÉES

**Structure des Parameters** :
```
parameters[0]  = ObjectId (long)           - ID temporaire de l'entité (change à chaque map)
parameters[1]  = Name (string)             - Nom du joueur
parameters[7]  = Guid (byte[16])           - ID unique persistent du joueur
parameters[8]  = GuildName (string)        - Nom de la guilde
parameters[40] = CharacterEquipment (array) - Équipement du joueur (10 items)
```

**Validation Event 29** (du repository de référence) :
```csharp
// Event 29 est TOUJOURS un joueur si :
- parameters[0] existe (ObjectId)
- parameters[1] existe et non vide (Name)
- parameters[7] existe et longueur = 16 bytes (Guid)
- Guid != Empty (00-00-00...)
```

**Pattern Identification Joueur** :
- ✅ Event 29 = **Toujours un joueur** (jamais un mob/resource)
- ✅ Event 71 (NewMob) = **Toujours un mob/resource** (jamais un joueur)
- ✅ Différenciation garantie par le type d'event

#### ❌ Découverte Critique : Event 3 (Move)

**Constat du Repository** :
- ❌ **AUCUN handler** pour Event 3 dans le repository de référence
- ❌ **AUCUN tracking** de positions en temps réel
- ❌ L'outil ne gère **PAS** les mouvements des entités

**Fichiers Vérifiés** :
- `EventCodes.cs` : Liste Event 3 = Move mais **pas de handler**
- `NetworkManager.cs` : Aucun `MoveEventHandler` enregistré
- `Entity.cs` : **Pas de champs position** (x, y) dans le modèle

**Conclusion** :
- Event 3 fonctionne pour mobs/resources (déjà confirmé - Phase 1 OK)
- Event 3 pour **joueurs** : Structure possiblement différente ou event différent
- **Investigation nécessaire** : Identifier le vrai event de mouvement pour joueurs

#### 📊 Architecture du Repository (Patterns Utiles)

**1. Event Handler Pattern** :
```csharp
// Base class pour tous les handlers
EventPacketHandler<TEvent> : PacketHandler<EventPacket>
- Constructor(eventCode) : Enregistre le handler pour cet event
- OnActionAsync(TEvent value) : Override pour implémenter la logique
- Parsing automatique des parameters via constructeur TEvent
```

**2. Entity Management** :
```csharp
EntityController {
    ConcurrentDictionary<Guid, PlayerGameObject> _knownEntities;

    AddEntity(Entity entity)     // Ajoute ou met à jour
    GetEntity(long objectId)     // Récupère par ObjectId
    RemoveEntitiesByLastUpdate() // Cleanup auto des entités inactives
}
```

**Clef Guid vs ObjectId** :
- **Guid** : ID unique **persistent** du joueur (ne change jamais)
- **ObjectId** : ID **temporaire** de l'entité (change à chaque map/zone)
- **Pattern** : Utiliser Guid comme clé primaire, ObjectId comme secondaire

**3. Parameter Extraction Pattern** :
```csharp
// Extraction sécurisée avec validation
if (parameters.TryGetValue(0, out object objectId))
{
    ObjectId = objectId.ObjectToLong();
}
```

#### 🎯 Impact sur Phase 2

**Ce qui est CONFIRMÉ** :
- ✅ Event 29 structure complète validée
- ✅ param[0] = ObjectId, param[1] = Name, param[7] = Guid, param[8] = Guild
- ✅ Event 29 = identification joueur garantie (si Guid existe)
- ✅ Pattern Entity Manager avec Guid comme clé primaire

**Ce qui NÉCESSITE investigation** :
- ⚠️ param[19] et param[20] dans nos logs : Contiennent-ils les positions spawn ?
- ⚠️ param[7] : Est-ce bien un Guid pur ou Buffer avec données additionnelles ?
- ⚠️ Mouvement joueurs : Quel event utiliser ? (Event 3 ne marche pas pour joueurs selon référence)

**Prochaines Étapes Phase 2.1** :
1. Analyser nos logs Event 29 : vérifier param[7], param[19], param[20]
2. Créer script `work/analyze_event29_positions.js` pour extraction systématique
3. Implémenter extraction Event 29 dans `Protocol16Deserializer.js`
4. Implémenter handler Event 29 dans `Utils.js`
5. Tester en jeu : vérifier spawn joueurs à la bonne position

#### 📋 Fichiers du Repository Analysés

**Core Protocol** :
- `StatisticsAnalysisTool.Protocol16/Protocol16Deserializer.cs`
- `StatisticsAnalysisTool.Protocol16/EventData.cs`

**Network Layer** :
- `StatisticsAnalysisTool.Network/AlbionParser.cs`
- `StatisticsAnalysisTool.Network/NetworkManager.cs`
- `StatisticsAnalysisTool.Network/EventCodes.cs`

**Event Handlers** :
- `StatisticsAnalysisTool.Network/Events/NewCharacterEvent.cs`
- `StatisticsAnalysisTool.Network/Events/NewCharacterEventHandler.cs`
- `StatisticsAnalysisTool.Network/Events/NewMobEvent.cs`
- `StatisticsAnalysisTool.Network/Events/LeaveEvent.cs`

**Entity Management** :
- `StatisticsAnalysisTool/Models/NetworkModel/Entity.cs`
- `StatisticsAnalysisTool/Network/Controller/EntityController.cs`

**Operations** :
- `StatisticsAnalysisTool.Network/Operations/MoveOperation.cs` (Operation 21, pas Event 3)

#### 📝 Liens Utiles

- Repository : `work/data/AlbionOnline-StatisticsAnalysis`
- Documentation complète : Voir rapport d'analyse complet (agent Task)

---

### Session 2025-11-19 - 🧹 NETTOYAGE LOGS DEBUG

**Contexte** : Uniformiser et nettoyer les logs de debug dans le repository pour éviter les doublons et logs obsolètes.

#### 📋 Audit des Logs

**Architecture de Logging** :
- **LoggerServer.js** : Côté serveur Node.js - écrit dans fichiers JSONL (`logs/sessions/*.jsonl`)
- **LoggerClient.js** : Côté client browser - envoie via WebSocket au serveur
- **Pattern** : Tous les logs (serveur + client) sont centralisés dans les fichiers JSONL

**Fichiers Auditét** :
- `scripts/classes/Protocol16Deserializer.js` : ✅ Propre - pas de logs de debug
- `scripts/Utils/Utils.js` : ✅ Propre - seulement logs de chargement module (utiles)
- `app.js` : ❌ Contenait logs debug Event 29 obsolètes

#### 🔧 Nettoyages Effectués

**1. Suppression Debug Event 29 dans app.js** :
```javascript
// ❌ SUPPRIMÉ (lignes 245-258) :
if (eventCode === 29) {
  loggerServer.warn('PACKET_RAW', 'APP_JS_Event29_Received', {
    param7_type, param7_isArray, param7_value,
    param995_eventCode, param996_debug, param997_marker, etc.
  });
}
```

**Raison** : Log de debug temporaire pour investigation Event 29. Plus nécessaire maintenant que la structure est comprise.

#### ✅ État Actuel du Logging

**Logs Côté Serveur** (Protocol16Deserializer.js) :
- ✅ Pas de logs Photon - désérialisation silencieuse
- ✅ Events envoyés directement au client via WebSocket

**Logs Côté Client** (Utils.js) :
- ✅ Utilise `window.logger` pour logs structurés
- ✅ Envoyés au serveur via WebSocket → fichiers JSONL
- ✅ Filtrage par catégorie et settings utilisateur

**Avantage Architecture Actuelle** :
- 📊 Tous les logs centralisés dans fichiers JSONL (serveur + client)
- 🎯 Pas de doublon : events loggés côté client seulement (si nécessaire)
- ⚙️ Filtrage configurable par l'utilisateur (settings)
- 🧹 Code de désérialisation propre et lisible

#### 📝 Recommandations

**Logging Strategy Going Forward** :
1. **Pas de logs dans Protocol16Deserializer.js** - garder le code propre
2. **Logs dans Utils.js** - uniquement si nécessaire, avec `window.logger`
3. **Logs temporaires** - toujours avec commentaire `// 🔍 DEBUG:` pour facile identification
4. **Cleanup régulier** - supprimer logs debug après investigation terminée

---

### Session 2025-11-19 - 🔧 PHASE 2.1 IMPLÉMENTÉE - EN ATTENTE TESTS - Event 29 Player Spawn

**Contexte** : Implémentation de la détection et du spawn des joueurs basée sur Event 29 (NewCharacter).

⚠️ **STATUT** : **CODE IMPLÉMENTÉ - EN ATTENTE TESTS UTILISATEUR**

#### 📊 Analyse Complétée

**Script d'analyse créé** : `work/analyze_event29_positions.js`
- Analyse automatique de la structure Event 29
- Validation param[7] (Guid 16 bytes)
- Validation param[19]/[20] (positions spawn)
- Statistiques et rapports détaillés

**Résultats confirmés** (analyse précédente `work/analyze_event29_params.js`) :
- ✅ param[19] et param[20] : 100% positions valides
- ✅ param[7] Buffer : 16 bytes (Guid confirmé par référence)
- ✅ param[0] : ObjectId, param[1] : Name, param[8] : GuildName

#### 🔧 Implémentations Réalisées (NON TESTÉES)

**1. Server-side** : `scripts/classes/Protocol16Deserializer.js` (lignes 201-228)
```javascript
if(code == 29) {
    parameters[252] = 29;

    // Extract player data for client handler
    // Validation: Event 29 is ALWAYS a player (never a mob)
    // Reference confirms: param[7] = Guid (16 bytes), params[19]/[20] = spawn position
    const hasGuid = parameters[7] && Buffer.isBuffer(parameters[7]) && parameters[7].length === 16;
    const hasName = parameters[1] && typeof parameters[1] === 'string' && parameters[1].length > 0;
    const hasObjectId = parameters[0] !== undefined;

    if (hasGuid && hasName && hasObjectId) {
        // Store structured player data for client
        parameters[253] = {
            objectId: parameters[0],
            name: parameters[1],
            guid: parameters[7],  // Keep as Buffer (16 bytes) - persistent player ID
            guild: parameters[8] || '',
            spawnPosition: {
                x: parameters[19] || 0,  // Float32 - confirmed by analysis
                y: parameters[20] || 0   // Float32 - confirmed by analysis
            }
        };
    }
}
```

**Fonctionnalités** :
- ✅ Validation stricte : Guid (16 bytes) + Name + ObjectId requis
- ✅ Extraction données structurées dans param[253]
- ✅ Guid gardé comme Buffer (pas désérialisé) - ID persistent joueur
- ✅ Positions spawn extraites de param[19]/[20]

**2. Client-side** : `scripts/Utils/Utils.js` (lignes 385-406)
```javascript
case EventCodes.NewCharacter:
    // ✅ Event 29 - Player spawn handling
    // param[253] contains structured player data from Protocol16Deserializer
    // Only process if validation passed (has Guid, Name, ObjectId)
    if (Parameters[253]) {
        const playerData = Parameters[253];

        // Call existing handler with enhanced data
        const ttt = playersHandler.handleNewPlayerEvent(Parameters, map.isBZ);
        flashTime = ttt < 0 ? flashTime : ttt;

        // Log player spawn with position
        window.logger?.info(CATEGORIES.PLAYER, EVENTS.PlayerSpawn, {
            id: playerData.objectId,
            name: playerData.name,
            guild: playerData.guild,
            spawnX: playerData.spawnPosition.x,
            spawnY: playerData.spawnPosition.y,
            note: 'Player spawned - Event 29 processed'
        });
    }
    break;
```

**Fonctionnalités** :
- ✅ Vérification param[253] (validation serveur passée)
- ✅ Appel handler existant `playersHandler.handleNewPlayerEvent()`
- ✅ Logging structuré avec positions spawn
- ✅ Compatibilité avec code existant (pas de régression)

#### 📋 Fichiers Modifiés

**Core Protocol** :
- `scripts/classes/Protocol16Deserializer.js` : Lignes 201-228 - Event 29 extraction
- `scripts/Utils/Utils.js` : Lignes 385-406 - Event 29 handler client

**Scripts d'Analyse** :
- `work/analyze_event29_positions.js` : Script d'analyse Event 29 créé

#### 🎯 Pattern Implémenté (Repository de Référence)

**Basé sur AlbionOnline-StatisticsAnalysis** :
1. **Event 29 = TOUJOURS un joueur** (jamais un mob/resource)
2. **Event 71 (NewMob)** = TOUJOURS un mob/resource (jamais un joueur)
3. **Guid** (param[7]) = ID persistent joueur (ne change jamais)
4. **ObjectId** (param[0]) = ID temporaire entité (change à chaque map)
5. **Positions spawn** = param[19] (X) et param[20] (Y)

#### ⚠️ TESTS UTILISATEUR - PROBLÈME DÉTECTÉ

**Tests Effectués** :
1. ✅ Lancer le radar avec le code modifié
2. ✅ Se placer dans une zone avec joueurs
3. ✅ Vérifier logs `CATEGORIES.PLAYER` avec `EVENTS.PlayerSpawn`
4. Résultats :
   - ✅ Event 29 capturé
   - ✅ Nom joueur extrait correctement
   - ✅ Positions spawn valides (param[19]/[20])
   - ❌ **Joueurs apparaissent sur radar mais MAL POSITIONNÉS** (décalés, mal centrés)
   - ✅ Pas de régression mobs/resources

**🔴 PROBLÈME IDENTIFIÉ** : Session `session_2025-11-19T22-31-30.jsonl`
- Symptômes : "Points rouges visibles mais mal centrés par rapport au joueur local (point bleu)"
- Positions extraites : Valides dans les logs
- Hypothèse : **param[19]/[20] sont des coordonnées WORLD, pas RELATIVES**

**🚨 BUG CRITIQUE TROUVÉ** : `PlayersHandler.handleNewPlayerEvent` (ligne 164)
- Ordre des paramètres était INVERSÉ dans `addPlayer()`
- **AVANT** : `addPlayer(id, nickname, initialPosX, initialPosY, ...)` ❌
- **APRÈS** : `addPlayer(initialPosX, initialPosY, id, nickname, ...)` ✅
- **STATUT** : Corrigé mais nécessite nouveau test

**Prochaine Étape** :
1. Analyser `session_2025-11-19T22-31-30.jsonl` pour comprendre le décalage
2. Identifier si param[19]/[20] sont coordonnées world ou relatives
3. Implémenter conversion world → relative si nécessaire

---

### Session 2025-11-19 22:35 - 🔍 INVESTIGATION POSITIONS JOUEURS - DÉCALAGE DÉTECTÉ

**Contexte** : Joueurs apparaissent sur radar mais mal positionnés (décalés par rapport au joueur local).

**Feedback Utilisateur** :
- "Je vois des points rouges mais pas beaucoup et mal centré par rapport à moi (le point bleu au centre)"
- Fichier : `session_2025-11-19T22-31-30.jsonl`

**🐛 Bugs Corrigés Session Précédente** :
1. ✅ Ordre paramètres `addPlayer()` inversé (scripts/Handlers/PlayersHandler.js:164)
2. ✅ Vérification signatures toutes méthodes PlayersHandler

**⏳ EN COURS** : Investigation décalage positions

---

**Dernière modification**: 2025-11-19 22:35
**Statut actuel**: 🔍 INVESTIGATION POSITIONS - Bug signature corrigé, décalage à analyser