# 📋 Fichiers à la Racine - ZQRadar

> **Guide de référence** - Organisation de la racine du projet

---

## ✅ Fichiers Autorisés à la Racine (9 seulement)

**Fichiers essentiels :**

1. **`app.js`** ⭐ - Point d'entrée de l'application
2. **`package.json`** ⭐ - Configuration npm
3. **`package-lock.json`** - Lock des dépendances
4. **`.gitignore`** - Configuration git
5. **`README.md`** ⭐ - Guide utilisateur principal
6. **`BUILD.md`** - Instructions de build
7. **`SETUP.md`** - Guide setup développeur
8. **`zqradar.ico`** - Icône de l'application
9. **`build-helper.bat`** - Wrapper pour scripts de build (Windows)

---

## 📁 Organisation des Autres Fichiers

### `build/`
Scripts de build Node.js
- `check-system.js` - Vérification système
- `post-build.js` - Post-build
- `optimize-images.js` - Optimisation images
- `create-release.js` - Création release
- `README.md` - Documentation

### `config/`
Fichiers de configuration
- `nodemon.json` - Configuration nodemon
- `README.md` - Documentation

### `scripts-shell/`
Scripts batch Windows utilitaires
- `_INSTALL.bat` - Installation
- `_RUN.bat` - Lancement rapide
- `README.md` - Documentation

**Chaque dossier contient un README.md explicatif.**

---

## ❌ Fichiers MD Temporaires Interdits

**Patterns automatiquement git-ignorés :**

```gitignore
WORKING_*.md
*_FIX.md
*_ANALYSIS.md
*_CLEANUP.md
*_SESSION.md
*_FINAL.md
*_TYPEIDS.md
*_NOTES.md
*_TODO.md
MIGRATION_DOCS.md
REORGANIZATION_*.md
WORK_*.md
PASSE_*.md
PROJECT_SUMMARY.md
CHANGELOG_ORGANIZATION.md
```

**Raison :** Ces fichiers sont temporaires et créent du bazar.

---

## ✅ Où Mettre Quoi

| Type de fichier/info | Destination |
|----------------------|-------------|
| Notes temporaires | `mcp_serena_write_memory()` |
| Infos importantes | `aim_create_entities()` (Knowledge Graph) |
| Documentation | `docs/` avec structure appropriée |
| Scripts de build | `build/` |
| Configuration | `config/` |
| Scripts shell | `scripts-shell/` |
| TODOs | `docs/project/TODO.md` |
| Bugs | GitHub Issues |
| Changelog | `docs/project/CHANGELOG.md` |

---

## 🎯 Règle Stricte
**SEULEMENT 9 fichiers à la racine**
**SEULEMENT 8 fichiers à la racine**

Tout le reste → dossiers organisés ou memories MCP !

---

## 📊 Réorganisation (2025-11-05)
**De 14 fichiers → 9 fichiers à la racine**
**De 14 fichiers → 8 fichiers à la racine**

**Fichiers déplacés :**
- `build.bat`, `Makefile` → `build/`
- `nodemon.json` → `config/`
- `_INSTALL.bat`, `_RUN.bat` → `scripts-shell/`

**Fichiers supprimés :**
- `.browser_opened` (temporaire)
**Fichiers ajoutés :**
- `build-helper.bat` (wrapper pour build/build.bat)


**Résultat :** Racine propre et organisée !
**Note importante :** Préférer `npm run build:win` aux scripts directs.


---

*Référence - Racine propre et organisée (mise à jour 2025-11-05)*

