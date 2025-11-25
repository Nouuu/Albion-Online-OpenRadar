# 🧹 PLAN DE NETTOYAGE CODE

**Date**: 2025-11-26 00:15
**Objectif**: Nettoyer avant dev MITM (Option A)

---

## 📊 ANALYSE GIT DIFF

### Fichiers Modifiés (Session 2025-11-25)

```
ACTION_PLAN.md                            | -599 (nettoyé)
app.js                                    | +68
scripts/Handlers/PlayersHandler.js        | +77
scripts/Utils/Utils.js                    | +79
scripts/classes/Protocol16Deserializer.js | +387
```

**Total**: +611 lignes ajoutées (debug/tentatives XOR)

---

## 🔍 COMPARAISON PR #4 vs Notre Code

### PR #4 (Nouuu - FONCTIONNEL pour mobs)
**Approche**: Simple, efficace
- Protocol16Deserializer: Offsets 9/13 direct pour Event 3
- PlayersHandler: Gestion basique players
- Pas de XOR, pas de crypto
- **Fonctionne**: Mobs/resources ✅

### Notre Code (Session 2025-11-25)
**Approche**: Tentative XOR decrypt players
- Protocol16Deserializer: +387 lignes debug XOR
- PlayersHandler: Event 2 handling ajouté
- app.js: Logging massif Event 2/29/593
- **Résultat**: Code XOR non fonctionnel (pas de XorCode)

---

## ❌ CODE À NETTOYER

### 1. Protocol16Deserializer.js (+387 lignes)

**À SUPPRIMER**:

```javascript
// ❌ Lignes 116-132: ByteArray debug logging
logger.debug('PACKET_RAW', 'ByteArray_Deserialized', {...});

// ❌ Lignes 201-220: Request logging massif
logger.info('PACKET_RAW', `RAW_REQUEST_OP_${operationCode}`, {...});
logger.info('PACKET_RAW', 'REQUEST_21_PlayerMoving_FULL', {...});

// ❌ Lignes 232-252: Response logging massif
logger.info('PACKET_RAW', `RAW_RESPONSE_OP_${operationCode}`, {...});
logger.info('PACKET_RAW', `RESPONSE_INIT_OP_${operationCode}_FULL`, {...});

// ❌ Lignes 262-305: Event 593 debug (inutile sans Cryptonite)
console.log('🔥 [Protocol16Deserializer] EVENT 593 DETECTED!');
logger.warn('PACKET_RAW', 'Event593_BEFORE_DESERIALIZE', {...});
logger.critical('PACKET_RAW', 'PHOTON_CODE_WITH_PARAM252_593', {...});
logger[logLevel]('PACKET_RAW', `RAW_EVENT_CODE_${code}`, {...});

// ❌ Lignes 320-355: Event 2 handling (AO-Radar approach - obsolète)
if (code == 2) { /* decode buffer offsets 9/13 */ }

// ❌ Lignes 360-550: XOR decryption attempt (NON FONCTIONNEL)
// - isPlayerObjectId() checks
// - XOR avec header bytes
// - playerSpawns Map
// - Event 29 param[253] custom handling
```

**À GARDER** (de PR #4):
```javascript
// ✅ Event 3 simple: Offsets 9/13 pour mobs/resources
if (code == 3) {
    var bytes = new Uint8Array(parameters[1]);
    var position0 = new DataView(bytes.buffer, 9, 4).getFloat32(0, true);
    var position1 = new DataView(bytes.buffer, 13, 4).getFloat32(0, true);
    parameters[4] = position0;
    parameters[5] = position1;
    parameters[252] = 3;
}
```

---

### 2. PlayersHandler.js (+77 lignes)

**À SUPPRIMER**:
```javascript
// ❌ Ligne 35-38: Logger initialization message
window.logger?.info(CATEGORIES.PLAYER, 'PlayersHandler_Initialized', {...});

// ❌ Lignes 58-94: Event 29 custom handling (coords 0,0)
// Créer player sans position, attendre Event 2
// → Ne fonctionne pas, Event 2 n'a pas coords players

// ❌ Lignes 161-196: updatePlayerPosition() pour Event 2
// Jamais appelé car Event 2 ne fonctionne pas
```

**À RESTAURER** (de PR #4):
```javascript
// ✅ handleNewPlayerEvent() original
handleNewPlayerEvent(id, Parameters) {
    const nickname = Parameters[1];
    const guildName = Parameters[8];
    const flagId = Parameters[11] || 0;

    if (!Parameters[253] || !Parameters[253].spawnPosition) {
        window.logger?.error(CATEGORIES.PLAYER, 'Event29_MissingParam253', {...});
        return -1;
    }

    const worldPosX = Parameters[253].spawnPosition.x;
    const worldPosY = Parameters[253].spawnPosition.y;

    return this.addPlayer(worldPosX, worldPosY, id, nickname, guildName, flagId);
}
```

---

### 3. app.js (+68 lignes)

**À SUPPRIMER**:
```javascript
// ❌ Ligne 208: Port filter élargi (pas nécessaire)
const filter = 'udp and (portrange 5050-5060)';

// ❌ Lignes 247-270: Event 2 full debug
if (eventCode === 2) { logger.warn('SERVER_Event2_FULL_DEBUG', {...}); }

// ❌ Lignes 273-297: Event 29 full debug
if (eventCode === 29) { logger.warn('SERVER_Event29_FULL_DEBUG', {...}); }

// ❌ Lignes 300-311: Event 593 debug
if (eventCode === 593) { logger.warn('APP_Event593_DETECTED', {...}); }
```

**À RESTAURER**:
```javascript
// ✅ Port filter original
const filter = 'udp and (dst port 5056 or src port 5056)';

// ✅ Event 29 simple logging (de PR #4)
if (eventCode === 29) {
    logger.info('PACKET_RAW', 'APP_JS_Event29_Received', {
        objectId: dictonary["parameters"][0],
        name: dictonary["parameters"][1],
        hasParam253: !!dictonary["parameters"][253],
        param253: dictonary["parameters"][253],
        allParamKeys: Object.keys(dictonary["parameters"])
    });
}
```

---

### 4. Utils.js (+79 lignes)

**À VÉRIFIER**: Pas montré dans diff head -150
- Probablement des logs Event 2/593 ajoutés
- À nettoyer également

---

## ✅ RÉSULTAT ATTENDU APRÈS NETTOYAGE

### Code Base Propre (= PR #4 état)
- ✅ Mobs/resources fonctionnent (Event 3 offsets 9/13)
- ✅ Players spawn détectés (Event 29)
- ✅ Logging minimal (debug seulement)
- ❌ Players positions pas encore (attendu)

### Prêt pour MITM Dev
- Code baseline stable
- Pas de tentatives XOR inutiles
- Logs propres pour debugging MITM
- Git commit clean: "chore: revert to PR #4 baseline before MITM dev"

---

## 📝 PLAN D'ACTION

### Option 1: Git Revert (RAPIDE - Recommandé)

```bash
# 1. Identifier le commit PR #4
git log --oneline | grep -i "player\|pr"

# 2. Revert aux fichiers de ce commit
git checkout <commit-pr4> -- scripts/classes/Protocol16Deserializer.js
git checkout <commit-pr4> -- scripts/Handlers/PlayersHandler.js
git checkout <commit-pr4> -- app.js
git checkout <commit-pr4> -- scripts/Utils/Utils.js

# 3. Garder ACTION_PLAN.md, docs nouveaux
# (déjà nettoyés)

# 4. Commit
git add .
git commit -m "chore: revert to PR #4 baseline, remove XOR attempt code

- Restore simple Event 3 handling (offsets 9/13 for mobs/resources)
- Remove XOR decryption attempt (non-functional without XorCode)
- Remove Event 2/593 debug logging
- Clean baseline before MITM Photon development (Option A)

Refs: PR #4, TECHNICAL_REALITY.md"
```

**Temps**: 5 minutes

---

### Option 2: Manual Cleanup (LONG)

```bash
# Éditer manuellement chaque fichier
# Supprimer lignes identifiées ci-dessus
# Restaurer code PR #4
```

**Temps**: 30-60 minutes

---

## 💡 RECOMMANDATION

**Option 1 (Git Revert)** - RAPIDE et SÛR

**Raisons**:
- PR #4 est connu fonctionnel
- Git garantit restauration exacte
- Pas de risque erreur manuelle
- 5 minutes vs 1 heure

**Après revert**:
1. ✅ Code baseline propre
2. ✅ Mobs/resources fonctionnent
3. ✅ Players spawn détectés
4. ✅ Prêt pour dev MITM Phase 1

---

**Prochaine étape**: Reverter à PR #4 baseline?
- **OUI** → Je vous guide commandes git
- **NON** → On nettoie manuellement (plus long)