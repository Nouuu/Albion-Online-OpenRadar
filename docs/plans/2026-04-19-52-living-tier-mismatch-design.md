# #52 Living resource tier mismatch design

**Date** : 2026-04-19
**Issue** : [#52](https://github.com/Nouuu/Albion-Online-OpenRadar/issues/52)
**Branche** : `feat/52-living-tier-mismatch`
**Scope** : strict #52. Les follow-ups de capture-70 (WISP-1, FISHPOOL, DUNGEON-filter, NewMistsWispSpawn routing, OPS-1..4) restent en file pour des branches séparées.

---

## Goal

Faire en sorte que le tier affiché sur le radar pour une ressource vivante (critter Fiber, Hide, Wood, Rock, Ore) corresponde exactement au tier affiché par le tooltip du jeu et au tier de la ressource collectée une fois le mob mort.

## Context

Post PR #70 (single source of truth EventCodes/OperationCodes), capture-70.pcap prise en Falsestep Marsh (T5), Wispwhisper Marsh (T6) et The Mists. Screenshots annotés par l'utilisateur exposent des écarts radar/jeu systématiques sur les living resources :

| mobId | Template (DB.u) | DB.t | Radar | Jeu (tooltip) |
|-------|-----------------|------|-------|---------------|
| 373 | `T5_MOB_HIDE_MISTS_OWL` | 5 | T5.1 | T4.1 |
| 374 | `T6_MOB_HIDE_MISTS_HOUND` | 6 | T6 | T5 |
| 529 | `T4_MOB_CRITTER_FIBER_SWAMP_GREEN` | 4 | T4 | T3 |
| 531 | `T5_MOB_CRITTER_FIBER_SWAMP_RED` | 5 | T5 | T4 |

Les harvestables statiques (`T*_MOB_DYNAMIC_*`) ne présentent aucun mismatch.

Contrainte utilisateur (vérifiée empiriquement) : **tier affiché en tooltip sur le mob vivant = tier de la ressource récoltée une fois le mob mort**. Donc cibler la tier-tooltip, c'est cibler la tier-harvest, et les deux ont la même valeur dans event 40 `Parameters[7]`.

## Investigation findings (capture-70 pcap)

### 1. Pas de corrélation entityId entre event 40 et event 123

Event 40 (NewHarvestableObject) et event 123 (NewMob) créent des **entités séparées** pour les living resources. Dump capture-70 : 22 entités event 40 vs 166 entités event 123, **0 overlap** par `Parameters[0]`. Aucune correspondance instance-to-instance. Seul le template est partagé : `event40.Parameters[6] == event123.Parameters[1] == mobileTypeId`.

### 2. `MobsHandler.AddEnemy` lit la tier depuis la DB, pas depuis le serveur

Le bug vit à `web/scripts/handlers/MobsHandler.js:188` :
```js
mob.tier = dbInfo.tier || 0;
```

Les living resources spawn via event 123 (NewMob) → `MobsHandler.NewMobEvent` → `AddEnemy`. Aucun Parameter de event 123 (200 samples scannés) ne porte le tier observé. MobsHandler lit donc `dbInfo.tier` qui est **la combat tier du template**, pas la harvest tier.

### 3. Pourquoi `ao-bin-dumps` mob `@tier` est incorrect comme source de harvest tier

Upstream mobs.json (fetch direct sur `raw.githubusercontent.com/ao-data/ao-bin-dumps/master`) confirme `@tier=5` et `Loot.Harvestable.@tier=5` pour `T5_MOB_HIDE_MISTS_OWL`. Le tooltip jeu dit T4.

Interprétation : **`@tier` est la combat tier (HP, damage, fame, difficulté de combat)**, pas la harvest tier. Upstream dump cohérent à l'intérieur de lui-même (tier template = tier du droprate reference), mais ne capture pas la transformation runtime que le client d'Albion applique pour obtenir le tier affiché en tooltip sur un mob vivant. Seuls 18 mobs sur 4595 ont `@tier != Loot.Harvestable.@tier`, et aucun de nos mismatches n'en fait partie. Donc la divergence tooltip/template n'est pas exprimée dans les données upstream.

### 4. La règle harvest tier est dérivable depuis les données existantes

Observation sur 9 mobs avec evidence serveur directe (event 40 Parameters[7]) :

| mobId | uniquename | combat tier (db.t) | Loot.@type | Règle | Serveur |
|-------|------------|--------------------|--------------|--------|---------|
| 422 | T2_MOB_HIDE_SWAMP_SNAKE | 2 | HIDE (min=1) | max(1, 2-1) = 1 | 1 ✓ |
| 423 | T3_MOB_HIDE_SWAMP_GIANTTOAD | 3 | HIDE (min=1) | max(1, 3-1) = 2 | 2 ✓ |
| 424 | T3_MOB_DYNAMIC_HIDE_SWAMP_GIANTTOAD | 3 | HIDE | DYNAMIC → 3 | 3 ✓ |
| 426 | T4_MOB_DYNAMIC_HIDE_SWAMP_MONITORLIZARD | 4 | HIDE | DYNAMIC → 4 | 4 ✓ |
| 428 | T5_MOB_DYNAMIC_HIDE_SWAMP_GIANTSNAKE | 5 | HIDE | DYNAMIC → 5 | 5 ✓ |
| 528 | T3_MOB_CRITTER_FIBER_SWAMP_RED | 3 | FIBER_CRITTER (min=3) | max(3, 3-1) = 3 (floor) | 3 ✓ |
| 529 | T4_MOB_CRITTER_FIBER_SWAMP_GREEN | 4 | FIBER_CRITTER (min=3) | max(3, 4-1) = 3 | 3 ✓ |
| 531 | T5_MOB_CRITTER_FIBER_SWAMP_RED | 5 | FIBER_CRITTER (min=3) | max(3, 5-1) = 4 | 4 ✓ |
| 532 | T5_MOB_CRITTER_FIBER_SWAMP_DEAD | 5 | FIBER_CRITTER | DEAD → 5 | 5 ✓ |

**9/9 match.** Plus cohérent avec les screenshots user pour mobIds 373, 374 (règle prédit T4 et T5, user confirme tooltip T4 et T5).

**Règle** :
```
harvest_tier(db) =
  - db.t                                        si db.u matche /DYNAMIC|DEAD/
  - max(min_tier(db.l), db.t - 1)               sinon (living, non-dead)
  - db.t                                        si db.l absent (mob non-harvestable, on ne touche pas)
```

`min_tier(typeName)` vient de `harvestables.json` upstream : pour chaque `@name` (FIBER_CRITTER, HIDE, HIDE_CRITTER_ROADS, etc.), le tier minimum dans ses entrées `<Tier>`. Exemples : FIBER=2, HIDE=1, FIBER_CRITTER=3, HIDE_CRITTER_ROADS=4, ORE_CRITTER=3, WOOD_CRITTER=3, ROCK_CRITTER=3.

**Extrapolation sur les 74 mobs harvestables croisés dans capture-70** (dont 65 sans evidence serveur directe mais passés par NewMob event 123) : la règle produit une prédiction cohérente pour toutes les familles living (FIBER_CRITTER, HIDE, HIDE_CRITTER, HIDE_CRITTER_ROADS, FIBER_GUARDIAN non rencontré, WOOD_CRITTER, ROCK_CRITTER, ORE_CRITTER) + variantes DYNAMIC/DEAD. Validation additionnelle requise en Phase 4 (live smoke + éventuellement capture dans biome différent).

## Approche retenue : Y (règle dérivée)

Trois phases. La règle est data-driven, testable en pure fonction, indépendante de la capture runtime.

### Phase 1. Minifier : préserver le min-tier par harvestable type

**Files** :
- Modify `tools/update-ao-data.ts` : dans `minifyMobs`, garder `l` et `lt` inchangés. Ajouter un nouveau producer qui génère `web/ao-bin-dumps/harvestable-mintiers.json` depuis `harvestables.json` upstream : objet `{ [typeName]: minTier }` avec les ~60 entrées observées (FIBER, FIBER_DYNAMIC, FIBER_CRITTER, FIBER_CRITTER_ROADS, FIBER_GUARDIAN, HIDE, HIDE_DYNAMIC, HIDE_CRITTER, HIDE_CRITTER_ROADS, etc.).
- Run `make update-ao-data` to commit the new file (tiny : < 2 KB JSON).

**Livrable** : `harvestable-mintiers.json` committé, minifier régénère correctement.

### Phase 2. Helper de règle + test unitaire pure function

**Files** :
- Create `web/scripts/utils/LivingResourceTier.js` :
```js
import harvestableMinTiers from '../../ao-bin-dumps/harvestable-mintiers.json';

export function getLivingHarvestTier(mob) {
    if (!mob?.l) return mob?.t ?? 0;
    if (/DYNAMIC|DEAD/.test(mob.u)) return mob.t;
    const minT = harvestableMinTiers[mob.l] ?? 1;
    return Math.max(minT, mob.t - 1);
}
```
- Create `web/scripts/utils/LivingResourceTier.test.js` : table-driven test couvrant au minimum :
  - DYNAMIC hide T3 → 3
  - DYNAMIC hide T5 → 5
  - Living HIDE T2 → 1 (floor=1, 2-1=1)
  - Living HIDE T5 (owl) → 4
  - Living HIDE T6 (hound) → 5
  - Living FIBER_CRITTER T3 → 3 (floor engagement : max(3, 2) = 3)
  - Living FIBER_CRITTER T4 → 3
  - Living FIBER_CRITTER T5 → 4
  - DEAD fiber T5 → 5
  - DEAD fiber T6 → 6
  - Living HIDE_CRITTER_ROADS T5 → 4 (floor=4 : max(4, 4) = 4)
  - Living HIDE_CRITTER_ROADS T6 → 5
  - Living WOOD_CRITTER T4 → 3
  - Living ROCK_CRITTER T4 → 3
  - Living ORE_CRITTER T4 → 3
  - Mob sans Loot.Harvestable → combat tier (pas de shift)

**Livrable** : 15+ assertions vertes, pure function covered 100%.

### Phase 3. Integration dans MobsHandler + pcap fixture

**Files** :
- Modify `web/scripts/handlers/MobsHandler.js:186-200` :
```js
if (dbInfo && dbInfo.isHarvestable) {
    mob.tier = getLivingHarvestTier(dbInfo) || 0;
    // ... rest unchanged
}
```
Import depuis `../utils/LivingResourceTier.js`.
- Modify `web/scripts/handlers/MobsHandler.test.js` :
  - Ajouter fixture pcap-derived `web/scripts/__fixtures__/ws/mobs/living-tier-mismatch-531.json` (NewMob event pour mobId 531).
  - Test `@verified 2026-04-19: mob 531 T5 fiber critter RED rendered with harvest tier=4 (not combat tier=5)`.
  - Au moins 3 variantes supplémentaires (1 Hide Mists T5 → 4, 1 critter autre famille, 1 DEAD preservé).
- Create `internal/photon/testdata/mobs/living-tier.pcap` : fragment pcap correspondant. Optionnel si le JSON WS suffit pour vitest.

**Livrable** : MobsHandler.test.js vert avec 4 living tier variants couverts.

### Phase 4. Live smoke + register

**Files** :
- Modify `docs/plans/notes/2026-04-18-handlers-characterization-coverage.md` : ajouter entry TIER-1 dans la register, marquer comme fermée dans la même PR. Décision log : rule Y dérivée, validée 9/9 sur evidence directe + extrapolée 74 mobs.

**Live smoke** (utilisateur, en fin de PR) : lancer le radar, se rendre en Falsestep Marsh T5, vérifier que le radar affiche T4 pour les critters fiber RED (mobId 531). Vérifier aussi dans Mists que le radar affiche T4 pour les OWL et T5 pour les HOUND.

**Livrable** : PR mergable, validation humaine en jeu confirmée.

## Testing strategy

- **Pure function** : `LivingResourceTier.js` est isolée, sans dépendance runtime, entièrement table-testée.
- **Integration** : MobsHandler.test.js avec pcap-derived fixture pour au moins 4 variants (couvrant living hide, living critter fiber, critter DEAD, critter ROADS).
- **Pas de runtime cache, pas de cross-correlation**. La règle est déterministe depuis la DB.
- **Rule 10 compliance** : `test.fails` pour le comportement pré-fix (si utile de le capturer) ou directement `@verified` après fix. Pas de mock MobsDatabase.
- **Go tests** : aucun changement Go attendu, parser correct pour event 40.

## Risks et inconnues

1. **La règle pourrait avoir des exceptions sur des familles pas encore observées** (FIBER_GUARDIAN, BOSS mobs harvestables). Mitigation : Phase 4 live smoke vérifie les familles principales ; si un nouveau mismatch surgit, on ajoute un test et adapte la règle.
2. **Sandbox peut renommer des mobs ou changer la convention DYNAMIC/DEAD**. Mitigation : les tests live smoke + CI Vitest détectent la régression au prochain upstream refresh.
3. **`harvestables.json` upstream peut changer de structure** (nouveaux champs, variantes). Mitigation : re-génération via `tools/update-ao-data.ts` met à jour le `harvestable-mintiers.json` sans code changes.

## Success criteria

1. Vitest : `LivingResourceTier.test.js` couvre 15+ cas, tous verts. `MobsHandler.test.js` avec 4 living tier variants, tous verts.
2. Live smoke : tooltip jeu et radar affichent le même tier pour mobIds {373, 374, 531, 529} et au moins 1 DYNAMIC mob (sanity check).
3. Aucune régression sur les static harvestables (fixtures HarvestablesHandler.test.js existantes restent vertes).
4. Register entry TIER-1 fermée dans le même PR.
5. `harvestable-mintiers.json` committé, taille < 2 KB.

## Out of scope

- **WISP-1** (WispCageHandler index swap). Test.fails déjà pinned, one-liner, branche dédiée.
- **FISHPOOL** event 359 dispatch vs render. Branche dédiée.
- **DUNGEON-filter** solo/group vs hellgate. Branche dédiée.
- **NewMistsWispSpawn** event 523 routing. Branche dédiée (tied to #24 #69).
- **OPS-1..4** FIXME ops-drift investigation. Branche dédiée.
- **Refresh de `mobs.min.json`.** La DB est correcte pour ce qu'elle représente (combat tier), pas besoin de la toucher.
- **Runtime cross-correlation cache**. Rejeté en faveur de la règle dérivée : plus stable, testable, no runtime fragility.
