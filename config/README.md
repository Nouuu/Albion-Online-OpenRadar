# config/

Configuration files pour ZQRadar.

## Fichiers

### `nodemon.json`
Configuration pour nodemon (auto-reload en développement).

```json
{
  "watch": ["app.js", "scripts/", "server-scripts/", "views/"],
  "ext": "js,ejs,json",
  "ignore": ["node_modules/", "dist/", "work/"]
}
```

**Usage :**
```bash
npm run dev  # Utilise automatiquement cette config
```

---

## 📝 Notes

Ce dossier contient les fichiers de configuration qui n'ont pas besoin d'être à la racine du projet.
# scripts-shell/

Scripts batch Windows pour faciliter l'utilisation de ZQRadar.

## Scripts Disponibles

### `_INSTALL.bat`
Installation des dépendances du projet.

```bash
_INSTALL.bat
```

**Actions :**
- Vérifie Node.js
- Installe les dépendances npm
- Rebuild les modules natifs

---

### `_RUN.bat`
Lance ZQRadar en mode production.

```bash
_RUN.bat
```

**Actions :**
- Lance `npm start`
- Ouvre le navigateur sur http://localhost:5001

---

## 📝 Notes

Ces scripts sont des wrappers pour simplifier l'utilisation sous Windows.

**Pour le développement, préférer :**
```bash
npm run dev  # Auto-reload avec nodemon
```

