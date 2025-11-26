# 🎯 ALBION RADAR - ÉTAT ACTUEL

**Dernière mise à jour**: 2025-11-26 01:00

---

## ✅ FONCTIONNEL

- **Mobs**: Apparition + mouvement (Event 3, coords RELATIVE)
- **Resources**: Harvestables detection
- **Chests**: Loot detection
- **Local Player**: Position tracking (Operation 21)
- **Players**: Spawn/despawn detection (Event 29 - noms/guildes/alliances)

---

## 🚧 EN COURS - Phase 3: Player Equipment & Item Power

**Objectif**: Afficher stats équipement joueurs (Item Power moyen)

**Implémentation**:
1. Parser `items.xml` → Database item ID ↔ itempower
2. Charger database au startup (`Utils.js`)
3. Fix `Player.getAverageItemPower()` → Lookup depuis database
4. Afficher Item Power réel (700-1400 range au lieu de garbage)

**Référence**: `docs/ANALYSIS_DEATHEYE_VS_CURRENT.md` (comparaison DEATHEYE)

---

## ❌ HORS SCOPE - Positions Joueurs

**Cause**: Chiffrement double couche (Photon AES-256-CBC + XOR Albion)
- Event 593 (KeySync avec XorCode) chiffré AES
- Sans MITM Photon → Pas d'accès XorCode → Positions illisibles

**Décision**: Approche AlbionRadar (spawn/despawn only, pas de positions)

**Détails**: Voir `docs/PLAYER_POSITIONS_MITM.md`

---

## 📁 STRUCTURE DOCUMENTATION

**Root** (max 3 fichiers):
- `README.md` - Intro projet
- `BUILD.md` - Instructions build/run
- `ACTION_PLAN.md` - État actuel (ce fichier)

**docs/**:
- `README.md` - Index documentation
- `PLAYER_POSITIONS_MITM.md` - Recherche MITM (positions hors scope)
- `ANALYSIS_DEATHEYE_VS_CURRENT.md` - Analyse complète bugs/fixes

---

**Status**: 🏗️ PHASE 3 EN COURS - Player Equipment Stats