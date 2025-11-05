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

**Les scripts de build principaux sont à la racine :**
- `../build.bat` - Script Windows
- `../Makefile` - Script Unix/Linux/macOS

**Pour builder :**
```bash
npm run build:win     # Windows exe
npm run build:all     # Toutes plateformes
```

**Ce dossier contient les scripts Node.js** utilisés pendant le build.

