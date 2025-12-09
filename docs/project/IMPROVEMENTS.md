# Summary of Improvements - OpenRadar

This document summarizes the main improvements made to OpenRadar.

> **📘 Pour la détection des ressources :** Voir `/RESOURCE_DETECTION_REFACTOR.md`  
> Ce document contient l'état complet du système de détection des ressources.

---

## Implemented Features

### 1. Enriched Logging for Living Resources

**File:** `scripts/Handlers/MobsHandler.js`

- Automatic HP validation (comparison with metadata)
- Animal identification (Boar, Wolf, Fox, etc.)
- JSON format for logs
- Readable summary with HP match indicator

### 2. Living Resources Metadata

**225 creatures with metadata:**
- HP per creature
- Prefab (internal name)
- Faction
- Animal (human-readable name)

### 3. Enchantment Detection System (Phase 3B - Dec 2025)

**System actuel (Déc 2025) :**
- ✅ Utilise `parameters[33]` directement du serveur
- ✅ Fonctionne pour tous les types (Hide, Fiber, Ore, Wood, Rock)
- ✅ Plus de calcul approximatif depuis `rarity`

**Système obsolète (Nov 2025) :**
- ❌ Calcul depuis le champ `rarity` (unreliable)
- Voir `docs/technical/ENCHANTMENTS.md` pour l'historique

**Voir :** `/RESOURCE_DETECTION_REFACTOR.md` pour les détails

### 4. Player Detection System

- Players detected via Event 29 (names, guilds, alliances)
- Equipment IDs extracted
- See `docs/technical/PLAYERS.md` for architecture

### 5. Radar Display Unification (~80% complete)

- RadarRenderer active (replaces legacy gameLoop)
- CanvasManager (7 canvas layers)
- SettingsSync (BroadcastChannel, no polling)
- Legacy code removed
- See `RADAR_UNIFICATION_PLAN.md` for details

---

## Planned Improvements

### 1. Mob Detection System Refactor

**Goal:** Database-based system similar to resources.

**Current State:**
- Mobs displayed as simple green dots
- No detailed information about mob types

**Planned:**
- Create static database file for mobs
- Display detailed mob information on radar
- Add visual differentiation based on mob types
- Enable filtering for specific mob types

### 2. Map Tile Size Normalization

**Goal:** Fix minimap stretching issues with variable zone sizes.

**Current Issue:**
- Different map tiles have different sizes
- Small city zones cause minimap stretching
- Player position becomes inaccurate on stretched maps

**Planned:**
- Normalize map tile dimensions
- Apply scaling correction for small zones
- Prevent image distortion on the minimap

---

## Known Limitations

### Player Movement

- Players detected but movement is still problematic
- Event 3 (Move) works for mobs but not reliably for players
- See `PLAYER_DETECTION_STATUS.md` for investigation status

---

*Last update: 2025-12-09*