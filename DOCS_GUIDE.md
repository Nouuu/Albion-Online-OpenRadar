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



---

## 🔍 Où trouver quoi ?

| Je cherche...                    | Document            |
|----------------------------------|---------------------|
| Comment utiliser le radar        | README.md           |
| État d'avancement du projet      | TODO.md             |
| **Priorités actuelles**          | **TODO.md**         |
| Détails techniques               | DEV_NOTES.md        |
| Architecture du code             | DEV_NOTES.md        |
| Bugs connus                      | DEV_NOTES.md        |
| TypeID mappings                  | DEV_NOTES.md        |
| Changelog                        | DEV_NOTES.md        |
| Historique développement IA      | CLAUDE.md           |

---

## 🎯 PRIORITÉS ACTUELLES

### ✅ TERMINÉ
- ✅ MobsInfo_Enriched.js fusionné (235 TypeIDs)
- ✅ Corrections terrain appliquées (6 TypeID)
- ✅ Aucun doublon, code propre

### 🔴 Court terme (P1)
1. **TESTER en jeu** (Fiber/Hide detection)
2. Valider 100% détection
3. Session longue stabilité

### 🟠 Moyen terme (P2)
- Analyser si EventNormalizer nécessaire

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

