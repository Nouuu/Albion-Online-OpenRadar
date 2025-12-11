# Plan de Refonte du Systeme de Detection des Ressources

**Date de creation:** 2025-12-02
**Derniere mise a jour:** 2025-12-11
**Statut:** Phase 5 COMPLETEE

---

## Resume des Phases

| Phase | Description | Statut | Commit |
|-------|-------------|--------|--------|
| 1 | HarvestablesDatabase | Done | `c34023e1` |
| 2 | Suppression Cache Legacy | Done | `b1498a0a` |
| 3 | Fix Bug T6+ (override typeNumber) | Done | - |
| 3B | Fix Bugs Living Resources (params[33]) | Done | - |
| 4 | Utilisation Database + Fix isLiving | Done | - |
| 5 | MobsDatabase (OFFSET=15) | Done | - |

---

## Architecture Finale (Post-Phase 5)

### Flux de Detection - Ressources Statiques

```
Events Reseau (Photon)
  Event 38: NewSimpleHarvestableObjectList (batch spawn)
  Event 40: NewHarvestableObject (individual spawn)
  Event 46: HarvestableChangeState (update)
                    |
                    v
HarvestablesHandler.js
  - Parse les parametres (type, tier, enchant, mobileTypeId)
  - Determine isLiving base sur mobileTypeId
  - Valide via HarvestablesDatabase
  - Filtre via settings (Static/Living x Type x Tier x Enchant)
                    |
                    v
HarvestablesDatabase.js
  - Charge harvestables.json (5 types, 190 combinaisons)
  - Valide les combinaisons type/tier/enchant
  - Fournit getResourceTypeFromTypeNumber()
```

### Flux de Detection - Ressources Vivantes (Living)

```
Events Reseau (Photon)
  Event 1: NewMobEvent (animal/creature spawn)
                    |
                    v
MobsHandler.js
  - Parse TypeID depuis parameters[1]
  - Lookup dans MobsDatabase via getMobInfo(typeId)
  - Determine type (Hide/Fiber/etc) et tier depuis mobs.json
  - Filtre via settings
                    |
                    v
MobsDatabase.js
  - Charge mobs.json au demarrage (4528 mobs)
  - OFFSET = 15 (TypeID_serveur = Index + 15)
  - Parse Loot.Harvestable pour identifier les ressources
  - ~2800 harvestables identifies automatiquement
```

### Fichiers du Systeme

| Fichier | Role |
|---------|------|
| `scripts/Data/HarvestablesDatabase.js` | Parse harvestables.json, validation ressources statiques |
| `scripts/Data/MobsDatabase.js` | Parse mobs.json avec OFFSET=15, identification ressources vivantes |
| `scripts/Handlers/HarvestablesHandler.js` | Detection ressources statiques |
| `scripts/Handlers/MobsHandler.js` | Detection ressources vivantes (animaux, critters) |
| `public/ao-bin-dumps/harvestables.json` | Source de donnees statiques |
| `public/ao-bin-dumps/mobs.json` | Source de donnees mobs |

---

## Phase 5 - MobsDatabase (COMPLETEE)

### Decouverte Cle

**`TypeID_serveur = Index_mobs.json + 15`**

Cette formule est utilisee par tous les radars de reference (DeathEye, AO-Radar).

| TypeID serveur | Index (-15) | Mob trouve | Tier |
|---------------|-------------|------------|------|
| 421 | 406 | T1_MOB_HIDE_SWAMP_TOAD | T1 Hide |
| 425 | 410 | T4_MOB_HIDE_SWAMP_MONITORLIZARD | T4 Hide |
| 429 | 414 | T5_MOB_HIDE_STEPPE_TERRORBIRD | T5 Hide |

**Reference DeathEye C#** : `TypeId = Convert.ToInt32(parameters[1]) - 15;`

### Implementation

```javascript
// MobsDatabase.js
class MobsDatabase {
    static OFFSET = 15;

    _parseMobs(mobsArray) {
        mobsArray.forEach((mob, index) => {
            const typeId = index + MobsDatabase.OFFSET;
            // ...
        });
    }

    getMobInfo(typeId) {
        return this.mobsById.get(typeId) || null;
    }
}
```

### Detection du Type de Ressource

La methode `_normalizeResourceType()` analyse le UniqueName pour identifier le type:

```javascript
_normalizeResourceType(uniqueName) {
    const name = uniqueName.toUpperCase();

    // Hide: animals (HIDE, WOLF, BEAR, etc.) + hide guardians
    if (name.includes('_HIDE_') || name.startsWith('HIDE_GUARDIAN'))
        return 'Hide';

    // Fiber: fiber critters + fiber guardians
    if (name.startsWith('FIBER_CRITTER') || name.startsWith('FIBER_GUARDIAN'))
        return 'Fiber';

    // Wood: wood critters + wood guardians
    if (name.startsWith('WOOD_CRITTER') || name.startsWith('WOOD_GUARDIAN'))
        return 'Log';

    // etc.
}
```

### Statistiques

- **Total mobs dans mobs.json**: ~4528
- **Harvestables identifies**: ~2800+
- **Types supportes**: Hide, Fiber, Log, Rock, Ore

### Tests Valides (2025-12-11)

| Observe | Type | Tier | Status |
|---------|------|------|--------|
| Living Hide | T4e0, T4e1, T5e1, T5e2, T5e3, T6e0 | OK |
| Living Fiber | T4e0, T5e0, T5e1, T6e0 | OK |

---

## Code Legacy Supprime

### MobsInfo.js - SUPPRIME

Fichier entierement supprime. Les 235 TypeIDs hardcodes sont remplaces par le parsing automatique de mobs.json (2800+ mobs).

### MobsHandler.js - Nettoye

```javascript
// SUPPRIME:
this.mobinfo = {};
updateMobInfo(newData) { ... }
updateMobInfoEntry(typeId, entry) { ... }
getMobInfo(typeId) { ... }

// Fallback legacy supprime dans:
registerStaticResourceTypeID()
AddEnemy()
```

### Utils.js - Nettoye

```javascript
// SUPPRIME:
import {MobsInfo} from "../Handlers/MobsInfo.js";
var mobsInfo = new MobsInfo();
mobsInfo.initMobs();
mobsHandler.updateMobInfo(mobsInfo.moblist);
```

---

## Debugging Guide

### Verifier MobsDatabase

```javascript
// Console browser
window.mobsDatabase.stats
// { totalMobs: 4528, harvestables: 2800+, ... }

// Test un TypeID specifique
window.mobsDatabase.getMobInfo(425)
// { typeId: 425, uniqueName: "T4_MOB_HIDE_SWAMP_...", type: "Hide", tier: 4, ... }
```

### Verifier HarvestablesDatabase

```javascript
window.harvestablesDatabase
// { isLoaded: true, stats: { typesLoaded: 5, combinationsLoaded: 190 } }

window.harvestablesDatabase.isValidResource('WOOD', 4, 1)
// true
```

### Analyser les Detections

```javascript
// Living resources detectees
window.logger.logs.filter(l =>
    l.event === 'MobsDatabaseMatch'
);

// TypeIDs inconnus (pas dans mobs.json)
window.logger.logs.filter(l =>
    l.event === 'UnknownMob_NoFallback'
);
```

---

## Comparaison Avant/Apres

| Aspect | Avant (MobsInfo.js) | Apres (MobsDatabase) |
|--------|---------------------|----------------------|
| TypeIDs supportes | 235 hardcodes | 2800+ auto-parses |
| Maintenance | Manuelle | Automatique via `update-ao-data.ts` |
| T6+ resources | Partiellement manquants | Tous supportes |
| Source de verite | Code legacy | mobs.json officiel |

---

## Etat du Systeme (Dec 2025)

### Ce Qui Fonctionne

| Fonctionnalite | Status |
|----------------|--------|
| Ressources T1-T8 statiques | OK |
| Ressources T1-T8 vivantes | OK |
| Enchantements .0-.4 | OK |
| HarvestablesDatabase | OK |
| MobsDatabase | OK |
| Tous les types (Wood, Rock, Fiber, Hide, Ore) | OK |

### Databases Utilisees

| Systeme | Database | Legacy Code |
|---------|----------|-------------|
| Items | OK | Aucun |
| Spells | OK | Aucun |
| Harvestables | OK | Aucun |
| Mobs | OK | Aucun (MobsInfo.js supprime) |

---

**Fin du document**