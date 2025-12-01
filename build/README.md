# build/

Scripts et outils Node.js pour le build et le packaging de ZQRadar.

**Note:** Les scripts `build.bat` et `Makefile` sont à la **racine du projet** pour faciliter l'accès.

---

## Scripts Node.js

### `check-system.js`
Vérifie les prérequis système (Node.js, Npcap, etc.).

```bash
npm run check
```

---

### `post-build.js`
Script post-build : copie des assets, création des archives.

```bash
npm run postbuild
# Appelé automatiquement après npm run build
```

---

### `optimize-images.js`
Optimise les images pour réduire la taille du package.

```bash
npm run optimize:images
```

---

### `create-release.js`
Crée une release avec archives ZIP.

---

## 📝 Notes

**Main build scripts are at the root:**
- `../build.bat` - Windows script
- `../Makefile` - Unix/Linux/macOS script

**To build:**
```bash
npm run build:win     # Windows exe
npm run build:all     # All platforms
```

**This directory contains Node.js scripts** used during the build process.

