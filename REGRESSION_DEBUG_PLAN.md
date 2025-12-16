# Plan de Debug - Regression Harvest Events depuis v2.0.0

## STATUS: EN TEST - Session 2025-12-16T00:xx

---

## CORRECTIONS VALIDÉES (16 Dec 2025)

### 1. Détection des ressources vivantes → statiques ✅ CORRIGÉ

**Problème**: Quand on tue une Fiber vivante (mobileTypeId=530), le drop statique montrait Hide au lieu de Fiber.

**Cause racine**:
- Event 40 envoie `type:16` (range Hide 16-22) même pour les Fiber vivantes
- `HarvestablesDrawing` utilisait `harvestableOne.type` (16) au lieu du `stringType` corrigé

**Solution appliquée**:
1. Ajout de `stringType` dans la classe `Harvestable`
2. `addHarvestable()` et `UpdateHarvestable()` utilisent `MobsDatabase.getResourceInfo(mobileTypeId)` pour les living resources
3. `HarvestablesDrawing.invalidate()` utilise `stringType` en priorité (avec fallback sur `type`)

```javascript
// HarvestablesHandler.js - addHarvestable()
if (isLiving && window.mobsDatabase?.isLoaded) {
    const resourceInfo = window.mobsDatabase.getResourceInfo(mobileTypeId);
    stringType = resourceInfo?.type || this.GetStringType(type);
}
```

### 2. Décrémentation des ressources - NOUVELLE APPROCHE ⚠️ EN TEST

**Problème précédent**: Double décrémentation (Event 46 + Event 61)

**Analyse des logs session_2025-12-15T23-33-52.jsonl**:
```
Ressource 89213 (Fiber T4, size=3):
- Event 46: newSize=2 @ 22:36:11.427 (IGNORÉ car 2 < 3)
- Event 46: newSize=1 @ 22:36:12.283 (IGNORÉ car 1 < 2)
- Event 61: décrémente 3→2 @ 22:36:12.319
- Event 61: décrémente 2→1 @ 22:36:13.203
```

**Le problème**: Event 46 arrive AVANT Event 61 avec le newSize correct du serveur.
Mais mon code ignorait Event 46 car `newSize < harvestable.size`.

**NOUVELLE SOLUTION (16 Dec 2025)**:
```javascript
// Event 46 (HarvestUpdateEvent) - SOURCE DE VÉRITÉ
if (newSize !== harvestable.size) {
    harvestable.size = newSize;  // Accepte TOUTES les mises à jour
    if (harvestable.size <= 0) {
        this.removeHarvestable(id);
    }
}

// Event 61 (harvestFinished) - NOTIFICATION SEULEMENT
// NE décrémente PLUS - Event 46 gère tout
```

**Logique**:
- Event 46 est la source de vérité du serveur Albion
- Event 61 n'est qu'une notification qui arrive APRÈS Event 46
- Pas de double décrémentation car Event 61 ne fait plus rien

### 2. Double Event 40 pour ressources vivantes ✅

**Problème**:
Le serveur Albion envoie DEUX Event 40 pour chaque ressource vivante:
1. Event 40 avec `param[1]` = ID du mob vivant associé, `size=5` → **LIVING CREATURE**
2. Event 40 sans `param[1]`, `size=0` → **LIVING CREATURE (autre format)**

L'ancienne logique basée sur `size` était incorrecte car les living creatures arrivent parfois avec `size > 0`.

**Nouvelle logique** (basée sur `param[1]` = livingMobId):
```javascript
// Dans newHarvestableObject() - NOUVEAU
const livingMobId = Parameters[1];  // ID du mob vivant associé
const hasRealMobileTypeId = mobileTypeId !== null && mobileTypeId !== 65535;

// param[1] présent = ressource liée à un mob VIVANT = SKIP
const isLivingCreature = hasRealMobileTypeId && livingMobId !== undefined;

if (isLivingCreature) {
    return; // Géré par MobsHandler via Event 71/123
}

// Si on arrive ici avec mobileTypeId réel mais SANS livingMobId
// = Static drop d'un mob MORT = AJOUTER
```

**Preuve dans les logs**:
```json
// Ressource VIVANTE - A SKIP (param[1] présent)
{"id":61192, "mobileTypeId":531, "livingMobId":16209, "size":5}

// Ressource STATIQUE enchantée - A AJOUTER (mobileTypeId=65535)
{"id":2580, "mobileTypeId":65535, "size":5}

// Static DROP - A AJOUTER (mobileTypeId réel mais PAS de livingMobId)
// (cas théorique - drop d'un mob mort sans lien vers le mob)
```

---

### Note sur le comportement de récolte par tier (info utilisateur)

L'utilisateur a mentionné que les ressources se récoltent différemment selon le tier:
- T1-T4: Récolte par 2 (ressources de 6) ou par 3 (ressources de 9)
- T5+: Récolte de 1 en 1

Cette information est gérée côté serveur Albion - notre code ne fait que lire les valeurs envoyées.
Le comportement v2.0.0 (Event 61 décrémente de 1) fonctionne car c'est le serveur qui contrôle
le nombre d'unités récoltées par action.

---

### Probleme de decrementation intermittente (ANCIEN)

**Analyse session_2025-12-15T20-12-55**:
Ressource 2239 (Fiber T5):
- Detection: size 5
- Event61 (HarvestFinished) x3
- Event46: 5→2 (manque 3 updates intermédiaires!)
- Event46: 2→1
- Event61 final (mais PAS de Event46 depleted!)

**Cause**: Event 46 n'est PAS fiable - certains events sont perdus (réseau, batching, etc.)

**Solution v2.0.0 (restaurée)**:
- Event 61 (harvestFinished) décrémente TOUJOURS de 1
- Event 46 ne gère que la régénération (augmentation de size)
- Double sécurité: si Event 46 rate, Event 61 maintient le compteur

---

## CORRECTIONS APPLIQUEES

### HarvestablesHandler.js - Event 46 (COMPLET) ✅
1. **BUG 1 CORRIGE**: Quand `newSize === undefined`, la ressource est maintenant supprimee (avant: return sans action)
2. **BUG 2 CORRIGE**: `newSize !== harvestable.size` au lieu de `newSize > harvestable.size` (permet decrementation)
3. **BUG 3 CORRIGE**: `harvestFinished()` ne decremente plus manuellement - Event 46 gere tout

### Nouveau systeme de gestion du size
- **AVANT**: harvestFinished() decrementait de 1 manuellement → problemes avec procs/bonus
- **MAINTENANT**: Event 46 fournit `newSize` exact du serveur Albion → fiable et synchronise

```
Event 46 avec newSize    → harvestable.size = newSize (valeur exacte du serveur)
Event 46 sans newSize    → ressource epuisee → removeHarvestable(id)
Event 61 (harvestFinished) → log seulement, plus de decrementation
```

### MobsDrawing.js - Casse des images (COMPLET) ✅
**Probleme**: `mobOne.name` retourne "Fiber" (majuscule) mais les fichiers sont `fiber_5_0.webp` (minuscule)
**Solution**: Ajout de `.toLowerCase()` dans la construction du nom d'image

```javascript
// AVANT (bug)
imageName = mobOne.name + "_" + mobOne.tier + "_" + mobOne.enchantmentLevel;
// Resultat: "Fiber_5_0" → fichier non trouve

// APRES (corrige)
imageName = mobOne.name.toLowerCase() + "_" + mobOne.tier + "_" + mobOne.enchantmentLevel;
// Resultat: "fiber_5_0" → correspond a fiber_5_0.webp
```

---

## OPTIMISATIONS TEMPORAIREMENT DESACTIVEES (A REACTIVER)

### RadarRenderer.js - FPS Throttling
**Status**: DESACTIVE pour debug - A REACTIVER apres validation

```javascript
// AVANT (optimise - 30 FPS)
this.TARGET_FPS = 30;
this.FRAME_TIME = 1000 / this.TARGET_FPS;
// ... throttling logic dans gameLoop()

// ACTUELLEMENT (debug - pas de limite)
// Rendu a chaque frame pour maximum reactivite
gameLoop() {
    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    this.update();
    this.render();
}
```

**Objectif a terme**: Reactiver le throttling a 30 FPS une fois les bugs valides

### WebSocketEventQueue.js - Event Batching/Coalescing
**Status**: DESACTIVE pour debug - A REACTIVER apres validation

```javascript
// AVANT (optimise - RAF batching + coalescing)
const COALESCABLE_EVENTS = new Set([3, 6, 91]);  // Move, Health, Regen
const THROTTLED_EVENTS = { 6: 50, 91: 100 };     // ms entre events

queueEventInternal(messageType, dict) {
    // ... coalescing logic
    this.eventQueue.set(queueKey, event);
    this.scheduleFlush();  // requestAnimationFrame
}

// ACTUELLEMENT (debug - traitement immediat)
queueEventInternal(messageType, dict) {
    // Traitement IMMEDIAT - pas de queue, pas de RAF
    if (this.flushCallback) {
        this.flushCallback(messageType, parameters);
    }
}
```

**Objectif a terme**: Reactiver le batching intelligent
- Coalescing UNIQUEMENT pour events haute frequence (3=Move, 6=Health, 91=Regen)
- Event 46 (HarvestableChangeState) ne doit JAMAIS etre coalescé - chaque update compte
- Throttling pour reduire la charge CPU sur events de mouvement

### Architecture cible pour le batching

```
[WebSocket message]
    |
    v
[parseMessage] → Extrait code + parameters
    |
    v
[queueEventInternal]
    |
    +--→ Event 3/6/91 (haute frequence) → Coalescing par entityId → RAF flush
    |
    +--→ Event 46/59/61 (harvest) → Traitement IMMEDIAT (pas de coalescing!)
    |
    +--→ Autres events → Traitement immediat
```

## PROBLEMES RESTANTS A INVESTIGUER

### Fibres vivantes affichent parfois des peaux
- **Status**: CORRIGE (2 bugs trouves) ✅

#### Bug 1: Casse des images (MobsDrawing.js)
**CORRECTION APPLIQUEE** dans MobsDrawing.js ligne 44:
```javascript
imageName = mobOne.name.toLowerCase() + "_" + mobOne.tier + "_" + mobOne.enchantmentLevel;
```

#### Bug 2: Distinction Living Creature vs Static Drop ⚠️ MAJEUR

**CAUSE RACINE** (session_2025-12-15T20-06-54):
Event 40 avec `mobileTypeId` reel peut etre DEUX choses differentes:
1. **Living creature en vie** (size=0) → Geree par MobsHandler
2. **Static drop apres mort** (size>0) → Doit etre ajoutee a harvestableList!

**Premiere correction (BUG)**:
Skip TOUS les Event 40 avec mobileTypeId reel → Les drops statiques apres mort disparaissaient!

**Preuve dans les logs**:
```json
// Event 40 avec size=5 = STATIC DROP, pas living creature!
"id":61192, "mobileTypeId":531, "size":5, "type":16, "enchant":0
```
→ Etait incorrectement skippe comme "living resource"

**CORRECTION FINALE** dans HarvestablesHandler.UpdateHarvestable():
```javascript
const hasRealMobileTypeId = mobileTypeId !== null && mobileTypeId !== 65535;
const isLivingCreature = hasRealMobileTypeId && size === 0;  // Living = size 0
const isStaticDrop = hasRealMobileTypeId && size > 0;        // Static = size > 0

// SKIP uniquement les living creatures (size=0)
if (isLivingCreature) {
    return; // Gere par MobsHandler
}

// ALLOW static drops (size>0) - utilise MobsDatabase pour le bon type
if (isStaticDrop && window.mobsDatabase?.isLoaded) {
    const resourceInfo = window.mobsDatabase.getResourceInfo(mobileTypeId);
    stringType = resourceInfo?.type || this.GetStringType(type);
}
```

#### Flux corrige - Living vs Static Drop

```
[Event 40 avec mobileTypeId reel]
    |
    +--→ size === 0 ? → LIVING CREATURE → Skip (MobsHandler gere)
    |
    +--→ size > 0 ?  → STATIC DROP → Ajouter a harvestableList ✅
                          |
                          +--→ Utilise MobsDatabase pour type correct (Fiber, pas Hide)
```

```
[Event 71/123 NewMob] (creatures vivantes)
    |
    v
[MobsHandler.AddEnemy()]
    |
    +--→ MobsDatabase.getMobInfo(typeId) → type = "Fiber"
    v
[MobsDrawing.draw()]
    |
    +--→ imageName = "fiber_5_0"
    v
[DrawCustomImage] → charge fiber_5_0.webp ✅
```

### Serveur Go capture partielle
- **Observe**: Serveur capture events 1, 3 (CommandType 6 Reliable)
- **Mais**: Client recoit aussi 38, 39, 40, 46, 59, 61 via batching
- **CommandType 7 (Unreliable)**: 1431 captures dans derniere session
- **Conclusion**: Les events passent bien, le debug log est fonctionnel

---

## INVESTIGATION: Architecture Serveur/WebSocket

### Flux des Events - De la capture au client

```
[Albion Game]
    |
    | UDP port 5056 (Photon protocol)
    v
[pcap.go: Capturer.processPacket()]
    |
    | Callback: onPacket(payload)
    v
[main.go: handlePacket(payload)]
    |
    | photon.ParsePacket(payload)
    v
[packet.go: ParsePacket()]
    |
    | Pour chaque command dans packet.Commands
    v
[main.go: processCommand(cmd)]
    |
    | switch cmd.MessageType
    | - MessageTypeEvent (4) -> DeserializeEvent -> BroadcastEvent
    | - MessageTypeRequest (2) -> DeserializeRequest -> BroadcastRequest
    | - MessageTypeResponse (3) -> DeserializeResponse -> BroadcastResponse
    v
[websocket.go: BroadcastEvent()]
    |
    | broadcastPayload("event", {code, parameters})
    | -> Ajoute au batchBuffer
    v
[websocket.go: flushBatch()] (toutes les 16ms)
    |
    | WSBatchMessage{type: "batch", messages: [...]}
    | json.Marshal -> WriteMessage
    v
[Client WebSocket]
    |
    | WebSocketEventQueue.js: processBatchMessage()
    v
[Utils.js: onEvent(Parameters)]
```

### Observations critiques (session_2025-12-15T00-23-30)

| Metric | Serveur capture (EVENT_CAPTURE) | Client recoit (CLIENT logs) |
|--------|--------------------------------|----------------------------|
| Event 3 (Move) | 1094 | 2146 (x2 car PACKET_RAW + EVENT_DETAIL) |
| Event 1 (Leave) | 446 | 172 |
| Event 46 | **0** | **34** |
| Event 59 | **0** | **70** |
| Event 61 | **0** | **52** |
| Event 39 | **0** | **36** |

### ANOMALIE MAJEURE

Le serveur Go log via `app.logger.Debug("EVENT_CAPTURE", ...)` UNIQUEMENT events 1 et 3.
Pourtant le client recoit events 46, 59, 61, 39, etc.

**Hypotheses:**

1. **CommandType filtering?**
   - Events 1, 3 = CommandTypeReliable (6)?
   - Events 46, 59, 61 = CommandTypeUnreliable (7)?
   - Le parsing pourrait echouer silencieusement pour certains types

2. **MessageType != 4?**
   - Les events harvest pourraient avoir un MessageType different
   - Le switch dans processCommand ne les traite pas

3. **Erreur de deserialization?**
   - DeserializeEvent echoue silencieusement (if err != nil n'est pas logge)
   - L'event existe mais n'est pas broadcaste

4. **Autre source de donnees?**
   - Le client a-t-il une autre source que le WebSocket?
   - Cache local? Service worker?

### Fichiers cles a investiguer

1. `internal/photon/command.go` - CommandType handling (ligne 83-99)
2. `internal/photon/protocol16.go` - DeserializeEvent implementation
3. `cmd/radar/main.go` - processCommand (ligne 318-348)

### Actions de debug recommandees

1. [ ] Logger TOUS les CommandTypes dans handlePacket AVANT le switch
2. [ ] Logger les erreurs de DeserializeEvent (actuellement silencieuses)
3. [ ] Compter combien de commands ont MessageType=4 vs autres
4. [ ] Verifier si events 46/59/61 arrivent avec un CommandType different

## Symptomes
1. Quand on tue un living resource (animal), le drop statique n'apparait pas sur le radar
2. Quand on recolte des ressources, le compteur ne decremente pas
3. Les ressources ne disparaissent pas a la fin de la recolte

## CERTITUDES A 100% - Ne plus re-verifier

### 1. Le serveur Go capture bien les events
- **VERIFIE** : Les logs session montrent events 38, 39, 40, 46, 59, 61 dans les logs client
- Session `session_2025-12-14T23-54-43.jsonl` : 24 events 46/59/61 captures, 198 events spawn
- **Preuve** : `"eventCode":46` apparait dans les logs avec `"252":46` dans parameters

### 2. Le format du serveur actuel est DIFFERENT de v2.0.0
- **v2.0.0** : `{ code: "event", dictionary: '{"code":46,"parameters":{...}}' }` (STRING JSON)
- **Actuel** : `{ code: "event", dictionary: { code: 46, parameters: {...} } }` (OBJET)
- **v2.0.0** : Pas de batching, envoi immediat individuel
- **Actuel** : Batching toutes les 16ms avec `{ type: "batch", messages: [...] }`

### 3. Le protocole Photon inclut nativement les codes dans parameters
- **252** dans parameters = event code (pour tous les events)
- **253** dans parameters = operation code (pour request/response)
- Le serveur Go ne les ajoute PAS - ils viennent du protocole Photon

### 4. WebSocketEventQueue.js a ete modifie
- Modifs faites pour gerer le nouveau format (dict vs string)
- `parseMessage()` : retourne maintenant `{ code: msg.code, params: dict }` au lieu de `dict.parameters`
- `queueEventInternal()` : utilise `dict.code` pour eventCode et `dict.parameters` pour les params

### 5. HarvestablesHandler.js - correction du size
- **Bug trouve** : `if (newSize > harvestable.size)` -> ne decrementait jamais
- **Corrige** : `if (newSize !== harvestable.size)`

## BUG TROUVE - CAUSE RACINE

### Event 46 - Majorite des events NON CAPTURES !
- **v2.0.0** : 16 events 46 total, dont 13 avec param[1] (size updates)
- **Actuel** : 2 events 46 total, dont 0 avec param[1] (seulement "derniers stacks")

Les events 46 "normaux" (ceux qui decrementent le size) ne sont PAS captures par le serveur ou perdus en route !

### Events 46 sans param[1] = "dernier stack"
- C'est NORMAL que certains events 46 n'aient pas param[1]
- Ca arrive quand la ressource est epuisee (dernier stack)
- Le handler fait `if (newSize === undefined) return;` - comportement correct

### Le VRAI probleme
Les events 46 avec param[1] (size updates pendant la recolte) ne sont JAMAIS recus !
- v2.0.0 : 13/16 events avaient param[1]
- Actuel : 0/2 events ont param[1]

### Hypotheses
1. **Serveur Go ne capture pas** - Peut-etre un probleme dans la capture Photon ?
2. **Batching perd des events** - Le ticker 16ms rate certains events ?
3. **Coalescing trop agressif** - Event 46 coalescé avec lui-meme et seul le dernier (sans param[1]) survit ?

### SUSPECT PRINCIPAL : COALESCING !
Dans WebSocketEventQueue.js, si event 46 est coalescé par entityId, seul le DERNIER event survit.
Si plusieurs events 46 arrivent en <16ms, seul le dernier est traité - qui est souvent celui sans param[1] !

## FICHIERS MODIFIES DEPUIS v2.0.0

### internal/server/websocket.go
- Ajout batching (16ms)
- Format dictionary change de STRING a OBJET

### web/scripts/Utils/WebSocketEventQueue.js (NOUVEAU FICHIER)
- Introduit apres v2.0.0
- Gere coalescing et throttling des events
- **Suspect principal** pour la regression

### web/scripts/Handlers/HarvestablesHandler.js
- **BUG TOUJOURS PRESENT** : `newSize > harvestable.size` - ne decremente JAMAIS lors de la recolte !
- La correction `newSize !== harvestable.size` n'a JAMAIS ete appliquee !

## PROCHAINES ETAPES

1. [x] Ajouter log serveur Go pour events 46/59/61 avec hasParam1 - **FAIT**
2. [ ] Recompiler et tester - verifier si serveur capture events 46 avec param[1]
3. [ ] Si serveur capture bien param[1], le probleme est dans la transmission/parsing client
4. [ ] Si serveur ne capture pas param[1], le probleme est dans la capture Photon

## MODIFICATIONS EN COURS

### cmd/radar/main.go (DEBUG)
Ajout de log pour events 46/59/61 :
```go
if event.Code == 46 || event.Code == 59 || event.Code == 61 {
    hasParam1 := false
    if _, ok := event.Parameters[1]; ok {
        hasParam1 = true
    }
    logger.PrintInfo("DEBUG", "Event %d captured (hasParam1=%v, params=%d)", event.Code, hasParam1, len(event.Parameters))
}
```

### web/scripts/Utils/WebSocketEventQueue.js (CORRIGE)
- parseMessage retourne `{ code: msg.code, params: dict }` au lieu de `dict.parameters`
- queueEventInternal utilise `dict.code` et `dict.parameters`

## LOGS DE REFERENCE

### Session v2.0.0 (fonctionne)
`session_2025-12-14T14-57-28.jsonl`

### Session actuelle (bug)
`session_2025-12-14T23-54-43.jsonl`

## DIFF CRITIQUE - WebSocketEventQueue.js

```javascript
// AVANT (bug)
parseMessage(msg) {
    const dict = typeof msg.dictionary === 'string' ? JSON.parse(msg.dictionary) : msg.dictionary;
    return { code: msg.code, params: dict.parameters };  // Passait dict.parameters directement
}

queueEventInternal(messageType, params) {
    const eventCode = params[252];  // 252 n'est pas dans params car c'etait dict.parameters
}

// APRES (corrige)
parseMessage(msg) {
    const dict = typeof msg.dictionary === 'string' ? JSON.parse(msg.dictionary) : msg.dictionary;
    return { code: msg.code, params: dict };  // Passe tout le dict
}

queueEventInternal(messageType, dict) {
    const eventCode = dict.code;  // Utilise dict.code
    const parameters = dict.parameters;  // parameters contient 252 nativement
}
```