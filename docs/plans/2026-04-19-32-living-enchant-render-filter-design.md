# #32 Living resource enchant filter at render time : design

**Date** : 2026-04-19 (amendment 2026-04-24)
**Issue** : [#32](https://github.com/Nouuu/Albion-Online-OpenRadar/issues/32) (also [#30](https://github.com/Nouuu/Albion-Online-OpenRadar/issues/30))
**Branche** : `feat/32-living-enchant-render-filter` (based on `feat/52-living-tier-mismatch` PR #77)
**Scope** : living resources render-time filter + DEAD carcass static routing + static resources render-time filter.
**Register entry** : HARV-2, HARV-3, HARV-4 (all closed by this PR)

---

## Amendment 2026-04-24 : expanded scope

Live smoke test on the original #32 fix revealed two additional defects sharing the same class: entities that are physically static on the map but were gated by the Living filter key.

1. **HARV-3 : dead critters filtered by living settings**. When a Fiber/Log/Ore/Rock critter dies, the server spawns a new `NewMob` with a `_DEAD` uniqueName (e.g. `T6_MOB_CRITTER_FIBER_SWAMP_DEAD`). These arrive in `mobsList` as `LivingHarvestable`/`LivingSkinnable` and were gated by `settingLiving{Family}Enchants`. User checked `settingStaticHideEnchants` T6 e0 on and living T6 e0 off, expected to see the corpse, saw nothing.

2. **HARV-4 : Hide carcass and batch-spawn harvestables lack render-time filter**. HarvestablesHandler spawn filter blocked static entities and the `shouldDisplayHarvestable` early-return for `isLiving=true` kept carcasses always visible (or always hidden) regardless of settings. User wanted the same instant toggle UX that #32 introduced for living mobs.

### Unified taxonomy (post-amendment)

Render-time routing rule:

| Source list | Discriminator | Filter |
|-------------|---------------|--------|
| `mobsList` type = LivingHarvestable/LivingSkinnable | `uniqueName` matches `/_DEAD$/` | **Static** |
| `mobsList` type = LivingHarvestable/LivingSkinnable | `uniqueName` does not match `_DEAD` | **Living** |
| `mobsList` other types (Enemy/Boss/Drone/…) | | unchanged |
| `harvestableList` (all entries, any `mobileTypeId`) | | **Static** |

Principle : "moving alive creature = Living filter ; static physical object on the map = Static filter". Corpses, batch-spawn sentinels, and Hide carcasses all belong to the second bucket.

### Architecture changes on top of the original design

- `LivingResourceFilter.js` now exports both `shouldRenderLivingResource` and `shouldRenderStaticResource`. Shared resolver `resolveSettingsCell` keeps the two paths DRY.
- `MobsHandler.AddEnemy` propagates `dbInfo.uniqueName` onto `mob.uniqueName` (initialized to `null` on the `Mob` constructor). Enables render-time detection without a second DB lookup.
- `MobsDrawing.invalidate` picks `shouldRenderStaticResource` when `mob.uniqueName` matches `/_DEAD$/`, otherwise `shouldRenderLivingResource`.
- `HarvestablesHandler.addHarvestable` and `UpdateHarvestable` drop the `shouldDisplayHarvestable` call entirely; the helper and the `getResourceStorageKey`/`settingsSync` imports are removed.
- `HarvestablesDrawing.invalidate` always applies `shouldRenderStaticResource`. The `isLiving` branch is gone.

### Success criteria (amended)

Original success criteria remain. Add:

- Live smoke on the user's scenario: unchecking `settingLivingHideEnchants.e0` while `settingStaticHideEnchants.e0` stays on must render the corpse after kill.
- Instant toggle: check/uncheck any static settings checkbox and entities appear/disappear within one render frame (no spawn re-detection required).

---

## Goal

Permettre aux utilisateurs de décocher `settingLiving{Family}Enchants.e0` pour une famille donnée (Fiber, Hide, Log, Ore, Rock) tout en voyant correctement les ressources vivantes avec enchants supérieurs (e1-e4) sur le radar.

## Context

Post PR #77 (tier mismatch fix), live test user a confirmé que le bug structurel HARV-2 (pré-#52, tracké dans register + ancien design doc `2026-01-15-living-harvestables-fix-design.md`) est réel et reste bloquant. Issue #32 explicite : *"Living harvestable resources are only shown on the radar when the base enchantment (e0) is enabled, even if higher enchantments (e1-e4) are enabled in the settings."* Body de l'issue note : *"Logs show that many resources initially spawn with charges = 0 and receive their real enchantment later."*

## Root cause (confirmé par lecture de code)

Deux handlers, même anti-pattern :

**`HarvestablesHandler.UpdateHarvestable`** (`web/scripts/handlers/HarvestablesHandler.js:204`) : appelle `shouldDisplayHarvestable(stringType, isLiving, tier, charges)`. Si retour false, `return;` sans ajouter à `harvestableList`. Pour living resources, `charges=0` au spawn (event 40 initial ou event 38 batch avec `const enchant = 0` hardcodé ligne 464). Si user décoche `settingLiving{Family}Enchants.e0`, l'entité est droppée.

**`HarvestablesHandler.HarvestUpdateEvent`** event 46 (`HarvestablesHandler.js:340`) : `harvestableList.find(id)`, si undefined `return;`. Quand le serveur envoie la vraie valeur d'enchant plus tard, l'entité droppée au spawn n'existe pas → update perdu.

**`MobsHandler.AddEnemy`** (`web/scripts/handlers/MobsHandler.js:252-268`) : même pattern pour `LivingHarvestable`/`LivingSkinnable`. Filter block check `settings[`e${enchant}`][tier-1]` ; si false, `return;`.

**`MobsHandler.updateEnchantEvent`** (`MobsHandler.js:335-343`) : find par id dans `mobsList` ∪ `harvestablesNotGood`, if absent silently no-op. Le dead scaffolding `harvestablesNotGood` était pré-prévu pour ce fix mais jamais wiring (4 reads, 0 writes).

## Solution : filter-at-render (Option 1)

Au lieu de filtrer à l'ajout, **toujours stocker les living resources** dans leurs listes. Le filter se fait au drawing frame-by-frame, consommant les settings courants.

### Architecture

```
┌───────────────────────────────────────────────────────────┐
│  web/scripts/utils/LivingResourceFilter.js  (NEW pure fn) │
│                                                           │
│  shouldRenderLivingResource(entity, getSetting)           │
│    entity: { tier, enchantmentLevel|charges, name }       │
│    getSetting: (key) => object | null                     │
│    return: boolean                                        │
└───────────────────────────────────────────────────────────┘
                          ▲
                          │ imports
                          │
    ┌─────────────────────┼─────────────────────┐
    │                     │                     │
    ▼                     ▼                     ▼
┌───────────────┐   ┌────────────────┐   ┌─────────────────────┐
│ MobsDrawing   │   │ Harvestables   │   │ (future : MistsWisp │
│ .invalidate   │   │ Drawing        │   │  if same pattern)   │
│               │   │ .invalidate    │   └─────────────────────┘
└───────────────┘   └────────────────┘

      Handlers (no more spawn filter for living) :
┌───────────────────────┐   ┌──────────────────────────────┐
│ MobsHandler.AddEnemy  │   │ HarvestablesHandler          │
│ - drop filter block   │   │ - shouldDisplayHarvestable   │
│ - kill dead           │   │   always true for isLiving   │
│   harvestablesNotGood │   │ - drop event 46 removal gate │
└───────────────────────┘   └──────────────────────────────┘
```

### Pure function contract

```js
// MIN_TIER_BY_TYPE réutilisé de LivingResourceTier.js ?
// Non : ce fichier concerne la tier rule, pas le filter.
// On garde LivingResourceFilter.js minimal : pas de tier floor logic,
// juste la résolution settings key + check.

const LIVING_SETTINGS_KEY_BY_NAME = {
    Fiber: 'settingLivingFiberEnchants',
    Hide:  'settingLivingHideEnchants',
    Log:   'settingLivingWoodEnchants',
    Ore:   'settingLivingOreEnchants',
    Rock:  'settingLivingRockEnchants',
};

export function shouldRenderLivingResource(entity, getSetting) {
    if (!entity) return false;
    const tier = entity.tier ?? 0;
    if (tier < 1 || tier > 8) return false;
    const enchant = entity.enchantmentLevel ?? entity.charges ?? 0;
    if (enchant < 0 || enchant > 4) return false;
    const key = LIVING_SETTINGS_KEY_BY_NAME[entity.name];
    if (!key) return false;
    const settings = getSetting(key);
    return settings?.[`e${enchant}`]?.[tier - 1] === true;
}
```

Contrat :
- Retourne `false` par défaut si quoi que ce soit manque (tier, name, settings). Pas de throw.
- Accepte `entity.enchantmentLevel` (convention MobsHandler) OU `entity.charges` (convention HarvestablesHandler), résolu par fallback.
- `getSetting` est injecté pour pouvoir tester sans mock global `settingsSync`.

### Handler changes (minimal, symétrique)

**`MobsHandler.AddEnemy`** :
- Supprimer lignes 252-268 (filter block pour LivingHarvestable/LivingSkinnable).
- Supprimer `this.harvestablesNotGood = [];` (ligne 89), `harvestablesNotGood.some(...)` (ligne 174), `harvestablesNotGood.filter(...)` (ligne 313), `|| this.harvestablesNotGood.find(...)` (ligne 338), `this.harvestablesNotGood = [];` (ligne 511).
- Rien d'autre : mob est push dans mobsList même si enchant/tier ne matche pas les settings courants, le drawing filtrera.

**`HarvestablesHandler.shouldDisplayHarvestable`** :
- Ajouter un early-return : `if (isLiving) return true;` en haut de la fonction.
- Le code existant (settings map + prefix + settings check) reste pour static.

**`HarvestablesHandler.HarvestUpdateEvent`** (event 46) :
- Supprimer lignes 367-374 (le bloc `if (!shouldDisplay) removeHarvestable(id);` qui drop post-update).
- L'update de `harvestable.charges` reste, c'est ce qui permet au drawing de voir le nouvel enchant.

### Drawing changes (symétriques)

**`MobsDrawing.invalidate`** : juste après `isLivingResource = true;` (ligne 39), avant `imageName` assignment :
```js
if (isLivingResource && !shouldRenderLivingResource(mobOne, key => settingsSync.getJSON(key))) {
    continue;
}
```

**`HarvestablesDrawing.invalidate`** : pour chaque `harvestableOne`, détecter si living (`harvestableOne.mobileTypeId > 0`) et skip si filter fail. Ajout au-dessus du calcul `draw`.

Impl note : la détection `isLiving` sur une harvestable dans le drawing est : `mobileTypeId !== null && mobileTypeId !== 65535 && mobileTypeId !== -1`. Même logique que dans le handler. Stocker éventuellement sur `Harvestable.isLiving` au constructor pour éviter de répéter.

## Testing strategy

### 1. Pure function tests (`LivingResourceFilter.test.js`)

~15 cas couvrant :
- Happy paths : chaque famille × enchant on/off × tier on/off
- `getSetting` returns null / undefined → false
- `entity.name` inconnu → false
- `entity.tier` out of range (< 1, > 8) → false
- `entity.enchantmentLevel` out of range → false
- Fallback : `entity` avec `charges` field (pas `enchantmentLevel`) → resolved correctly

### 2. Handler regression tests

`MobsHandler.test.js` : 3 nouveaux tests sous un nouveau `describe('HARV-2 enchant-at-render behaviour')` :
- `'spawn living Hide mob typeId=373 with enchant=0 and settings e0=off still adds to mobsList'`
- `'updateEnchantEvent mutes enchantmentLevel on existing mob after spawn'`
- `'spawn then updateEnchantEvent sequence: mob survives filter gap'`

Ces tests utilisent un **strict settings mock** (pas `allTrueSettings` permissif) pour exercer un scénario réaliste.

`HarvestablesHandler.test.js` : 3 équivalents pour living harvestables (mobileTypeId valide). Flip les `test.fails` HARV-2 existants vers `@verified`.

### 3. Drawing tests

`MobsDrawing.test.js` existant (modifié par PR #78 pour MIST-1) : ajouter un `describe('living resource filter at render')` avec 4-5 cas :
- Living mob e=0 + settings e0=off → `DrawCustomImage` NOT called
- Living mob e=2 + settings e2=on → `DrawCustomImage` called with `fiber_T_2`
- Static harvestable unchanged (pour confirmer pas de régression)

`HarvestablesDrawing.test.js` : vérifier si existe, sinon créer pour la symétrie.

### 4. Intégration avec la grille T1-T8 de #52

Le grid test.each du #52 (60 cells) utilise le mock permissif `allTrueSettings`. Ça continue de marcher (settings on pour tout → filter-at-render pass). Pas de changement nécessaire.

## Risks et mitigations

1. **Perf render si many filtered entities** : bench realistic : max ~200 entités par zone, 200 settings lookups per frame ≈ <1ms sur moteur V8. Mitigation : cache du settings JSON parsé si bench révèle regression (pas implémenté initialement, YAGNI).

2. **User-visible behavior regression pour users customisant filters** : non. Users qui avaient `e0=off` voyaient zéro living. Après fix, ils voient toujours zéro si enchant reste à 0. Différence : ils vont voir les enchants supérieurs qu'ils ont cochés. C'est exactement le comportement attendu par #32.

3. **Static path silently diverges** : assumé. User n'a pas reporté de bug static. Si jamais ça remonte, même fix structurel s'appliquera (early-return dans shouldDisplayHarvestable, no more filter at spawn).

4. **Surfaces de render manquées** : risque faible mais à vérifier. `grep -n "isLiving\|LivingHarvestable\|LivingSkinnable"` sur tous les drawings confirmera qu'on a couvert les 2 drawings principaux. MistsWispDrawing (post-PR #78) a sa propre logique settings, séparée.

5. **Ordre de merge vs PR #77** : cette PR branche sur `feat/52-living-tier-mismatch`. Si #77 merge avant : rebase trivial sur nouvelle main (pas de conflit attendu car changements disjoints). Si #77 ne merge jamais et on veut cette PR standalone : rebaseable sur main au prix d'un petit conflit cosmétique dans MobsHandler.js (le fix tier du #52 ne serait pas présent mais le filter removal reste valide).

## Success criteria

1. `npm test` passe, +15 tests (pure + handlers + drawings).
2. HARV-2 `test.fails` existants flippés `@verified` ou supprimés.
3. `harvestablesNotGood` dead code supprimé (0 référence restante).
4. Live smoke user :
   - Settings : `settingLivingHideEnchants.e0 = off`, `settingLivingHideEnchants.e2 = on` (pour T4)
   - Entrer dans Mists, trouver un hide critter T4 qui charge up à e2
   - Radar affiche l'icône T4.2 (vs absent actuellement)
5. Pas de régression sur la grille T1-T8 du #52.

## Out of scope

- **Static path** : reste tel quel. Si user reporte le bug là, follow-up.
- **Cache settings JSON** : YAGNI sans preuve de bench regression.
- **Refactor du `settingsSync` mock strategy** : la PR utilise settings mock strict dans ses tests sans toucher au mock global des autres handlers.
- **Unification du `isLiving` detection** dans une helper pure function partagée : tentant mais increase scope. À considérer dans un tech-debt cleanup séparé.
