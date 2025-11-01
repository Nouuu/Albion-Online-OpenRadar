# 📚 ORGANISATION DE LA DOCUMENTATION

Ce projet contient 4 fichiers de documentation :

---

## 📄 Fichiers principaux

### 🎯 [README.md](README.md)
**Pour**: Utilisateurs finaux  
**Contenu**: Guide d'utilisation, installation, fonctionnalités

### 📋 [TODO.md](TODO.md)
**Pour**: Développeurs  
**Contenu**: Liste des tâches, état d'avancement, prochaines étapes (concis)

### 📝 [DEV_NOTES.md](DEV_NOTES.md)
**Pour**: Développeurs  
**Contenu**: Documentation technique complète, architecture, bugs connus, changelog

### 💬 [CLAUDE.md](CLAUDE.md)
**Pour**: Contexte IA  
**Contenu**: Notes de développement avec Claude AI (historique)

### 🛠️ [tools/](tools/)
**Pour**: Développeurs  
**Contenu**: Scripts d'analyse TypeID, vérification logs, outils de diagnostic

---

## 🔍 Où trouver quoi ?

| Je cherche...                    | Document            |
|----------------------------------|---------------------|
| Comment utiliser le radar        | README.md           |
| État d'avancement du projet      | TODO.md             |
| **Priorités actuelles**          | **TODO.md**         |
| **Guide collecte TypeID**        | **TODO.md**         |
| **État actuel du projet**        | **TODO.md**         |
| Détails techniques               | DEV_NOTES.md        |
| Architecture du code             | DEV_NOTES.md        |
| Bugs connus                      | DEV_NOTES.md        |
| TypeID mappings                  | DEV_NOTES.md        |
| Réflexions & Solutions           | DEV_NOTES.md        |
| Pourquoi auto-learning a échoué  | DEV_NOTES.md        |
| **Analyse TypeID / Logs**        | **tools/**          |
| Scripts de vérification          | tools/              |
| Changelog                        | DEV_NOTES.md        |
| Historique développement IA      | CLAUDE.md           |

---

## 🎯 PRIORITÉS ACTUELLES

### ✅ TERMINÉ
- ✅ MobsInfo_Enriched.js fusionné (235 TypeIDs)
- ✅ Corrections terrain appliquées (6 TypeID)
- ✅ Aucun doublon, code propre

### 🔴 Court terme (P1)
1. **Session terrain longue** pour validation
2. Analyser stabilité Fiber/Hide detection
3. Collecter TypeID enchantés manquants

### 🟠 Moyen terme (P2)
- Décider si EventNormalizer nécessaire
- Améliorer détection ressources enchantées

### 🟡 Long terme (P3)
- Métriques & monitoring

> 📖 **Détails complets dans [TODO.md](TODO.md)**

---

## 📦 Structure recommandée

```
Documentation/
├── README.md           ← Guide utilisateur
├── TODO.md             ← Tâches (court)
├── DEV_NOTES.md        ← Documentation dev (détaillé)
└── CLAUDE.md           ← Contexte IA

Code/
├── scripts/
├── views/
└── tests/
```

---

**Dernière mise à jour**: 2025-11-01

