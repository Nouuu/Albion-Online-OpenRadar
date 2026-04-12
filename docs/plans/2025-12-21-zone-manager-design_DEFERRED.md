> **STATUS: DEFERRED**. Plan is valid but not a priority.
> Resume only after the stabilization phase has shipped (backend and frontend test suites in place).
> The current `window.currentMapId` code works. This refactor is an improvement, not a fix.
> Do not touch zone-related code until Photon fixtures and handler tests exist.
> Deferred on 2026-04-12.

---

# ZoneManager Design

## Contexte

La gestion des zones est actuellement dispersée :

- `EventRouter.js` : détecte les changements, debounce, stocke `window.currentMapId`
- `ZonesDatabase.js` : données statiques, méthodes utilitaires non utilisées
- `PlayersHandler.js` : accède à `window.currentMapId`, compare des strings
- `RadarRenderer.js` : refait `getZone()` à chaque render

Problèmes :

- `window.currentMapId` comme état global sans encapsulation
- Logique dupliquée (`pvpType === 'black'` partout)
- Méthodes utilitaires de ZonesDatabase ignorées
- Code mort (`map.isBZ` jamais lu)

## Solution

Créer `ZoneManager` pour centraliser la gestion de la zone courante.

## Responsabilités

### ZoneManager (nouveau)

- Stocke l'ID de zone courante + cache l'objet zone
- Gère le debounce (4s) des changements de zone
- Expose des méthodes spécifiques pour interroger l'état
- Appelle un callback au changement de zone

### ZonesDatabase (inchangé)

- Source de données statiques
- Méthodes pour requêtes sur une zone arbitraire

### EventRouter (simplifié)

- Détecte l'event 35 (changement de zone)
- Appelle `zoneManager.setCurrentZone(newMapId)`
- Plus de logique métier

## API

```javascript
class ZoneManager {
    // Init
    init({zonesDatabase, onZoneChange})

    // Appelé par EventRouter
    setCurrentZone(zoneId)  // gère debounce + appelle callback

    // Getters zone courante
    getCurrentZoneId()      // string
    getCurrentZone()        // objet complet { id, name, tier, pvpType, ... }
    getCurrentZoneName()    // string
    getCurrentZoneTier()    // number
    getCurrentPvpType()     // 'safe' | 'yellow' | 'red' | 'black'

    // Helpers booléens
    isCurrentZoneBlack()

    isCurrentZoneRed()

    isCurrentZoneYellow()

    isCurrentZoneSafe()

    isCurrentZoneDangerous()  // black ou red

    // Reset
    reset()
}

// Export singleton
export default zoneManager;
```

## Utilisation

### PlayersHandler.js

```javascript
// Avant
const pvpType = zonesDatabase.getPvpType(window.currentMapId);
if (pvpType === 'black') { ...
}

// Après
import zoneManager from '../core/ZoneManager.js';

if (zoneManager.isCurrentZoneBlack()) { ...
}
```

### RadarRenderer.js

```javascript
// Avant
const zone = zonesDatabase.getZone(this.map.id);
const zoneName = zone?.name || this.map.id;

// Après
import zoneManager from '../core/ZoneManager.js';

const zoneName = zoneManager.getCurrentZoneName();
```

### EventRouter.js

```javascript
// Avant (30+ lignes)
if (timeSinceLastChange < MAP_CHANGE_DEBOUNCE_MS) return;
map.id = newMapId;
window.currentMapId = map.id;
// ... etc

// Après (1 ligne)
zoneManager.setCurrentZone(newMapId);
```

## Suppressions

| Élément                  | Fichier                | Raison                    |
|--------------------------|------------------------|---------------------------|
| `window.currentMapId`    | EventRouter.js         | Remplacé par zoneManager  |
| `map.isBZ`               | Map.js, EventRouter.js | Code mort                 |
| `lastMapChangeTime`      | EventRouter.js         | Déplacé dans ZoneManager  |
| `MAP_CHANGE_DEBOUNCE_MS` | EventRouter.js         | Déplacé dans ZoneManager  |
| Logique sessionStorage   | EventRouter.js         | Déplacée dans ZoneManager |

## Fichiers à modifier

| Fichier                      | Action                         |
|------------------------------|--------------------------------|
| `core/ZoneManager.js`        | Créer                          |
| `core/EventRouter.js`        | Simplifier                     |
| `Utils/Map.js`               | Retirer `isBZ`                 |
| `Handlers/PlayersHandler.js` | Utiliser zoneManager           |
| `Utils/RadarRenderer.js`     | Utiliser zoneManager           |
| `Utils/Utils.js`             | Init zoneManager avec callback |

## Décisions prises

1. **ZoneManager vs enrichir ZonesDatabase** : ZoneManager séparé (données statiques vs état runtime)
2. **Événements vs interrogation** : Interrogation directe + callback unique pour le changement
3. **Callback pattern** : Un seul callback `onZoneChange` passé à l'init
4. **API** : Méthodes spécifiques (`isCurrentZoneBlack()`) plutôt qu'objet brut
5. **Export** : Singleton via export default (pas window.*)
6. **Emplacement** : `core/ZoneManager.js`
7. **isBZ** : Supprimé (code mort)
