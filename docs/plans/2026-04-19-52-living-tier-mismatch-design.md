# #52 Living resource tier mismatch design

**Date** : 2026-04-19
**Issue** : [#52](https://github.com/Nouuu/Albion-Online-OpenRadar/issues/52)
**Branche** : `feat/52-living-tier-mismatch`
**Scope** : strict #52. Les follow-ups de capture-70 (WISP-1, FISHPOOL, DUNGEON-filter, NewMistsWispSpawn routing, OPS-1..4) restent en file pour des branches séparées.

---

## Goal

Faire en sorte que le tier affiché sur le radar pour une ressource vivante (critter Fiber, mob Hide) corresponde exactement au tier affiché par le tooltip du jeu.

## Context

Post PR #70 (single source of truth EventCodes/OperationCodes), capture-70.pcap prise en Falsestep Marsh (T5) et Wispwhisper Marsh (T6) + The Mists. Screenshots annotés par l'utilisateur exposent des écarts radar/jeu systématiques sur les living resources :

| mobId | Template (DB.u) | DB.t | Radar | Jeu (tooltip) |
|-------|-----------------|------|-------|---------------|
| 373 | `T5_MOB_HIDE_MISTS_OWL` | 5 | T5.1 | T4.1 |
| 374 | `T6_MOB_HIDE_MISTS_HOUND` | 6 | T6 | T5 |
| 529 | `T4_MOB_CRITTER_FIBER_SWAMP_GREEN` | 4 | T4 | T3 |
| 531 | `T5_MOB_CRITTER_FIBER_SWAMP_RED` | 5 | T5 | T4 |

Les harvestables statiques (`T*_MOB_DYNAMIC_*`) ne présentent aucun mismatch.

## Investigation findings (capture-70 pcap analysis)

**1. Le serveur envoie le vrai tier dans event 40 `Parameters[7]`.**
Dump via `tools/photon-dump` sur capture-70.anon.pcap, NewHarvestableObject (event 40), 25 samples :

| mobId | Server `Parameters[7]` | DB.t | Delta |
|-------|------------------------|------|-------|
| 422 `T2_MOB_HIDE_SWAMP_SNAKE` | **1** | 2 | -1 |
| 423 `T3_MOB_HIDE_SWAMP_GIANTTOAD` | **2** | 3 | -1 |
| 528 `T3_MOB_CRITTER_FIBER_SWAMP_RED` | 3 | 3 | 0 |
| 529 `T4_MOB_CRITTER_FIBER_SWAMP_GREEN` | **3** | 4 | -1 |
| 531 `T5_MOB_CRITTER_FIBER_SWAMP_RED` | **4** | 5 | -1 |
| 424 `T3_MOB_DYNAMIC_HIDE_SWAMP_GIANTTOAD` | 3 | 3 | 0 |
| 426 `T4_MOB_DYNAMIC_HIDE_SWAMP_MONITORLIZARD` | 4 | 4 | 0 |

Les mismatches coincident avec les templates non-DYNAMIC (i.e. living). Mais le chemin de dispatch event 40 → HarvestablesHandler passe `tier = Parameters[7]`, donc pour les static cette branche fonctionne correctement.

**2. Le bug vit dans `MobsHandler.AddEnemy`**, `web/scripts/handlers/MobsHandler.js:188` :
```js
mob.tier = dbInfo.tier || 0;  // lit le template tier, pas le serveur
```

Les living resources (critter, hide) spawn via event 123 (NewMob) → `MobsHandler.NewMobEvent` → `AddEnemy`. MobsHandler lit le tier depuis la DB et ignore tout paramètre serveur. D'où radar = template tier, jeu = current tier.

**3. La DB upstream (ao-data/ao-bin-dumps) est correcte pour ce qu'elle représente.**
Fetch raw `mobs.json` upstream via curl, inspection des attributs XML pour les mobs problématiques :
- `T5_MOB_HIDE_MISTS_OWL` : `@tier="5"` et `Loot.Harvestable.@tier="5"`.
- `T5_MOB_CRITTER_FIBER_SWAMP_RED` : idem.

Le template dit T5. Le game-tooltip dit T4. Donc le "tier courant" d'une instance spawnée est distinct du "tier template" et n'existe pas dans mobs.json. Le serveur le dérive probablement de la zone de spawn ou d'un paramètre d'instance.

**4. Recherche en cours : quel `Parameters[X]` de event 123 porte le tier courant.**
Premier scan des 20 samples `mobs/spawn` extraits par photon-dump :
- mobId 423 (T3 server/DB-coherent) : `Parameters[21] = 3`.
- mobId 422 (T2 mismatch) : `Parameters[21] = undefined`.
- mobId 2353 (`T6_MOB_GUARD_TOWER_OUTLAND`, hostile guard, pas living) : `Parameters[21] = 2`.

Pattern incohérent. `Parameters[21]` n'est pas le tier. Besoin d'étendre la capture pour inclure les mobIds problématiques (373, 529, 531) que le sample limité n'a pas saisis.

## Approche retenue : A (research-then-fix)

Trois phases, chacune avec RED-GREEN et commit dédié.

### Phase 1. Expand capture + identify tier parameter

**Files** :
- Modify `tools/photon-dump/scenarios.go` : augmenter `Limit` sur `mobs/spawn` (20 → 100). Facultativement ajouter une scenario `mobs/spawn-living-resources` filtrée sur mobileTypeId >= ~400 pour prioriser les critter/hide mobs.
- Rerun `go run ./tools/photon-dump -in capture-70.anon.pcap -out-go /tmp/... -out-js /tmp/...`.
- Analyse manuelle (script node ad-hoc) : pour chaque mismatch connu, inspecter toutes les clés de `Parameters` du NewMob event, chercher la valeur qui matche le game tier affiché (T4 pour 373, T5 pour 374, T3 pour 529, T4 pour 531).

**Livrable** : un tableau documenté dans ce design doc listant, pour chaque mismatch, `Parameters[X]` identifié comme porteur du tier courant.

**Fallback** : si aucun paramètre ne porte le tier courant (le serveur compte sur le client pour déduire de la zone), basculer sur Approche C (cross-event correlation), re-evaluer le design.

### Phase 2. Characterization test (RED) + fixture

**Files** :
- Create `web/scripts/__fixtures__/ws/mobs/living-resource-tier-mismatch.json` : WS-level JSON du NewMob event pour un mobId mismatch (e.g. 531), généré via photon-dump avec filtrage manuel.
- Create `internal/photon/testdata/mobs/living-resource-tier-mismatch.pcap` : fragment pcap correspondant.
- Modify `web/scripts/handlers/MobsHandler.test.js` : ajouter
  - 1 `@characterization 2026-04-19` pinnant le comportement actuel (mob.tier = dbInfo.tier pour mobId 531 = 5).
  - 1 `test.fails` pinnant le comportement attendu (mob.tier = 4 pour mobId 531 selon le serveur). Cross-link l'entrée "TIER-1" dans `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md`.

**Livrable** : test.fails rouge (pas encore rouge-vert : le bug existe encore).

### Phase 3. Fix + GREEN

**Files** :
- Modify `web/scripts/core/EventRouter.js` : dans le case `NewMob` (event 123), extraire `Parameters[X]` (X identifié Phase 1) et le passer comme argument à `MobsHandler.NewMobEvent`.
- Modify `web/scripts/handlers/MobsHandler.js` : `NewMobEvent` reçoit le tier serveur, le passe à `AddEnemy`. `AddEnemy` utilise le tier serveur en priorité ; fallback sur `dbInfo.tier` si undefined.
- Modify `web/scripts/handlers/MobsHandler.test.js` : flip `test.fails` → `test()` avec `@verified 2026-04-19`.

**Livrable** : suite vitest verte, comportement radar = game tier vérifié par fixture.

### Phase 4. Register + live smoke

**Files** :
- Modify `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md` : fermer l'entrée TIER-1, ajouter une décision log entry.
- Modify `web/scripts/handlers/MobsHandler.test.js` : couvrir au moins 2 variantes supplémentaires (Fiber + Hide, tier différent) pour satisfaire la Rule « push coverage by variant ».

**Live smoke** : lancer le radar en jeu, se placer dans une zone connue avec mobId mismatch (Falsestep Marsh T5 → fiber red 531 → game T4), vérifier que le radar affiche T4. Capturer un screenshot de comparaison si possible.

## Testing strategy

- **RED-GREEN strict** Phase 2 → 3.
- **pcap-derived fixtures** obligatoires (Rule 10). Pas de mock MobsDatabase.
- **Coverage par variant** : Fiber + Hide, minimum 2 mobIds couverts (un par type).
- **Go tests** : aucun changement Go attendu, le parser est correct. Vérifier `go test ./internal/photon/...` reste vert.

## Risks et inconnues

1. **Server peut ne pas envoyer le tier en event 123.** Si Phase 1 échoue, bascule sur Approche C (cross-event correlation event 40 vs event 123). Alternatif plus lourd, design à reviser.
2. **Pattern -1 pourrait être zone-dependent.** Si le delta n'est pas toujours -1 ou 0 mais varie selon la zone, le fix peut nécessiter de lire aussi un `zoneTier` du NewMob event. À détecter en Phase 1.
3. **Mobs non-living impactés.** Les mobs hostiles (bosses, guards) affichent aussi un tier via `settingEnemiesTier`. Phase 1 doit confirmer que le fix ne les casse pas. Si `Parameters[X]` n'est pas présent pour les non-living, le fallback `dbInfo.tier` s'applique et ça reste cohérent.

## Success criteria

1. Vitest suite verte avec au minimum 2 mismatch variants couverts par fixture pcap-derived.
2. Live smoke : radar affiche le même tier que le game tooltip pour au moins un mobId de la liste `{373, 374, 529, 531}`.
3. Aucune régression observable sur les harvestables statiques (fixtures existantes restent vertes).
4. Register `docs/plans/notes/...coverage.md` à jour avec décision log entry.

## Out of scope

- **WISP-1** (WispCageHandler index swap). Test.fails déjà pinned, one-liner, branche dédiée.
- **FISHPOOL** event 359 dispatch vs render. Branche dédiée.
- **DUNGEON-filter** solo/group vs hellgate. Branche dédiée.
- **NewMistsWispSpawn** event 523 routing. Branche dédiée (tied to #24 #69).
- **OPS-1..4** FIXME ops-drift investigation. Branche dédiée.
- **Refresh de la DB `mobs.min.json`.** La DB est correcte, pas besoin de la toucher.
