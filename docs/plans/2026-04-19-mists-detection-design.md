# Mists detection restoration design

**Date** : 2026-04-19
**Issues** : [#69](https://github.com/Nouuu/Albion-Online-OpenRadar/issues/69) (bug mists), [#24](https://github.com/Nouuu/Albion-Online-OpenRadar/issues/24) (feature Mist Detection), related closed duplicates #66, #31, #23
**Branche** : `feat/mists-detection`
**Scope** : restauration détection Mists complète côté radar, 3 facettes du cycle de vie in-game. Sub-projet distinct du scope dungeons.

---

## Goal

Restaurer la détection des Mists sur le radar. L'utilisateur doit voir :
1. Les feux follets (wisp-signs) dans le monde ouvert, avant ouverture du portail.
2. Les portails ouverts (`MISTS_SOLO_*`, `MISTS_DUO_*`, etc.) avec leur niveau de rareté.
3. Les wisp cages à l'intérieur des Mists zones.

## Context

Issue #69 : un utilisateur à proximité immédiate d'un mist constate zéro détection radar malgré tous les settings activés. Screenshots confirment settings Solo/Duo/E0-E4 tous cochés. Issue #66 reporte que seuls les mists E0 s'affichaient, avec une régression ensuite où rien ne s'affiche.

Captures pcap analysées :
- capture-52.pcap (18812 packets, session Mists court)
- capture-70.pcap (44767 packets, session Mists longue)

Repo externe `LaionFromNight/LaionEye` référencé dans issue #76 comme source alternative d'events. Ses valeurs d'event codes diffèrent des nôtres (518 vs 523 pour `NewMistsWispSpawn`). **Fork probablement pré-Protocol18**, à ne pas croire aveuglément. Notre PR #70 adoption de Triky313/StatisticsAnalysis est la source de vérité courante ; les deux events (518 ET 523) firent simultanément dans capture-52, donc ce sont deux events distincts et notre mapping 523 = NewMistsWispSpawn est correct.

## Investigation findings

### Fact 1 : Portail ouvert (Facette 1)

Dispatch actuel : NewMob event 123 avec `Parameters[32]` ou `[31]` contenant un nom `MISTS_SOLO_YELLOW` → `MobsHandler.NewMobEvent` → `AddMist` → `mistList.push`. Rendu : `MobsDrawing.invalidate` lignes 204-218.

Capture-52/70 : 38 spawns au total, tous `MISTS_SOLO_YELLOW`, aucune autre couleur observée dans notre corpus. `Parameters[33]=0` pour 37/38, une variance à 2.

Bug identifié : `MobsDrawing.js:207` :
```js
if (settingsSync.getBool("settingMistE" + mistsOne.enchant)) continue;
```
La condition est inversée : cocher `settingMistE0` skippe le mist au lieu de l'afficher. Avec les 5 checkboxes E0-E4 cochées par défaut dans l'UI et `mist.enchant=0` constant (rareté perdue lors du dispatch), 100% des mists sont skippés. Cohérent avec les symptômes de #66 puis #69.

Deuxième observation structurelle : la couleur dans le nom (`YELLOW` ici, mais `GREEN/BLUE/PURPLE/RED` existent en jeu) est totalement ignorée lors du dispatch. `mist.enchant = Parameters[33] = 0` partout. Le mapping couleur → index 0-4 nécessite des données multi-couleur qu'on n'a pas dans ce corpus. Reporté à MIST-2 en register.

### Fact 2 : Wisp cage (Facette 2)

WispCageHandler.newCageEvent lit `Parameters[1]` comme position et `Parameters[2]` comme nom, avec une gate `if (Parameters[4] !== undefined) return` qui rejette les events réels. Evidence pcap capture-70 (event 530 NewCagedObject, 13 occurrences) :
- `P[0]` = id
- `P[1]` = scalar int (pas position)
- `P[2]` = [x, y] position array
- `P[4]` = cage name string (toujours défini → gate actuelle rejette tout)
- `P[5]` = int

Bug pré-pinné dans `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md` comme entry WISP-1 avec `test.fails` dans `WispCageHandler.test.js`.

### Fact 3 : Feu follet (Facette 3)

Events 518, 519, 523 identifiés dans capture-52. Aucun routé par EventRouter.

Event 523 `NewMistsWispSpawn` (27 occurrences capture-52) :
- `P[0]` = id entité
- `P[1]` = [x, y] position
- `P[2]` = 90 (constant, orientation probable)
- `P[3]` = bool (présent ~50%)
- **Aucun champ rareté**

Event 518 (1 occurrence) + Event 519 (1 occurrence) partagent le même id entité (2577) : 518 = spawn, 519 = state change probable. Structures différentes de 523. Sens précis à investiguer en live session.

Côté gameplay : le tooltip in-game sur le feu follet affiche la rareté AVANT ouverture du portail. L'information existe donc côté serveur mais n'a pas été localisée dans notre corpus pcap. Fallback pour cette PR : marqueur générique sans rareté + settings debug ID overlay (comme `settingLivingResourcesID` pour les ressources vivantes) pour permettre de capturer les entités en live future session.

## Architecture

### Nouveaux composants (Facette 3)

| File | Responsibility |
|------|---------------|
| `web/scripts/handlers/MistsWispHandler.js` | Wisp class + MistsWispHandler (newWispEvent, removeWisp, cleanupStaleEntities, Clear) |
| `web/scripts/handlers/MistsWispHandler.test.js` | Tests unit + integration |
| `web/scripts/drawings/MistsWispDrawing.js` | invalidate rendering avec settings gate + debug ID overlay |
| `web/scripts/__fixtures__/ws/mists-wisp/spawn.json` | Fixture pcap-derived 27 events 523 from capture-52 |

### Composants modifiés

| File | Modification |
|------|--------------|
| `web/scripts/drawings/MobsDrawing.js:207` | Fix filtre enchant inversé (Facette 1) |
| `web/scripts/handlers/WispCageHandler.js` | Swap indices P[1]/[2]/[4], retirer gate inversée (Facette 2) |
| `web/scripts/handlers/WispCageHandler.test.js` | Flip `test.fails` WISP-1 → `@verified` |
| `web/scripts/core/EventRouter.js` | Case NewMistsWispSpawn → mistsWispHandler.newWispEvent |
| `web/scripts/core/EventRouter.test.js` | Test routage event 523 |
| `internal/templates/pages/chests.gohtml` | Checkboxes `settingWispSpawn`, `settingWispSpawnDebugID` |
| `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md` | Close WISP-1, open MIST-1 (rarité parsing reporté), open MIST-2 (rarité wisp reportée) |

### Pas de changement

- `web/scripts/utils/EventCodes.js` : valeur 523 déjà correcte post-PR #70
- `web/scripts/handlers/MobsHandler.js` : dispatch AddMist inchangé pour Facette 1 (seul le drawing filter change)
- `internal/photon/*` : aucun changement Go

## Data flow (cycle à vérifier pour chaque facette)

```
pcap event
 → EventRouter.onEvent (case EventCodes.X)
 → Handler.method(Parameters)
 → Handler internal state (Array.push ou Map.set)
 → Drawing.invalidate iterates state
 → Settings gate (getBool) passe ?
 → Image name resolved from state
 → DrawCustomImage(ctx, x, y, imageName, folder, size) called
 → Image asset exists (verifier via smoke in-game)
```

Chaque test doit vérifier jusqu'à DrawCustomImage, pas seulement jusqu'à handler state.

## Facette 1 : Portail ouvert regression

### Fix minimal (B2 inversion)

`web/scripts/drawings/MobsDrawing.js:207` :
```diff
-            if (settingsSync.getBool("settingMistE"+mistsOne.enchant))
-            {
-                continue;
-            }
+            if (!settingsSync.getBool("settingMistE"+mistsOne.enchant)) continue;
```

### Reportés (non fixés dans cette PR)

- **MIST-2** : rareté parsée depuis le nom `MISTS_*_<COLOR>` (YELLOW/GREEN/BLUE/PURPLE/RED → 0-4). Besoin de capture multi-couleur live. Le code actuel stocke `mist.enchant=0` partout, donc avec B2 fixé l'user verra tous les mists quand E0 est coché.

### Tests

- `MobsDrawing.test.js` (nouveau) : test que push mist + invalidate avec `settingMistE0=true` → `DrawCustomImage('mist_0', 'Resources', 21)` appelé
- Test inverse : `settingMistE0=false` → `DrawCustomImage` pas appelé
- Coverage : au moins 1 test par état de la gate

## Facette 2 : WISP-1 wisp cage indexing

### Fix minimal

`web/scripts/handlers/WispCageHandler.js` :
```diff
 newCageEvent(parameters) {
     if (settingsSync.getBool('settingCage')) return;
-    if (parameters[4] !== undefined) return;
     const id = parameters[0];
-    const name = parameters[2];
-    const position = parameters[1];
+    const position = parameters[2];
+    const name = parameters[4];
     if (id === undefined || position === undefined) return;
     // ... rest unchanged
 }
```

### Tests

Test.fails existant dans `WispCageHandler.test.js` devient GREEN après fix → flip à `@verified`. Ajouter 1 test intégration qui vérifie que `WispCageDrawing.DrawCustomImage` est appelé après push cage.

## Facette 3 : Routing feu follet

### Handler

`web/scripts/handlers/MistsWispHandler.js` :
```js
class Wisp {
    constructor(id, posX, posY, orientation, flag) {
        this.id = id;
        this.posX = posX;
        this.posY = posY;
        this.orientation = orientation;
        this.flag = flag;
        this.hX = 0;
        this.hY = 0;
        this.lastUpdateTime = Date.now();
    }
    touch() { this.lastUpdateTime = Date.now(); }
}

export class MistsWispHandler {
    constructor() {
        this.wispList = [];
    }
    
    newWispEvent(parameters) {
        const id = parameters[0];
        const position = parameters[1];
        if (id === undefined || position === undefined) return;
        const existing = this.wispList.find(w => w.id === id);
        if (existing) { existing.touch(); return; }
        this.wispList.push(new Wisp(id, position[0], position[1], parameters[2], parameters[3]));
    }
    
    removeWisp(id) {
        this.wispList = this.wispList.filter(w => w.id !== id);
    }
    
    Clear() { this.wispList = []; }
    
    cleanupStaleEntities(maxAgeMs = 120000) {
        const now = Date.now();
        const before = this.wispList.length;
        this.wispList = this.wispList.filter(w => (now - w.lastUpdateTime) < maxAgeMs);
        return before - this.wispList.length;
    }
}
```

### Drawing

`web/scripts/drawings/MistsWispDrawing.js` :
```js
import {DrawingUtils} from '../utils/DrawingUtils.js';
import settingsSync from '../utils/SettingsSync.js';

export class MistsWispDrawing extends DrawingUtils {
    interpolate(wisps, lpX, lpY, t) {
        for (const w of wisps) this.interpolateEntity(w, lpX, lpY, t);
    }
    
    invalidate(ctx, wisps) {
        if (!settingsSync.getBool('settingWispSpawn')) return;
        for (const w of wisps) {
            const p = this.transformPoint(w.hX, w.hY);
            this.DrawCustomImage(ctx, p.x, p.y, 'wisp_sign', 'Resources', 20);
            if (settingsSync.getBool('settingWispSpawnDebugID')) {
                this.drawText(p.x, p.y + this.getScaledSize(18), w.id.toString(), ctx);
            }
        }
    }
}
```

### EventRouter

```js
case EventCodes.NewMistsWispSpawn:
    mistsWispHandler.newWispEvent(Parameters);
    break;
```

### Settings UI

Ajouter dans `internal/templates/pages/chests.gohtml` section Mists :
```html
<input type="checkbox" id="settingWispSpawn" class="checkbox checkbox-primary checkbox-sm">
<label>Wisp signs (pre-portal)</label>

<input type="checkbox" id="settingWispSpawnDebugID" class="checkbox checkbox-primary checkbox-xs">
<label>Show wisp ID (debug)</label>
```

Bindable via `bindCheckbox` pattern existant.

### Image asset

Besoin de `wisp_sign.png` dans `/Resources/`. Si absent :
- Fallback temporaire sur `mist_0.png` dans le code drawing
- Ouvrir bug follow-up pour asset dédié

### Investigation future (live session)

Events 518/519 dans capture-52 partagent l'id 2577 (pair spawn+state-change). Trop peu d'échantillons pour comprendre la sémantique. Entry register MIST-3 pour capture live multi-wisp avec interactions.

## Testing strategy

- **RED-GREEN strict** pour chaque facette
- **pcap-derived fixtures** pour Facettes 1, 2, 3
- **Mock canvas** pour assertions DrawCustomImage (pattern à établir, nouveau pour ce projet)
- **Register discipline** : close WISP-1, open MIST-1/2/3 pour le reporté

## Risks

1. **Pas de rareté wisp/mist dans corpus** : fix Facette 1 affiche tous les mists mais comme E0 (rareté perdue). User devra cocher E0 seulement. Impact UX dégradé mais amélioration nette vs état actuel (rien).
2. **Asset `wisp_sign.png` peut-être absent** : fallback `mist_0.png` suffit pour débloquer user, bug follow-up pour asset propre.
3. **Events 518/519 semantics inconnue** : routage facultatif dans cette PR.
4. **Check cross-correlation avec WispCageHandler** : `settingCage` existe déjà pour les cages intérieures, ne pas confondre avec `settingWispSpawn` (wisp world-map).

## Success criteria

1. Vitest suite verte avec tests nouveaux pour les 3 facettes
2. Chaque facette a un test qui va jusqu'à `DrawCustomImage` assert
3. Register `handlers-characterization-coverage.md` à jour (WISP-1 closed, MIST-1/2/3 opened)
4. Live smoke utilisateur : feu follet détecté sur radar + portail ouvert YELLOW détecté avec E0 coché + wisp cage détectée dans Mists

## Out of scope

- Dungeons detection (Sub-projet 2 après)
- Map background tile rendering
- Fishpool (#25)
- Rarity parsing multi-couleur (MIST-2 en register, attend capture live)
- Rarity wisp-sign (MIST-3 en register, attend capture live)
- Assets graphiques nouveaux : si manquants, fallback temporaire + bug follow-up
