# 📋 Root Files - OpenRadar

> **Reference guide** – Organization of the project root

---

## ✅ Allowed Files at the Root (9 only)

**Essential files:**

1. **`app.js`** ⭐ – Application entry point
2. **`package.json`** ⭐ – npm configuration
3. **`package-lock.json`** – Dependency lockfile
4. **`.gitignore`** – Git ignore rules
5. **`README.md`** ⭐ – Main user guide
6. **`BUILD.md`** – Build instructions
7. **`SETUP.md`** – Developer setup guide
8. **`zqradar.ico`** – Application icon (kept for compatibility)
9. **`build-helper.bat`** – Wrapper for build scripts (Windows)

---

## 📁 Organization of Other Files

### `build/`

Node.js build scripts:

- `check-system.js` – System checks
- `post-build.js` – Post-build tasks
- `optimize-images.js` – Image optimization
- `create-release.js` – Release creation
- `README.md` – Build docs

### `config/`

Configuration files:

- `nodemon.json` – Nodemon configuration
- `README.md` – Documentation

### `scripts-shell/`

Utility Windows batch scripts:

- `_INSTALL.bat` – Install
- `_RUN.bat` – Quick launch
- `README.md` – Documentation

**Each folder must contain an explanatory `README.md`.**

---

## ❌ Forbidden Temporary Markdown Files

**Automatically git-ignored patterns:**

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

**Reason:** These files are temporary and create clutter.

---

## ✅ Where to Put What

| File/info type        | Destination                          |
|-----------------------|--------------------------------------|
| Temporary notes       | Local notes or issues                |
| Important information | `docs/` with the proper structure   |
| Documentation         | `docs/`                             |
| Build scripts         | `build/`                            |
| Configuration         | `config/`                           |
| Shell scripts         | `scripts-shell/`                    |
| TODOs                 | `docs/project/TODO.md`              |
| Bugs                  | GitHub Issues                       |
| Changelog             | `docs/project/CHANGELOG.md`         |

---

## 🎯 Strict Rule

**ONLY 9 files at the root.**

Everything else → organized folders inside the repo.

---

## 📈 Reorganization (2025-11-05)

**From 14 files → 9 files at the root.**

**Moved files:**

- `build.bat`, `Makefile` → `build/`
- `nodemon.json` → `config/`
- `_INSTALL.bat`, `_RUN.bat` → `scripts-shell/`

**Removed files:**

- `.browser_opened` (temporary)

**Added files:**
- `build-helper.bat` (wrapper for `build/build.bat`)

**Result:** Clean and organized root.

**Important note:** Prefer `npm run build:win` over calling raw build scripts directly.

---

*Reference – Clean and organized root (updated 2025-11-05)*
