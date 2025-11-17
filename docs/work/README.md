# 📋 Documentation de Travail - ZQRadar

**Dernière mise à jour**: 2025-11-10

---

## 🎯 État Actuel du Projet

### Problème en Cours: Mouvement des Joueurs 🔴

**Fichier de référence**: [`PLAYER_DETECTION_STATUS.md`](PLAYER_DETECTION_STATUS.md)

**Résumé**:
- ✅ Les joueurs sont **détectés** et apparaissent sur le radar
- ❌ Les joueurs **ne bougent pas** (restent figés à position initiale)
- 🔍 En cours de débogage avec logs diagnostiques

**Actions à faire**:
1. Lancer le radar et observer les joueurs
2. Analyser les nouveaux logs:
   - `Event_Full_Dictionary` → Photon Event Code
   - `DIAG_MoveBuffer_Structure` → Structure du Buffer
   - `DIAG_MoveBuffer_Decoded` → Valeurs décodées

---

## 📁 Organisation des Documents

### Documents Actifs

| Fichier | Description | Status |
|---------|-------------|--------|
| [`PLAYER_DETECTION_STATUS.md`](PLAYER_DETECTION_STATUS.md) | État actuel du débogage joueurs et mouvement | 🔴 EN COURS |
| [`IMPROVEMENTS.md`](IMPROVEMENTS.md) | Historique des améliorations | ✅ À jour |
| [`COLLECTION_GUIDE.md`](COLLECTION_GUIDE.md) | Guide collecte TypeIDs mobs | ✅ Valide |
| [`QUICK_START.md`](QUICK_START.md) | Démarrage rapide outils | ✅ Valide |
| [`TOOLS_README.md`](TOOLS_README.md) | Documentation scripts Python | ✅ Valide |
| [`WORK_OVERVIEW.md`](WORK_OVERVIEW.md) | Vue d'ensemble scripts utilitaires | ✅ Valide |

### Archive

- `archive_2025-11-09/` → Anciennes investigations basées sur hypothèses incorrectes (protocole différent, chiffrement, etc.)
- `archive_2025-11-17/` → Investigations mouvement joueurs (buffer deserialization, offsets, corrections appliquées)

---

## 🚀 Comment Reprendre le Travail

### Si vous êtes Claude (ou un autre IA)

1. **Lire d'abord**: [`PLAYER_DETECTION_STATUS.md`](PLAYER_DETECTION_STATUS.md)
   - Contient l'état exact du problème (détection + mouvement)
   - Timeline complète des investigations
   - Leçons apprises des régressions
   - Prochaines étapes prioritaires

2. **Vérifier**: [`IMPROVEMENTS.md`](IMPROVEMENTS.md) section "2025-11-10"
   - Résumé des corrections appliquées
   - Fichiers modifiés

3. **Analyser**: Nouveaux logs dans `logs/sessions/session_YYYY-MM-DD.jsonl`
   - Chercher `Event_Full_Dictionary`
   - Chercher `DIAG_MoveBuffer_*`

### Si vous êtes le Développeur

1. **État actuel**: Les joueurs sont détectés mais ne bougent pas
2. **Prochaine étape**: Tester le radar et envoyer les logs qui contiennent:
   - `Event_Full_Dictionary` (3 premiers events)
   - `DIAG_MoveBuffer_Structure` (5 premiers Buffers)
   - `DIAG_MoveBuffer_Decoded` (5 premiers)

3. **Repos de référence**: `work/data/`
   - AO-Radar (C#)
   - albion-network (C#)
   - ao-network (JavaScript?)
   - AlbionOnlinePhotonEventIds

---

## ⚠️ Documents Archivés

Ces documents ont été **archivés** car ils concernent des investigations spécifiques désormais consolidées:

### `archive_2025-11-17/`
- `BUFFER_DESERIALIZATION_STATUS.md` → Investigation détaillée buffer deserialization
- `PLAYER_MOVEMENT_INVESTIGATION_2025-11-10_PM.md` → Investigation mouvement (session PM)
- `PLAYER_MOVEMENT_CURRENT_STATUS.md` → Status mouvement (obsolète, voir PLAYER_DETECTION_STATUS.md)
- `PLAYER_MOVEMENT_FIX_2025-11-10.md` → Tentative de fix (supercédé)

### `archive_2025-11-09/`
- Voir `archive_2025-11-09/README.md` pour détails

**Pourquoi archivés?**
- Consolidés dans [`PLAYER_DETECTION_STATUS.md`](PLAYER_DETECTION_STATUS.md)
- Conservés pour référence historique des investigations
- Documentation des leçons apprises et erreurs à éviter

---

## 🎯 Objectifs

### Court Terme (Cette Semaine)

1. **Résoudre mouvement des joueurs** 🔴 PRIORITÉ
   - Identifier pourquoi Move events ne mettent pas à jour positions
   - Tester Photon Event Code 2 vs 3
   - Analyser structure Buffer

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

**Prêt à reprendre le débogage! 🔍🐛**