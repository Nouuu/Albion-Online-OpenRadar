# 📋 Documentation de Travail - ZQRadar

**Dernière mise à jour**: 2025-12-01

---

## 🎯 État Actuel du Projet (Vue Travail)

### Players (résumé très court)

Les joueurs sont **détectés** et peuvent être affichés sur le radar, mais leur **mouvement** reste en cours de stabilisation, dans les limites imposées par le chiffrement réseau.

Pour tous les détails autour des joueurs :
- Architecture & features joueurs → `../technical/PLAYERS.md`
- Limites MITM / positions joueurs → `../PLAYER_POSITIONS_MITM.md`
- Timeline & état détaillé du debug → `PLAYER_DETECTION_STATUS.md`

---

## 📁 Organisation des Documents

### Documents Actifs

| Fichier | Description | Status |
|---------|-------------|--------|
| [`PLAYER_DETECTION_STATUS.md`](PLAYER_DETECTION_STATUS.md) | État actuel du débogage joueurs et mouvement (timeline détaillée) | 🔴 EN COURS |
| [`IMPROVEMENTS.md`](IMPROVEMENTS.md) | Historique **résumé** des améliorations (dont players) | ✅ À jour |
| [`COLLECTION_GUIDE.md`](COLLECTION_GUIDE.md) | Guide collecte TypeIDs mobs | ✅ Valide |
| [`QUICK_START.md`](QUICK_START.md) | Démarrage rapide outils | ✅ Valide |
| [`TOOLS_README.md`](TOOLS_README.md) | Documentation scripts Python | ✅ Valide |
| [`WORK_OVERVIEW.md`](WORK_OVERVIEW.md) | Vue d'ensemble scripts utilitaires | ✅ Valide |

### Docs connexes importantes (hors `docs/work/`)

| Fichier | Rôle |
|---------|------|
| [`../technical/PLAYERS.md`](../technical/PLAYERS.md) | Architecture & comportement stable du système joueurs |
| [`../PLAYER_POSITIONS_MITM.md`](../PLAYER_POSITIONS_MITM.md) | Limites protocole / chiffrement / MITM pour positions joueurs |
| [`../ANALYSIS_DEATHEYE_VS_CURRENT.md`](../ANALYSIS_DEATHEYE_VS_CURRENT.md) | Analyse détaillée DEATHEYE vs implémentation actuelle |

### Archive

- `archive_2025-11-09/` → Anciennes investigations basées sur hypothèses incorrectes (protocole différent, chiffrement, etc.)
- `archive_2025-11-17/` → Investigations mouvement joueurs (buffer deserialization, offsets, corrections appliquées)

---

## 🚀 Comment Reprendre le Travail

### Si vous êtes une IA (Claude ou autre)

1. **Lire d'abord**: [`PLAYER_DETECTION_STATUS.md`](PLAYER_DETECTION_STATUS.md)
   - État exact du problème (détection + mouvement)
   - Timeline complète des investigations
   - Leçons apprises des régressions
   - Prochaines étapes prioritaires

2. **Consulter**: [`IMPROVEMENTS.md`](IMPROVEMENTS.md) pour le **résumé chronologique** des travaux

3. **Pour le contexte protocole/limitations**:
   - Lire `../PLAYER_POSITIONS_MITM.md` pour comprendre les limites MITM/positions joueurs
   - Lire `../ANALYSIS_DEATHEYE_VS_CURRENT.md` si besoin de comparer avec DEATHEYE

4. **Analyser**: Nouveaux logs dans `logs/sessions/session_YYYY-MM-DD.jsonl`
   - Chercher `Event_Full_Dictionary`
   - Chercher `DIAG_MoveBuffer_*`

### Si vous êtes le Développeur

1. **État actuel**: Les joueurs sont détectés, mais les mouvements restent partiellement cassés et **les positions sont de toute façon contraintes par le chiffrement** (voir `../PLAYER_POSITIONS_MITM.md`).
2. **Prochaine étape technique**: suivre la checklist dans `PLAYER_DETECTION_STATUS.md` (Event 29 param[7], Event 3 pour joueurs).
3. **Référentiels**:
   - `../technical/PLAYERS.md` pour l’architecture côté JS
   - `../PLAYER_POSITIONS_MITM.md` pour ce qui est faisable ou non sans MITM
   - `../ANALYSIS_DEATHEYE_VS_CURRENT.md` pour les offsets et la partie XML/DEATHEYE

---

## ⚠️ Documents Archivés

Ces documents ont été **archivés** car ils concernent des investigations spécifiques désormais consolidées :

### `archive_2025-11-17/`
- `BUFFER_DESERIALIZATION_STATUS.md` → Investigation détaillée buffer deserialization
- `PLAYER_MOVEMENT_INVESTIGATION_2025-11-10_PM.md` → Investigation mouvement (session PM)
- `PLAYER_MOVEMENT_CURRENT_STATUS.md` → Status mouvement (obsolète, voir PLAYER_DETECTION_STATUS.md)
- `PLAYER_MOVEMENT_FIX_2025-11-10.md` → Tentative de fix (supercédée)

### `archive_2025-11-09/`
- Voir `archive_2025-11-09/README.md` pour détails

**Pourquoi archivés?**
- Consolidés dans [`PLAYER_DETECTION_STATUS.md`](PLAYER_DETECTION_STATUS.md)
- Conservés pour référence historique des investigations
- Documentation des leçons apprises et erreurs à éviter

---

## 🎯 Objectifs

### Court Terme

1. **Stabiliser le mouvement des joueurs** 🔴 PRIORITÉ
   - Suivre la checklist dans `PLAYER_DETECTION_STATUS.md`
   - S’assurer de ne pas casser mobs/resources

### Moyen Terme

2. **Collecte TypeIDs Living Resources**
   - Voir [`COLLECTION_GUIDE.md`](COLLECTION_GUIDE.md)
   - Couverture T4-T8 complète

### Long Terme

3. **Stabilité et Performance**
   - Optimisation détection
   - Réduction faux positifs
   - Tests extensifs

---

## 📞 Contacts

- **GitHub Issues**: [anthropics/claude-code/issues](https://github.com/anthropics/claude-code/issues)
- **Documentation**: `docs/` et `docs/work/`

---

**Prêt à reprendre le débogage ! 🔍🐛**
