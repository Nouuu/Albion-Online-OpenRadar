# Icon visibility improvements (#98)

| Field | Value |
|---|---|
| Status | Active, ready for implementation plan |
| Created | 2026-04-29 |
| Issue | [#98 Icon size](https://github.com/Nouuu/Albion-Online-OpenRadar/issues/98) |
| Discussion | [#97 Icon size](https://github.com/Nouuu/Albion-Online-OpenRadar/discussions/97) |
| Branch (planned) | `feat/98-icon-visibility` |
| Depends on | None |
| Blocks | Nothing critical |
| User action required | No |
| GitHub interaction | Single PR with 3 commits, closes #98 |

## Context

Issue #98 (converted from discussion #97 by the maintainer) gathers two user requests around radar icon visibility:

1. The original ask from `srn3dcom`: resource icons rendered too small to be readable on the radar.
2. A follow-up comment proposing an alternative rendering: colored category squares with the tier number in the middle, in addition to or instead of the game icons.

The current rendering pipeline in `web/scripts/utils/DrawingUtils.js`:
- `getZoomLevel()` reads `settingRadarZoom` (range 0.3–3, default 1.0).
- `getCanvasScale()` returns `canvasSize / 500`.
- `getScaledSize(base) = base × zoom × canvasScale` is used for everything: images, marker circles, text, healthbar, cluster ring, distance indicator, count badge.
- Each `*Drawing.js` passes a hardcoded `baseSize` to `DrawCustomImage` (Harvestables/Mobs=40, Chests=35, Dungeons=28, Mists=21, Cage/Fish=18).
- Hostile NPCs (Enemy, EnchantedEnemy, MiniBoss, Boss, Drone, MistBoss/Events without name) render as colored circles via `MobsDrawing.js:128` with hardcoded radius `getScaledSize(7)`.

There is no way today to enlarge entity markers without enlarging the entire map (`settingRadarZoom`) or the canvas itself (`settingCanvasSize`). Both alternatives have side effects the user does not want.

## Goals

- Add a global `Icon Size` slider that scales entity markers (images and hostile NPC circles) without affecting overlay text, healthbars, cluster rings, distance indicators, or count badges.
- Add an alternative rendering mode for harvestables (static + living) that replaces game icons with color-coded tier badges, intended as a low-vision / high-contrast option.
- Keep the existing rendering as the default. Both new settings opt-in.
- While editing the settings page, make the Network settings card collapsible to match the Logging and Debug cards.

## Non goals

- Per-category icon size overrides (single global slider only). YAGNI until a concrete need surfaces.
- Color badges for non-harvestable entities (mobs, chests, dungeons, mists, fishing, cage). Mobs are already color-coded by hostility level; chests by rarity. Re-badging them would lose the existing semantic encoding.
- New icon assets, animation, or shape variants.

## Approach

Three independent commits in a single PR, each with a single intent:

1. **`feat(radar): add Icon Size slider for marker visibility`** introduces the global icon-size multiplier and applies it to images and hostile NPC marker circles. Default `1.0` preserves current rendering except for a small tightening of the hostile NPC circle radius (7 → 6).
2. **`feat(badges): add Resource Color Badges toggle for harvestables`** introduces the alternative badge rendering for static harvestables and living harvestables/skinnables, behind a setting that defaults to off.
3. **`ui(settings): make Network card collapsible`** applies the existing `collapse collapse-arrow` pattern (used by Logging and Debug cards) to the Network card. Bonus while editing the same template.

## Section 1: Icon Size slider (commit 1)

### Architecture

Introduces a clean separation between two scaling concerns in `DrawingUtils`:

- `getScaledSize(base)` (existing, unchanged): used for overlay rendering (text, healthbar, cluster ring, distance indicator, count badge, label offsets). Continues to depend only on `zoom × canvasScale`.
- `getMarkerSize(base)` (new): used for entity marker rendering (images and hostile NPC circles). Adds the `iconSize` multiplier on top of `zoom × canvasScale`.

This separation keeps overlay readability independent from marker sizing. A user who wants larger markers will not get oversized text or healthbars as a side effect.

### Files touched

| File | Change |
|---|---|
| `web/scripts/utils/DrawingUtils.js` | Add `getIconSizeMultiplier()` reading `settingIconSize` (default 1.0). Add `getMarkerSize(base) = base × iconSize × zoom × canvasScale`. In `DrawCustomImage`, replace `getScaledSize(size)` with `getMarkerSize(size)` (internal). In the same method, replace the loading-fallback `drawFilledCircle(ctx, x, y, getScaledSize(10), "#4169E1")` with `getMarkerSize(10)` since that fallback is a marker. |
| `web/scripts/drawings/MobsDrawing.js` | Line 128: `drawFilledCircle(ctx, point.x, point.y, getScaledSize(7), color)` → `drawFilledCircle(ctx, point.x, point.y, getMarkerSize(6), color)`. Two changes: switch to `getMarkerSize`, reduce base radius from 7 to 6. |
| `internal/templates/pages/radar.gohtml` | New slider `settingIconSize` placed after the existing Size slider (around line 59). Markup mirrors the Zoom slider block (lines 42–50): label `Icon size:`, range input `min="0.5" max="2" step="0.1" value="1"`, `iconSizeDown` / `iconSizeUp` / `iconSizeReset` buttons, value display `100%`. JS init/listeners block mirrors the `settingRadarZoom` block (lines 188–211). Persisted via `settingsSync.setFloat('settingIconSize', value)`. |

### Data flow

```
User drags Icon Size slider on radar page
        ↓
settingsSync.setFloat('settingIconSize', value)
        ↓ (localStorage + in-memory cache)
DrawingUtils.getIconSizeMultiplier() picks up the new value
        ↓
DrawingUtils.getMarkerSize(base) returns base × iconSize × zoom × canvasScale
        ↓
       ┌──────────────────────────┴─────────────────────────────┐
DrawCustomImage (resources, mobs, chests, ...)         MobsDrawing hostile NPC circle
       ↓                                                       ↓
ctx.drawImage with scaled size                  ctx.arc with scaled radius
       ↓
Canvas redraw on next gameLoop tick
```

### Tests (TDD strict, Rule 8)

| Cible | Test | Label |
|---|---|---|
| `DrawingUtils.getMarkerSize` | Returns `base × multiplier × zoom × scale`. With `settingIconSize` unset, returns `base × 1.0 × zoom × scale`. With `settingIconSize=2.0`, returns `base × 2.0 × zoom × scale`. happy-dom + inline `vi.fn()` settings stub. | `@verified 2026-04-29` |
| `DrawingUtils.DrawCustomImage` | Asserts that `ctx.drawImage` is called with size equal to `getMarkerSize(size)`, not `getScaledSize(size)`. Existing `_HarvestablesDrawing.test.js` and `_MobsDrawing.test.js` assert on the `baseSize` arg passed to `DrawCustomImage` (the `40` argument is unchanged), so they continue to pass. New file `_DrawingUtils.test.js` covers the internal scaling (the file does not exist yet). | `@verified 2026-04-29` |
| `MobsDrawing` hostile NPC | With a hostile NPC entity (Enemy type), assert `drawFilledCircle` called with radius `getMarkerSize(6)` and base color matching `getEnemyColor(type)`. Existing `_MobsDrawing.test.js` already mocks `drawFilledCircle` and asserts it was called. Extend the assertions to check the radius arg. | `@verified 2026-04-29` |
| Default backward compat | `settingIconSize` undefined → multiplier = 1.0 → rendering identical to baseline except for the deliberate 7→6 hostile NPC radius change. | `@verified 2026-04-29` |

### Error handling

- `settingsSync.getFloat('settingIconSize')` returns `null`/`NaN` when unset → fallback `|| 1.0`.
- `<input type="range">` enforces min/max/step at the DOM level. No defensive clamping needed in JS.
- Slider operates on a numeric scalar. No string parsing, no JSON.

### Risks

- **Performance**: one extra localStorage read per scaled draw call. Already the pattern for `settingRadarZoom` and `settingCanvasSize`; `SettingsSync` caches in memory, negligible cost.
- **Visual regression**: none with multiplier=1.0 except the deliberate hostile NPC radius reduction (7→6). That change is documented in the commit message.
- **Hot-spot adjacency**: this PR touches `MobsDrawing.js` (280 lines, not a hot-spot) but the parent `MobsHandler.js` IS a hot-spot per CLAUDE.md. No handler edits in this PR. Single-line edit at `MobsDrawing.js:128`, no structural change.

## Section 2: Resource Color Badges toggle (commit 2)

### Architecture

A boolean toggle `settingResourceColorBadges` (default `false`) switches harvestable rendering between game icons (`DrawCustomImage`) and a colored tier badge (`drawResourceBadge`). The switch lives in:

- `HarvestablesDrawing.invalidate`: covers all static harvestables.
- `MobsDrawing.invalidate`, inside the `EnemyType.LivingHarvestable` / `EnemyType.LivingSkinnable` branch: covers living harvestables. Living variants get a gold border on top of their category color.

The toggle reacts in real time via the existing `SettingsSync` watcher pattern. No reload required.

### The badge

Visual specification:

```
┌─────────┐
│  T6 +2  │   Square, fillStyle = category color, borderRadius = 12% × baseSize,
│         │   stroke alpha=0.3 white 1px
└─────────┘
```

- **Background**: solid fill with the category color. No gradient (legibility prevails over aesthetic).
- **Tier text** `T<n>`: bold, font size `getMarkerSize(baseSize × 0.55)`, white, with shadow `rgba(0,0,0,0.7)` blur 3 for legibility on any color.
- **Enchant suffix** `+<n>`: bold, font size `getMarkerSize(baseSize × 0.30)`, drawn as a small superscript to the right of `T<n>`. Omitted when `enchant === 0`.
- **Living border**: `strokeStyle = #FFD700`, `lineWidth = max(2, getMarkerSize(2))`, drawn over the standard border.

### Color mapping (5 categories)

| Category | Color | Hex | Rationale |
|---|---|---|---|
| Fiber | green | `#4CAF50` | Matches commenter suggestion (`bright green`) and plant association |
| Hide | tan | `#A1887F` | Leather/skin tone |
| Wood | brown | `#8D6E63` | Bark/wood tone |
| Ore | blue | `#42A5F5` | Matches commenter suggestion (`blue square`) and metal association |
| Rock | purple | `#9C27B0` | Matches commenter suggestion (`stone - purple`) |
| Living variant | base color + gold border | `#FFD700` border | Visually distinguishes living from static |

Category resolution from entity name reuses the lowercased substring matching already present in `DrawingUtils.detectClusters` (lines 423–442). To avoid duplication, that logic is extracted into a shared helper `getResourceCategory(name)` and re-used by both call sites.

### Files touched

#### Commit 2: color badges toggle

| File | Change |
|---|---|
| `web/scripts/utils/DrawingUtils.js` | New helper `getResourceCategory(name)` extracted from `detectClusters`. New helper `getResourceCategoryColor(category)` returning the hex. New primitive `drawResourceBadge(ctx, x, y, baseSize, category, tier, enchant, isLiving)` that draws the rounded square + text + optional gold border. `detectClusters` switches to the new shared helper to avoid duplication. |
| `web/scripts/drawings/HarvestablesDrawing.js` | At the call site that currently invokes `DrawCustomImage(ctx, point.x, point.y, draw, "Resources", 40)` (line 110), branch on `settingsSync.getBool('settingResourceColorBadges')`. When true, resolve `category = getResourceCategory(harv.name)`, call `drawResourceBadge(...)`. When false (or `category === null`), call `DrawCustomImage` as today. |
| `web/scripts/drawings/MobsDrawing.js` | In the LivingHarvestable / LivingSkinnable branch (lines 39–54), apply the same conditional with `isLiving=true`. Reuse the existing image-rendering gate `mobOne.name && mobOne.tier > 0` so the badge does not render with `T0` for unidentified living mobs (those keep their fallback circle). |
| `internal/templates/pages/settings.gohtml` | Add a new label inside the Display grid (line 62 area), matching the style of `settingResourceCount` and `settingResourceDistance`: checkbox `settingResourceColorBadges`, Lucide icon `palette`, tooltip `Replace resource icons with colored tier badges (better visibility)`. |

#### Commit 3: collapsible Network card

| File | Change |
|---|---|
| `internal/templates/pages/settings.gohtml` lines 284-293 | Replace the outer `<div class="card bg-base-200">…<div class="card-body">` wrapper with `<div class="collapse collapse-arrow bg-base-200 rounded-xl"> <input type="checkbox" id="collapse-network"/> <div class="collapse-title text-xl font-semibold flex items-center gap-2"> [existing h2 content] </div> <div class="collapse-content"> [existing network-section div] </div> </div>`. Same shape as the Logging card (lines 130-136) and Debug card (lines 225-232). |
| `internal/templates/pages/settings.gohtml` JS block (lines 336-345 area) | Add the bind: `const collapseNetwork = document.getElementById('collapse-network'); if (collapseNetwork) { collapseNetwork.checked = settingsSync.getBool('collapse-settings-network', false); addListener(collapseNetwork, 'change', () => settingsSync.setBool('collapse-settings-network', collapseNetwork.checked)); }`. |

### Data flow (commit 2)

```
User toggles "Resource color badges" in settings page
        ↓
settingsSync.setBool('settingResourceColorBadges', true)
        ↓
HarvestablesDrawing.invalidate / MobsDrawing living branch (next frame)
        ↓
       ┌────────────────┴────────────────┐
       badges=true                badges=false
              ↓                          ↓
   getResourceCategory(name)   DrawCustomImage (existing path)
              ↓
   ┌──────────┴─────────┐
   category found       category null
        ↓                     ↓
drawResourceBadge       DrawCustomImage (fallback)
```

### Tests (TDD strict, Rule 8 + Rule 10)

| Cible | Test | Label |
|---|---|---|
| `DrawingUtils.getResourceCategory(name)` | `'fiber_5_2'`→`'Fiber'`, `'hide_4_0'`→`'Hide'`, `'log_6_3'`→`'Wood'`, `'ore_T7_2'`→`'Ore'`, `'rock_3_1'`→`'Rock'`, unknown name→`null`. Five categories + null case. | `@verified 2026-04-29` |
| `DrawingUtils.getResourceCategoryColor` | Five categories return their mapped hex. Unknown category returns `null`. | `@verified 2026-04-29` |
| `DrawingUtils.drawResourceBadge` | With canvas-mock: asserts `fillRect` called with the right color, `fillText` called once for `T<n>` and a second time for `+<n>` only when enchant > 0. With `isLiving=true`, asserts an extra `strokeRect` call with `#FFD700`. | `@verified 2026-04-29` |
| `HarvestablesDrawing.invalidate` | `settingResourceColorBadges=false` → `DrawCustomImage` called (existing behavior). `settingResourceColorBadges=true` + known category → `drawResourceBadge` called with the right category, tier, enchant. Covers the 5 categories using existing pcap-derived fixtures. | `@verified 2026-04-29` |
| `MobsDrawing.invalidate` Living branch | `settingResourceColorBadges=true` + LivingHarvestable + name known → `drawResourceBadge` called with `isLiving=true`. Same with LivingSkinnable. Living without name → existing fallback (no badge). | `@verified 2026-04-29` |
| Default backward compat | `settingResourceColorBadges` unset → `getBool` returns `false` → all existing rendering tests pass unchanged. | `@verified 2026-04-29` |

Refactor of `getResourceCategory` from `detectClusters`: the existing cluster detection tests must continue to pass (no behavior change, only extraction).

### Error handling

- `getResourceCategory(name)` returns `null` if no substring match → `HarvestablesDrawing` and `MobsDrawing` fall back to `DrawCustomImage`. Preserves the existing rendering for any unmapped resource type.
- `getResourceCategoryColor(null)` returns `null` → never reached in practice (call sites guard against `category === null`), but if it happens, `drawResourceBadge` falls back to `#4169E1` (royal blue, matches the existing image-loading fallback color).
- Toggle changed in-session: `SettingsSync` watcher fires, the next `gameLoop` frame redraws. No forced redraw needed.

### Risks

- **Refactor risk** (`getResourceCategory` extraction): the existing cluster detection logic must continue to work. Mitigated by characterization tests on `detectClusters` returning the same cluster shapes before and after.
- **Living variant edge case**: a living mob with a `name` but a name that does not match any of the 5 categories. Falls back to `DrawCustomImage` with the original name, identical to today's behavior.
- **Visual regression**: none with `settingResourceColorBadges=false` (default). With `=true`, harvestables and living variants change visually as specified. That is the intent of the feature.
- **Hot-spot**: `HarvestablesHandler.js` and `MobsHandler.js` are listed as hot-spots in CLAUDE.md, but this PR touches the *Drawing* siblings, which are smaller. No handler edits.

## Verification

Once all three commits land:

1. `npm test` green, no characterization regressions.
2. `npm run lint` exit 0.
3. `go build ./...` and `go test ./...` green (PR has no Go changes, but CI must remain green).
4. `golangci-lint run ./...` exit 0 (per `feedback_run_golangci_lint_not_just_vet`).
5. Live smoke (per `feedback_embed_rebuild_gotcha`: rebuild `radar.exe` first):
   1. Default settings → rendering identical to before, except hostile NPC circles slightly tighter (7→6).
   2. Drag Icon Size to `1.5×` → all images and hostile NPC circles 50% larger; text and healthbars unchanged.
   3. Drag Icon Size to `0.7×` → markers smaller, no overflow, text still readable.
   4. Toggle `Resource color badges` ON → harvestables (Fiber/Hide/Wood/Ore/Rock) render as colored squares with `T<tier>` and optional `+<enchant>`; living variants get a gold border.
   5. Toggle OFF → harvestables back to game icons.
   6. Network card on settings page now collapses/expands; state persists across page reloads.
6. No console errors in DevTools.

## Files summary

```
docs/plans/2026-04-29-icon-visibility-design.md     [this file]
docs/plans/2026-04-29-icon-visibility-implementation-plan.md  [next step]
web/scripts/utils/DrawingUtils.js                   [+ 3 helpers, modify DrawCustomImage]
web/scripts/drawings/HarvestablesDrawing.js         [conditional branch]
web/scripts/drawings/MobsDrawing.js                 [conditional branch + radius 7→6]
web/scripts/utils/_DrawingUtils.test.js             [new file to create]
web/scripts/drawings/_HarvestablesDrawing.test.js   [extend]
web/scripts/drawings/_MobsDrawing.test.js           [extend]
internal/templates/pages/radar.gohtml               [Icon Size slider markup + JS]
internal/templates/pages/settings.gohtml            [color badges checkbox + collapse Network]
```

## Out of scope (deferred or rejected)

- Per-category icon size sliders (one global is enough for the original ask).
- Color badges for mobs, chests, dungeons, mists, fishing, cage (mobs encode hostility level by color, chests encode rarity; re-badging would lose information).
- Compact `+<enchant>`-only badge variant (could be added later if requested).
- Exposing the multiplier as a numeric input field in addition to the slider (slider is enough; mirrors the existing zoom and size controls).
