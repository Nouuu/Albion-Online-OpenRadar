# 📚 Documentation ZQRadar

Cette documentation est organisée en plusieurs sections pour faciliter la navigation.

## 📂 Structure de la Documentation

### 🎯 Pour les Utilisateurs

- **[README principal](../README.md)** - Guide utilisateur, installation, features
- **[SETUP.md](../SETUP.md)** - Setup développeur après clone ⭐
- **[BUILD.md](../BUILD.md)** - Instructions de build et packaging

### 👨‍💻 Pour les Développeurs

- **[DEV_GUIDE.md](./dev/DEV_GUIDE.md)** - Guide complet de développement
- **[ARCHITECTURE.md](./dev/ARCHITECTURE.md)** - Architecture du projet
- **[STYLE_GUIDE.md](./dev/STYLE_GUIDE.md)** - Conventions de code et style

### 🤖 Pour les Agents IA

- **[AI_AGENT_GUIDE.md](./ai/AI_AGENT_GUIDE.md)** - Guide principal pour les agents IA
- **[MCP_TOOLS.md](./ai/MCP_TOOLS.md)** - Documentation des outils MCP disponibles
- **[WORKFLOWS.md](./ai/WORKFLOWS.md)** - Workflows courants et bonnes pratiques

### 📝 Documentation Technique

- **[LOGGING.md](./technical/LOGGING.md)** - Système de logging v2.0 (centralisé) ⭐
- **[DEBUG_LOGGING_GUIDE.md](../work/DEBUG_LOGGING_GUIDE.md)** - Guide complet debug & logging
- **[SETTINGS.md](./technical/SETTINGS.md)** - Configuration et settings
- **[ENCHANTMENTS.md](./technical/ENCHANTMENTS.md)** - Système d'enchantements

### 🔧 Scripts Utilitaires (work/)

- **[WORK_OVERVIEW.md](./work/WORK_OVERVIEW.md)** - Vue d'ensemble des scripts Python ⭐
- **[COLLECTION_GUIDE.md](./work/COLLECTION_GUIDE.md)** - Guide de collecte de données
- **[QUICK_START.md](./work/QUICK_START.md)** - Démarrage rapide des scripts des outils

### 📋 Gestion de Projet

- **[TODO.md](./project/TODO.md)** - Tâches en cours et à venir
- **[CHANGELOG.md](./project/CHANGELOG.md)** - Historique des changements

---

## 🔍 Recherche Rapide

### Je veux...

- **Installer le projet** → [README principal](../README.md)
- **Comprendre l'architecture** → [ARCHITECTURE.md](./dev/ARCHITECTURE.md)
- **Débugger et tracer les événements** → [DEBUG_LOGGING_GUIDE.md](../work/DEBUG_LOGGING_GUIDE.md) ⭐
- **Utiliser les outils Python** → [WORK_OVERVIEW.md](./work/WORK_OVERVIEW.md) ⭐
- **Guide pour agents IA** → [AI_AGENT_GUIDE.md](./ai/AI_AGENT_GUIDE.md)
- **Configurer un agent IA** → [AI_AGENT_GUIDE.md](./ai/AI_AGENT_GUIDE.md)
- **Débugger le logging** → [LOGGING.md](./technical/LOGGING.md)

---

## 🚨 Règles Importantes

### ⚠️ Ne PAS créer de fichiers MD temporaires

- ❌ `WORKING_*.md`, `*_FIX.md`, `*_ANALYSIS.md`, `*_SESSION.md`, etc.
- ✅ Utiliser les fichiers existants ou les sections appropriées
- ✅ Utiliser les memories Serena pour les notes temporaires

### ✅ Où mettre quoi

| Type de contenu              | Destination                             |
|------------------------------|-----------------------------------------|
| Notes de session temporaires | Memories Serena (`write_memory`)        |
| Documentation permanente     | `docs/` avec structure appropriée       |
| TODOs                        | `docs/project/TODO.md`                  |
| Bugs connus                  | GitHub Issues ou `docs/project/TODO.md` |
| Scripts Python utilitaires   | `tools/` (git-ignoré mais documenté)    |
| Scripts Python utilitaires   | `work/` (git-ignoré sauf README)        |

---

*Dernière mise à jour: 2025-11-05*

